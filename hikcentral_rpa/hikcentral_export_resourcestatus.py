import argparse
import os
import re
import time
from datetime import datetime
import traceback
from pathlib import Path

import pandas as pd
import numpy as np
import psutil
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_batch
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

from utils_selenium import cleanup_browser, logout_hikcentral, safe_quit


class PerformanceRecorder:
    def __init__(self, start_time: float | None = None):
        self.start_time = start_time if start_time is not None else time.perf_counter()
        self.steps: list[dict] = []
        self.cpu_max: float | None = None
        self.proc = psutil.Process(os.getpid())

    def _parse_step_label(self, label: str) -> tuple[int | None, str]:
        match = re.search(r"\[(\d+)\]", label)
        if not match:
            return None, label

        return int(match.group(1)), label.strip()

    def _update_cpu_max(self, cpu_percent: float):
        if self.cpu_max is None or cpu_percent > self.cpu_max:
            self.cpu_max = cpu_percent

    def update_cpu(self, cpu_percent: float):
        self._update_cpu_max(cpu_percent)

    def add_step(
        self,
        label: str,
        step_secs: float,
        total_secs: float,
        cpu_percent: float,
        mem_percent: float,
        proc_mem_mb: float,
    ):
        num_paso, descripcion = self._parse_step_label(label)
        if num_paso is None:
            return

        self._update_cpu_max(cpu_percent)
        self.steps.append(
            {
                "num_paso": num_paso,
                "descripcion": descripcion,
                "tiempo_paso": round(step_secs, 2),
                "tiempo_total": round(total_secs, 2),
                "cpu": round(cpu_percent, 1),
                "ram": round(mem_percent, 1),
                "py_mem": int(proc_mem_mb),
            }
        )

    def record_baseline(self, cpu_percent: float, mem_percent: float):
        self._update_cpu_max(cpu_percent)
        total_secs = time.perf_counter() - self.start_time
        self.steps.append(
            {
                "num_paso": 0,
                "descripcion": "[0] Baseline antes de automatizar",
                "tiempo_paso": 0.0,
                "tiempo_total": round(total_secs, 2),
                "cpu": round(cpu_percent, 1),
                "ram": round(mem_percent, 1),
                "py_mem": int(self.proc.memory_info().rss / (1024**2)),
            }
        )


class StepTimer:
    def __init__(self, start_time: float | None = None, recorder: PerformanceRecorder | None = None):
        self.start = start_time if start_time is not None else time.perf_counter()
        self.last = self.start
        self.recorder = recorder
        # Proceso actual, para medir memoria del script de Python
        self.proc = psutil.Process(os.getpid())

    def mark(self, label: str):
        """
        Imprime:
        - tiempo del paso
        - tiempo total desde el inicio
        - CPU y RAM del servidor
        - RAM usada por este proceso de Python
        """
        now = time.perf_counter()
        step_secs = now - self.last
        total_secs = now - self.start

        # Recursos del servidor
        cpu_percent = psutil.cpu_percent(interval=0.1)          # CPU total del server
        registrar_cpu(cpu_percent)
        mem = psutil.virtual_memory()
        mem_percent = mem.percent                               # % RAM total usada
        proc_mem_mb = self.proc.memory_info().rss / (1024**2)   # MB usados por este script

        print(
            f"[PERF] {label:<45} "
            f"paso: {step_secs:6.2f}s | total: {total_secs:6.2f}s | "
            f"CPU: {cpu_percent:5.1f}% | RAM: {mem_percent:5.1f}% | "
            f"PY-MEM: {proc_mem_mb:6.1f} MB"
        )

        if self.recorder:
            self.recorder.add_step(
                label,
                step_secs,
                total_secs,
                cpu_percent,
                mem_percent,
                proc_mem_mb,
            )

        self.last = now


# ========================
# CONFIGURACIÓN GENERAL
# ========================
BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)

URL = "http://172.16.9.10/#/"
SCRIPT_NAME = "hikcentral_export_resourcestatus.py"
HIK_USER = os.getenv("HIK_USER", "Analitica_reportes")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "SW2112_asm")

DOWNLOAD_DIR = Path(r"C:\\portal-sw\\SecurityWorld\\hikcentral_rpa\\downloads")

cpu_measurements: list[float] = []
step_timer: StepTimer | None = None
performance_recorder: PerformanceRecorder | None = None


def registrar_cpu(medicion: float):
    cpu_measurements.append(medicion)


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASS", "123456"),
        dbname=os.getenv("DB_NAME", "securityworld"),
    )


def registrar_ejecucion_y_pasos(
    opcion: str,
    duracion_total_seg: float,
    cpu_final: float,
    ram_final: float,
    recorder: PerformanceRecorder | None,
):
    try:
        conn = get_pg_connection()

        cpu_max_value = recorder.cpu_max if recorder and recorder.cpu_max is not None else 0.0
        observacion = (
            f"Ejecución de {opcion} finalizada en {duracion_total_seg:.2f}s. "
            f"CPU max: {cpu_max_value:.1f}%. RAM final: {ram_final:.1f}%."
        )

        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO PUBLIC.LOG_RPA_EJECUCION
                    (SCRIPT, OPCION, DURACION_TOTAL_SEG, CPU_MAX, CPU_FINAL, RAM_FINAL, OBSERVACION)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING ID_EJECUCION
                    """,
                    (
                        SCRIPT_NAME,
                        opcion,
                        round(duracion_total_seg, 2),
                        round(cpu_max_value, 1),
                        round(cpu_final, 1),
                        round(ram_final, 1),
                        observacion,
                    ),
                )
                id_ejecucion = cur.fetchone()[0]

                if recorder:
                    pasos_ordenados = sorted(recorder.steps, key=lambda x: x.get("num_paso", 0))
                    cur.executemany(
                        """
                        INSERT INTO PUBLIC.LOG_RPA_EJECUCION_PASO
                        (ID_EJECUCION, NUM_PASO, DESCRIPCION, TIEMPO_PASO_SEG, TIEMPO_TOTAL_SEG, CPU_PORCENTAJE, RAM_PORCENTAJE, PY_MEM_NIVEL)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                id_ejecucion,
                                paso.get("num_paso"),
                                paso.get("descripcion"),
                                paso.get("tiempo_paso"),
                                paso.get("tiempo_total"),
                                paso.get("cpu"),
                                paso.get("ram"),
                                paso.get("py_mem"),
                            )
                            for paso in pasos_ordenados
                        ],
                    )

        print("[INFO] Registro de rendimiento y pasos insertado correctamente.")
    except Exception as e:
        print(f"[ERROR] No se pudo registrar el rendimiento en la base de datos: {e}")


def process_camera_resource_status(excel_path: str) -> None:
    excel_file = Path(excel_path)
    if not excel_file.exists():
        excel_file = max(
            DOWNLOAD_DIR.glob("Camera_*.xlsx"),
            key=lambda p: p.stat().st_mtime,
            default=None,
        )

    if not excel_file or not excel_file.exists():
        print("[ERROR] No se encontró un archivo de cámara para procesar.")
        return

    expected_columns = [
        "Name",
        "Channel Address",
        "Device Address",
        "Area",
        "Device Model",
        "Network Status",
        "Video Signal",
        "Recording Status",
        "Auto-Check Time",
    ]

    critical_columns = [
        "Name",
        "Channel Address",
        "Area",
        "Network Status",
    ]

    try:
        df = pd.read_excel(excel_file, sheet_name="Camera", header=7)

        missing_columns = [column for column in expected_columns if column not in df.columns]
        if missing_columns:
            print(f"[WARN] Columnas no encontradas en Excel Camera: {missing_columns}")

        missing_critical = [column for column in critical_columns if column not in df.columns]
        if missing_critical:
            print(f"[ERROR] Columnas críticas faltantes en Excel Camera: {missing_critical}")
            return

        for column in expected_columns:
            if column not in df.columns:
                df[column] = None

        df = df[df["Name"].notna()].copy()
        df = df[expected_columns].copy()

        df.rename(
            columns={
                "Name": "camera_name",
                "Channel Address": "device_code",
                "Device Address": "ip_address",
                "Area": "site_name",
                "Device Model": "device_type",
                "Network Status": "online_status",
                "Video Signal": "signal_status",
                "Recording Status": "record_status",
                "Auto-Check Time": "auto_check_time",
            },
            inplace=True,
        )

        def safe_str(v):
            if v is None:
                return ""
            try:
                if pd.isna(v):
                    return ""
            except Exception:
                pass
            return str(v).strip()

        def normalize_online_status(value):
            val = safe_str(value).upper()
            if val == "":
                return None
            if val in {"ONLINE", "OFFLINE"}:
                return val
            return val

        def parse_timestamp(value):
            if value is None:
                return None
            try:
                if pd.isna(value):
                    return None
            except Exception:
                pass

            if isinstance(value, datetime):
                return value

            value_str = str(value).strip()
            if not value_str:
                return None

            parsed = pd.to_datetime(value_str, errors="coerce")
            if pd.isna(parsed):
                return None
            return parsed.to_pydatetime() if hasattr(parsed, "to_pydatetime") else parsed

        def derive_cliente_hacienda(area_value: str) -> tuple[str, str]:
            area = safe_str(area_value)
            pattern = re.match(r"^\[([^\]]+)\]-(.+)$", area)
            if not pattern:
                return "SIN CLIENTE", area
            return pattern.group(1).strip() or "SIN CLIENTE", pattern.group(2).strip() or area

        df["online_status"] = df["online_status"].apply(normalize_online_status)

        records: list[dict] = []
        historical_records: list[dict] = []

        for _, row in df.iterrows():
            device_code = safe_str(row.get("device_code"))
            if not device_code:
                continue

            camera_name = safe_str(row.get("camera_name"))
            site_name = safe_str(row.get("site_name"))
            auto_check_time = parse_timestamp(row.get("auto_check_time"))
            cliente, hacienda_sitio = derive_cliente_hacienda(site_name)

            row_payload = {
                "camera_name": camera_name,
                "device_code": device_code,
                "site_name": site_name,
                "device_type": safe_str(row.get("device_type")),
                "online_status": row.get("online_status"),
                "record_status": safe_str(row.get("record_status")),
                "signal_status": safe_str(row.get("signal_status")),
                "last_online_time": auto_check_time,
                "ip_address": safe_str(row.get("ip_address")),
            }
            records.append(row_payload)

            historical_records.append(
                {
                    **row_payload,
                    "area": site_name,
                    "cliente": cliente,
                    "hacienda_sitio": hacienda_sitio,
                    "auto_check_time": auto_check_time,
                    "archivo_origen": excel_file.name,
                    "camera_resource_status_id": None,
                }
            )

        if not records:
            print("[INFO] No hay registros de cámaras para insertar/actualizar.")
            return

        upsert_sql = """
            INSERT INTO PUBLIC.HIK_CAMERA_RESOURCE_STATUS (
                CAMERA_NAME, DEVICE_CODE, SITE_NAME, DEVICE_TYPE, ONLINE_STATUS, RECORD_STATUS, SIGNAL_STATUS, LAST_ONLINE_TIME, IP_ADDRESS, CREATED_AT, UPDATED_AT
            )
            VALUES (
                %(camera_name)s,
                %(device_code)s,
                %(site_name)s,
                %(device_type)s,
                %(online_status)s,
                %(record_status)s,
                %(signal_status)s,
                %(last_online_time)s,
                %(ip_address)s,
                NOW(),
                NOW()
            )
            ON CONFLICT (DEVICE_CODE) DO UPDATE SET
                CAMERA_NAME      = EXCLUDED.CAMERA_NAME,
                SITE_NAME        = EXCLUDED.SITE_NAME,
                DEVICE_TYPE      = EXCLUDED.DEVICE_TYPE,
                ONLINE_STATUS    = EXCLUDED.ONLINE_STATUS,
                RECORD_STATUS    = EXCLUDED.RECORD_STATUS,
                SIGNAL_STATUS    = EXCLUDED.SIGNAL_STATUS,
                LAST_ONLINE_TIME = EXCLUDED.LAST_ONLINE_TIME,
                IP_ADDRESS       = EXCLUDED.IP_ADDRESS,
                UPDATED_AT       = NOW();
        """

        map_current_status_sql = """
            SELECT DEVICE_CODE, ID
            FROM PUBLIC.HIK_CAMERA_RESOURCE_STATUS
            WHERE DEVICE_CODE = ANY(%s);
        """

        history_insert_sql = """
            INSERT INTO PUBLIC.HIK_CAMERA_RESOURCE_STATUS_HIST (
                CAMERA_RESOURCE_STATUS_ID,
                CAMERA_NAME,
                DEVICE_CODE,
                SITE_NAME,
                DEVICE_TYPE,
                ONLINE_STATUS,
                RECORD_STATUS,
                SIGNAL_STATUS,
                LAST_ONLINE_TIME,
                IP_ADDRESS,
                CLIENTE,
                HACIENDA_SITIO,
                AREA,
                AUTO_CHECK_TIME,
                ARCHIVO_ORIGEN,
                CREATED_AT,
                UPDATED_AT
            )
            VALUES (
                %(camera_resource_status_id)s,
                %(camera_name)s,
                %(device_code)s,
                %(site_name)s,
                %(device_type)s,
                %(online_status)s,
                %(record_status)s,
                %(signal_status)s,
                %(last_online_time)s,
                %(ip_address)s,
                %(cliente)s,
                %(hacienda_sitio)s,
                %(area)s,
                %(auto_check_time)s,
                %(archivo_origen)s,
                NOW(),
                NOW()
            );
        """

        conn = None
        try:
            conn = get_pg_connection()
            with conn:
                with conn.cursor() as cur:
                    execute_batch(cur, upsert_sql, records, page_size=500)

                    device_codes = list({record["device_code"] for record in records if record["device_code"]})
                    cur.execute(map_current_status_sql, (device_codes,))
                    id_by_device = {code: status_id for code, status_id in cur.fetchall()}

                    for history_row in historical_records:
                        history_row["camera_resource_status_id"] = id_by_device.get(history_row["device_code"])

                    execute_batch(cur, history_insert_sql, historical_records, page_size=500)

            print(f"[INFO] Cámaras insertadas/actualizadas: {len(records)}")
            print(f"[INFO] Snapshots históricos insertados: {len(historical_records)}")
        except Exception as db_error:
            print(f"[ERROR] No se pudieron persistir datos de cámara/histórico: {db_error}")
            traceback.print_exc()
        finally:
            if conn:
                conn.close()

    except Exception as e:
        print(f"[ERROR] Error al procesar el archivo de cámaras: {e}")
        traceback.print_exc()


def process_encoding_device_status(excel_path: str) -> None:
    import pandas as pd
    import numpy as np

    df = pd.read_excel(excel_path, sheet_name="Encoding Device", header=6)
    df = df[df["Name"].notna()].copy()

    df.rename(
        columns={
            "Name": "name",
            "Address": "address",
            "Serial No.": "serial_no",
            "Version": "version",
            "Network Status": "network_status",
            "Time Sync Status": "time_sync_status",
            "HDD Status": "hdd_status",
            "HDD Usage": "hdd_usage",
            "RAID": "raid",
            "Recording Status": "recording_status",
            "Hot Spare Status": "hot_spare_status",
            "Arming Status": "arming_status",
            "Manufacturer": "manufacturer",
            "First Added Time": "first_added_time",
            "Auto-Check Time": "auto_check_time",
        },
        inplace=True,
    )

    df["first_added_time"] = pd.to_datetime(df["first_added_time"], errors="coerce")
    df["auto_check_time"] = pd.to_datetime(df["auto_check_time"], errors="coerce")

    df = df.replace({np.nan: None})
    df["first_added_time"] = df["first_added_time"].where(
        df["first_added_time"].notna(), None
    )
    df["auto_check_time"] = df["auto_check_time"].where(
        df["auto_check_time"].notna(), None
    )

    records = df.to_dict(orient="records")
    if not records:
        print("[INFO] No hay registros de Encoding Device para procesar.")
        return

    conn = get_pg_connection()
    from psycopg2.extras import execute_batch

    sql = """
        INSERT INTO public.hik_encoding_device_status (
            name,
            address,
            serial_no,
            version,
            network_status,
            time_sync_status,
            hdd_status,
            hdd_usage,
            raid,
            recording_status,
            hot_spare_status,
            arming_status,
            manufacturer,
            first_added_time,
            auto_check_time,
            updated_at
        ) VALUES (
            %(name)s,
            %(address)s,
            %(serial_no)s,
            %(version)s,
            %(network_status)s,
            %(time_sync_status)s,
            %(hdd_status)s,
            %(hdd_usage)s,
            %(raid)s,
            %(recording_status)s,
            %(hot_spare_status)s,
            %(arming_status)s,
            %(manufacturer)s,
            %(first_added_time)s,
            %(auto_check_time)s,
            NOW()
        )
        ON CONFLICT (name, address)
        DO UPDATE SET
            serial_no        = EXCLUDED.serial_no,
            version          = EXCLUDED.version,
            network_status   = EXCLUDED.network_status,
            time_sync_status = EXCLUDED.time_sync_status,
            hdd_status       = EXCLUDED.hdd_status,
            hdd_usage        = EXCLUDED.hdd_usage,
            raid             = EXCLUDED.raid,
            recording_status = EXCLUDED.recording_status,
            hot_spare_status = EXCLUDED.hot_spare_status,
            arming_status    = EXCLUDED.arming_status,
            manufacturer     = EXCLUDED.manufacturer,
            first_added_time = EXCLUDED.first_added_time,
            auto_check_time  = EXCLUDED.auto_check_time,
            updated_at       = NOW();
    """

    try:
        with conn:
            with conn.cursor() as cur:
                execute_batch(cur, sql, records, page_size=500)
        print(f"[INFO] Encoding Devices insertados/actualizados: {len(records)}")
    finally:
        conn.close()


def process_ip_speaker_status(excel_path: str) -> None:
    import pandas as pd
    import numpy as np
    from psycopg2.extras import execute_batch

    df = pd.read_excel(excel_path, sheet_name="IP Speaker", header=6)
    df = df[df["Name"].notna()].copy()

    df.rename(
        columns={
            "Name": "name",
            "Address": "address",
            "Serial No.": "serial_no",
            "Version": "version",
            "Network Status": "network_status",
            "Time Sync Status": "time_sync_status",
            "First Added Time": "first_added_time",
            "Auto-Check Time": "auto_check_time",
        },
        inplace=True,
    )

    df["first_added_time"] = pd.to_datetime(df["first_added_time"], errors="coerce")
    df["auto_check_time"] = pd.to_datetime(df["auto_check_time"], errors="coerce")

    df = df.replace({np.nan: None})
    df["first_added_time"] = df["first_added_time"].where(
        df["first_added_time"].notna(), None
    )
    df["auto_check_time"] = df["auto_check_time"].where(
        df["auto_check_time"].notna(), None
    )

    records = df.to_dict(orient="records")
    if not records:
        print("[INFO] No hay registros de IP Speaker para procesar.")
        return

    conn = get_pg_connection()

    sql = """
        INSERT INTO public.hik_ip_speaker_status (
            name,
            address,
            serial_no,
            version,
            network_status,
            time_sync_status,
            first_added_time,
            auto_check_time,
            updated_at
        ) VALUES (
            %(name)s,
            %(address)s,
            %(serial_no)s,
            %(version)s,
            %(network_status)s,
            %(time_sync_status)s,
            %(first_added_time)s,
            %(auto_check_time)s,
            NOW()
        )
        ON CONFLICT (name, address)
        DO UPDATE SET
            serial_no        = EXCLUDED.serial_no,
            version          = EXCLUDED.version,
            network_status   = EXCLUDED.network_status,
            time_sync_status = EXCLUDED.time_sync_status,
            first_added_time = EXCLUDED.first_added_time,
            auto_check_time  = EXCLUDED.auto_check_time,
            updated_at       = NOW();
    """

    try:
        with conn:
            with conn.cursor() as cur:
                execute_batch(cur, sql, records, page_size=500)
        print(f"[INFO] IP Speakers insertados/actualizados: {len(records)}")
    finally:
        conn.close()


def process_alarm_input_status(excel_path: str) -> None:
    import pandas as pd
    import numpy as np
    from psycopg2.extras import execute_batch

    df = pd.read_excel(excel_path, sheet_name="Alarm Input", header=7)
    df = df[df["Name"].notna()].copy()

    df.rename(
        columns={
            "Name": "name",
            "Device": "device",
            "Area": "area",
            "Partition (Area)": "partition_area",
            "Network Status": "network_status",
            "Arming Status": "arming_status",
            "Bypass Status": "bypass_status",
            "Fault Status": "fault_status",
            "Alarm Status": "alarm_status",
            "Detector Connection Status": "detector_connection_status",
            "Battery Status": "battery_status",
            "Device Battery Capacity": "device_battery_capacity",
            "Zone Tampering Status": "zone_tampering_status",
            "Auto-Check Time": "auto_check_time",
        },
        inplace=True,
    )

    df["auto_check_time"] = pd.to_datetime(df["auto_check_time"], errors="coerce")

    df = df.replace({np.nan: None})
    df["auto_check_time"] = df["auto_check_time"].where(
        df["auto_check_time"].notna(), None
    )

    records = df.to_dict(orient="records")
    if not records:
        print("[INFO] No hay registros de Alarm Input para procesar.")
        return

    conn = get_pg_connection()

    sql = """
        INSERT INTO public.hik_alarm_input_status (
            name,
            device,
            area,
            partition_area,
            network_status,
            arming_status,
            bypass_status,
            fault_status,
            alarm_status,
            detector_connection_status,
            battery_status,
            device_battery_capacity,
            zone_tampering_status,
            auto_check_time,
            updated_at
        ) VALUES (
            %(name)s,
            %(device)s,
            %(area)s,
            %(partition_area)s,
            %(network_status)s,
            %(arming_status)s,
            %(bypass_status)s,
            %(fault_status)s,
            %(alarm_status)s,
            %(detector_connection_status)s,
            %(battery_status)s,
            %(device_battery_capacity)s,
            %(zone_tampering_status)s,
            %(auto_check_time)s,
            NOW()
        )
        ON CONFLICT (name, device)
        DO UPDATE SET
            area                       = EXCLUDED.area,
            partition_area             = EXCLUDED.partition_area,
            network_status             = EXCLUDED.network_status,
            arming_status              = EXCLUDED.arming_status,
            bypass_status              = EXCLUDED.bypass_status,
            fault_status               = EXCLUDED.fault_status,
            alarm_status               = EXCLUDED.alarm_status,
            detector_connection_status = EXCLUDED.detector_connection_status,
            battery_status             = EXCLUDED.battery_status,
            device_battery_capacity    = EXCLUDED.device_battery_capacity,
            zone_tampering_status      = EXCLUDED.zone_tampering_status,
            auto_check_time            = EXCLUDED.auto_check_time,
            updated_at                 = NOW();
    """

    try:
        with conn:
            with conn.cursor() as cur:
                execute_batch(cur, sql, records, page_size=500)
        print(f"[INFO] Alarm Inputs insertados/actualizados: {len(records)}")
    finally:
        conn.close()


def crear_driver() -> webdriver.Chrome:
    """Configura y devuelve un driver de Chrome listo para descargar archivos."""

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    chrome_options = Options()

    prefs = {
        "download.default_directory": str(DOWNLOAD_DIR),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": False,
        "safebrowsing.disable_download_protection": True,
        "profile.default_content_setting_values.automatic_downloads": 1,
        "profile.default_content_setting_values.popups": 0,
    }
    chrome_options.add_experimental_option("prefs", prefs)

    chrome_options.add_argument("--ignore-certificate-errors")
    chrome_options.add_argument("--allow-running-insecure-content")
    chrome_options.add_argument("--safebrowsing-disable-download-protection")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--disable-features=BlockInsecureDownloadRestrictions,DownloadBubble")
    chrome_options.add_argument("--start-maximized")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    driver.execute_cdp_cmd(
        "Page.setDownloadBehavior",
        {
            "behavior": "allow",
            "downloadPath": str(DOWNLOAD_DIR),
        },
    )

    driver.maximize_window()
    print(f"[DEBUG] DOWNLOAD_DIR = {DOWNLOAD_DIR}")
    return driver


def limpiar_descargas(download_dir: Path = DOWNLOAD_DIR):
    """Elimina archivos previos en la carpeta de descargas para identificar el nuevo Excel."""
    for f in download_dir.glob("*"):
        try:
            f.unlink()
        except Exception:
            pass


def esperar_descarga(download_dir: Path, archivos_previos, timeout: int = 120) -> str:
    """Espera hasta detectar un nuevo archivo .xlsx o .xls en download_dir."""

    print("[9] Esperando archivo descargado...")
    inicio = time.time()

    while True:
        archivos_actuales = os.listdir(download_dir)
        nuevos = [
            f
            for f in archivos_actuales
            if f not in archivos_previos
            and not f.endswith(".crdownload")
            and (f.endswith(".xlsx") or f.endswith(".xls"))
        ]

        if nuevos:
            archivo = nuevos[0]
            ruta = str(download_dir / archivo)
            print(f"[9] Archivo encontrado: {ruta}")
            if step_timer:
                step_timer.mark("[9] Descarga detectada")
            return ruta

        if time.time() - inicio > timeout:
            raise TimeoutError("No se detectó ningún archivo descargado en el tiempo esperado.")

        time.sleep(2)


def encontrar_ultimo_archivo(
    prefijo: str, extension: str, download_dir: Path = DOWNLOAD_DIR
) -> Path | None:
    archivos = list(download_dir.glob(f"{prefijo}*{extension}"))
    return (
        max(archivos, key=lambda p: p.stat().st_mtime)
        if archivos
        else None
    )


def click_menu_item_by_title(driver, title: str) -> bool:
    """
    Intenta hacer clic en un elemento cuyo atributo title sea igual a `title`.
    Primero en el documento principal, luego dentro de todos los iframes.
    Devuelve True si lo encontró y clickeó, False en caso contrario.
    """
    script = """
    var title = arguments[0];
    var candidates = document.querySelectorAll("li[title], a[title], div[title], span[title]");
    for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (el.getAttribute('title') === title) {
            el.click();
            return true;
        }
    }
    return false;
    """

    # Intentar en el documento principal
    try:
        found = driver.execute_script(script, title)
        if found:
            return True
    except Exception:
        pass

    # Intentar en todos los iframes
    frames = driver.find_elements(By.TAG_NAME, "iframe")
    for frame in frames:
        try:
            driver.switch_to.frame(frame)
            found = driver.execute_script(script, title)
            driver.switch_to.default_content()
            if found:
                return True
        except Exception:
            driver.switch_to.default_content()
            continue

    # Volver siempre al contexto principal
    driver.switch_to.default_content()
    return False


def ir_a_pestana_maintenance(driver, wait):
    print("[4] Abriendo pestaña Maintenance...")

    # 0) Si ya estamos en Maintenance, no reabrir menús superiores.
    try:
        tab_activa = driver.find_elements(
            By.XPATH,
            "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active') and normalize-space()='Maintenance']",
        )
        rail_visible = driver.find_elements(
            By.XPATH,
            "//section[@id='maintenance']//div[contains(@class,'nav-base') and not(contains(@style,'display: none'))]",
        )
        if tab_activa or any(elem.is_displayed() for elem in rail_visible):
            print("[NAV] Maintenance ya activo; continúo")
            if step_timer:
                step_timer.mark("[4] Pestaña Maintenance")
            return
    except Exception:
        pass

    # 1) Intentar botón "Go to Maintenance" del panel Device Statistics
    try:
        boton_go = wait.until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//button[contains(@class,'el-button') "
                    "and .//div[contains(@class,'el-button-slot-wrapper') "
                    "and normalize-space()='Go to Maintenance']]",
                )
            )
        )
        driver.execute_script("arguments[0].click();", boton_go)
        if step_timer:
            step_timer.mark("[4] Pestaña Maintenance")
        return
    except TimeoutException:
        print("   [Aviso] Botón 'Go to Maintenance' no encontrado, pruebo menú principal...")

    # 2) Intentar menú de navegación (icono de todos los menús + opción Maintenance)
    try:
        # Abrir el popup de menús si no está visible
        try:
            menu_pop = driver.find_element(By.ID, "navigation_menuPop")
            if not menu_pop.is_displayed():
                raise NoSuchElementException()
        except Exception:
            menu_btn = wait.until(
                EC.element_to_be_clickable((By.ID, "navigation_addMenuBtn"))
            )
            menu_btn.click()

        opcion_maintenance = wait.until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//div[@id='navigation_menuPop']"
                    "//div[contains(@id,'nav_box_s_menu_resourcemaintain_operations')]"
                    "//span[@title='Maintenance']",
                )
            )
        )
        driver.execute_script("arguments[0].click();", opcion_maintenance)
        if step_timer:
            step_timer.mark("[4] Pestaña Maintenance")
        return
    except TimeoutException:
        print("   [Aviso] Menú 'Maintenance' no disponible, pruebo pestaña superior...")

    # 3) Intentar pestaña superior "Maintenance" (comportamiento del primer ambiente)
    try:
        tab_maintenance = wait.until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//div[contains(@class,'el-tabs__nav')]"
                    "//div[contains(@class,'el-tabs__item') and normalize-space()='Maintenance']",
                )
            )
        )
        driver.execute_script("arguments[0].click();", tab_maintenance)
        if step_timer:
            step_timer.mark("[4] Pestaña Maintenance")
        return
    except TimeoutException:
        raise Exception("No se pudo hacer clic en la pestaña 'Maintenance'")


def obtener_popup_colapsado_por_titulo(driver, titulo: str):
    popups = driver.find_elements(By.CSS_SELECTOR, "div.el-menu-collapse-wrap")
    titulo_normalizado = _normalize_label(titulo)
    for popup in popups:
        try:
            if not popup.is_displayed():
                continue
            titulo_popup = popup.find_element(By.CSS_SELECTOR, "li.el-submenu__collpase-title")
            if _normalize_label(titulo_popup.text) == titulo_normalizado:
                return popup
        except Exception:
            continue
    return None


def obtener_rail_lateral_maintenance(driver, wait):
    print("[NAV] Buscando rail lateral de Maintenance")
    candidatos_xpath = [
        "//section[@id='maintenance']//div[contains(@class,'nav-base')]",
        "//section[@id='maintenance']//aside[contains(@class,'left') or contains(@class,'nav')]",
        "//section[@id='maintenance']//ul[contains(@class,'el-menu')]",
    ]

    def _buscar_rail(_driver):
        for xpath in candidatos_xpath:
            rails = _driver.find_elements(By.XPATH, xpath)
            for rail in rails:
                try:
                    if not rail.is_displayed():
                        continue
                    iconos_visibles = [
                        icon
                        for icon in rail.find_elements(By.CSS_SELECTOR, "i.el-menu-icon")
                        if icon.is_displayed()
                    ]
                    if iconos_visibles:
                        return rail
                except Exception:
                    continue
        return False

    return wait.until(_buscar_rail)


def debug_dump_rail_lateral(rail):
    iconos_debug: list[str] = []
    contenedores_debug: list[str] = []
    try:
        for icono in rail.find_elements(By.CSS_SELECTOR, "i"):
            try:
                if not icono.is_displayed():
                    continue
                clases = (icono.get_attribute("class") or "").strip()
                if clases:
                    iconos_debug.append(clases)

                padre = icono.find_element(
                    By.XPATH,
                    "ancestor::*[self::li or self::div][1]",
                )
                texto_padre = (padre.text or padre.get_attribute("title") or "").strip()
                if texto_padre:
                    contenedores_debug.append(f"{clases} => {texto_padre}")
                else:
                    contenedores_debug.append(clases)
            except Exception:
                continue
    except Exception:
        pass

    resumen_iconos = ", ".join(dict.fromkeys(iconos_debug)) if iconos_debug else "(sin íconos visibles)"
    resumen_contenedores = ", ".join(dict.fromkeys(contenedores_debug)) if contenedores_debug else "(sin contenedores visibles)"
    print(f"[NAV][DEBUG] Íconos visibles en rail: {resumen_iconos}")
    print(f"[NAV][DEBUG] Contenedores visibles del rail: {resumen_contenedores}")


def obtener_item_resource_status(driver, wait):
    print("[NAV] Buscando Resource Status por ícono icon-svg-nav_realtime_status_resources")
    rail = obtener_rail_lateral_maintenance(driver, wait)

    def _buscar_item(_driver):
        try:
            iconos = rail.find_elements(By.XPATH, ".//i[contains(@class,'icon-svg-nav_realtime_status_resources')]")
        except Exception:
            return False

        for icono in iconos:
            try:
                if not icono.is_displayed():
                    continue
                item = icono.find_element(
                    By.XPATH,
                    "ancestor::*[(self::li or self::div) and (contains(@class,'el-submenu') or contains(@class,'el-menu-item') or @role='menuitem')][1]",
                )
                if item.is_displayed():
                    return item
            except Exception:
                continue
        return False

    try:
        item = WebDriverWait(driver, 4).until(_buscar_item)
        print("[NAV] Item Resource Status encontrado")
        return item
    except TimeoutException as exc:
        debug_dump_rail_lateral(rail)
        raise Exception("[NAV][ERROR] No se encontró Resource Status por ícono en el rail lateral visible") from exc


def esperar_popup_resource_status_visible(driver, timeout: int = 6):
    print("[NAV] Esperando popup visible de Resource Status")

    def _buscar_popup(d):
        popups = d.find_elements(By.CSS_SELECTOR, "div.el-menu-collapse-wrap")
        for popup in popups:
            try:
                if not popup.is_displayed():
                    continue

                titulos = popup.find_elements(
                    By.CSS_SELECTOR,
                    "li.el-submenu__collpase-title, li.el-submenu__collapse-title, li[class*='submenu'][class*='title']",
                )

                for titulo_elem in titulos:
                    if _normalize_label(titulo_elem.text) == "resource status":
                        return popup
            except Exception:
                continue
        return False

    try:
        popup = WebDriverWait(driver, timeout).until(_buscar_popup)
        print("[NAV] Popup de Resource Status visible")
        return popup
    except TimeoutException as exc:
        raise Exception("[NAV][ERROR] No se pudo abrir el popup de Resource Status") from exc


def _texto_debug_elemento(element) -> str:
    try:
        html = element.get_attribute("outerHTML") or ""
    except Exception:
        html = ""
    try:
        texto = element.text or ""
    except Exception:
        texto = ""
    return f"texto={texto.strip()!r} | html={html[:400]!r}"


def _click_con_prioridad(driver, element, descripcion: str):
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    except Exception:
        pass

    wait_loading_overlays(driver, timeout=10)

    try:
        driver.execute_script("arguments[0].click();", element)
        print(f"[NAV] Click en {descripcion} por JS")
        return
    except Exception:
        pass

    try:
        element.click()
        print(f"[NAV] Click en {descripcion} directo")
        return
    except Exception:
        pass

    try:
        ActionChains(driver).move_to_element(element).pause(0.1).click().perform()
        print(f"[NAV] Click en {descripcion} por ActionChains")
        return
    except Exception as exc:
        raise Exception(f"[NAV][ERROR] No se pudo hacer click en {descripcion}: {exc}") from exc


def _esperar_popup_hijo_visible(driver, submenu, timeout: int = 6):
    print("[NAV] Esperando popup hijo de Resource Status visible")

    def _popup_visible(_driver):
        try:
            popup = submenu.find_element(By.CSS_SELECTOR, "div.el-menu-collapse-wrap")
        except Exception:
            return False

        style = (popup.get_attribute("style") or "").replace(" ", "").lower()
        oculto_por_style = "display:none" in style
        try:
            visible = popup.is_displayed()
        except Exception:
            visible = False

        if visible or not oculto_por_style:
            return popup
        return False

    try:
        return WebDriverWait(driver, timeout).until(_popup_visible)
    except TimeoutException as exc:
        popup = submenu.find_element(By.CSS_SELECTOR, "div.el-menu-collapse-wrap")
        print(f"[NAV][DEBUG] style del popup: {popup.get_attribute('style')}")
        print(f"[NAV][DEBUG] html/texto del submenu: {_texto_debug_elemento(submenu)}")
        raise Exception("[NAV][ERROR] No se pudo hacer visible el popup hijo de Resource Status") from exc


def obtener_submenu_resource_status(driver, wait):
    print("[NAV] Buscando li.el-submenu de Resource Status")
    xpath = (
        "//li[contains(@class,'el-submenu')]"
        "[.//span[contains(@class,'first-level-weight') and @title='Resource Status']]"
    )
    try:
        submenu = WebDriverWait(driver, 12).until(
            lambda _d: next((el for el in _d.find_elements(By.XPATH, xpath) if el.is_displayed()), None) or False
        )
        print("[NAV] Submenu Resource Status encontrado")
        return submenu
    except TimeoutException as exc:
        raise Exception(
            "[NAV][ERROR] No se encontró li.el-submenu de Resource Status dentro de Maintenance"
        ) from exc


def confirmar_maintenance_activo(driver):
    tab_activa = driver.find_elements(
        By.XPATH,
        "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active') and normalize-space()='Maintenance']",
    )
    if tab_activa:
        print("[NAV] Maintenance ya activo; continúo")
        return

    raise Exception("[NAV][ERROR] Maintenance no está activo antes de abrir Resource Status")


def _xpath_literal(value: str) -> str:
    if "'" not in value:
        return f"'{value}'"
    if '"' not in value:
        return f'"{value}"'
    parts = value.split("'")
    return "concat(" + ", \"'\", ".join([f"'{p}'" for p in parts]) + ")"


def abrir_popup_resource_status(driver, wait):
    print("[NAV] Intentando abrir popup hijo de Resource Status por JS")
    xpath_submenu = (
        "//li[contains(@class,'el-submenu')]"
        "[.//span[@title='Resource Status' or normalize-space()='Resource Status']]"
    )
    ultimo_error = None

    for intento in range(1, 6):
        try:
            submenu = wait.until(EC.presence_of_element_located((By.XPATH, xpath_submenu)))
            ul_popup = driver.execute_script(
                """
                const submenu = arguments[0];
                submenu.classList.add('is-opened');
                const wrap = submenu.querySelector('div.el-menu-collapse-wrap');
                if (wrap) {
                    wrap.style.display = 'block';
                    wrap.style.visibility = 'visible';
                    wrap.style.opacity = '1';
                    wrap.style.height = 'auto';
                    wrap.style.maxHeight = 'none';
                    wrap.style.overflow = 'visible';
                }
                const ul = (wrap && wrap.querySelector('ul')) || submenu.querySelector('ul');
                if (ul) {
                    ul.style.display = 'block';
                    ul.style.visibility = 'visible';
                    ul.style.opacity = '1';
                    ul.style.height = 'auto';
                    ul.style.maxHeight = 'none';
                    ul.style.overflow = 'visible';
                }
                return ul;
                """,
                submenu,
            )

            if ul_popup and ul_popup.is_displayed():
                print("[NAV] Popup de Resource Status visible")
                return ul_popup

            raise Exception("[NAV][DEBUG] El <ul> de Resource Status no quedó visible")

        except StaleElementReferenceException as exc:
            ultimo_error = exc
            print(f"[NAV][DEBUG] Intento {intento}: elemento stale al abrir Resource Status ({exc})")
            time.sleep(0.2)
        except Exception as exc:
            ultimo_error = exc
            print(f"[NAV][DEBUG] Intento {intento}: popup aún no visible por JS ({exc})")
            time.sleep(0.25)

    raise Exception("[NAV][ERROR] No se pudo forzar la apertura de Resource Status") from ultimo_error


def _texto_normalizado_elemento(element) -> str:
    textos = [
        element.text,
        element.get_attribute("title"),
        element.get_attribute("aria-label"),
        element.get_attribute("innerText"),
    ]
    for t in textos:
        nt = _normalize_label(t)
        if nt:
            return nt
    return ""


def _popup_sigue_visible(popup) -> bool:
    try:
        return popup.is_displayed()
    except Exception:
        return False


def click_estable(driver, wait, xpath: str, descripcion: str):
    """
    Click robusto para DOM dinámico (Vue/Element UI).
    Estrategia:
    1) Re-localiza el elemento en cada intento.
    2) Hace scroll al centro.
    3) Ejecuta click con ActionChains.
    4) Reintenta ante StaleElementReferenceException o ElementClickInterceptedException.
    """
    ultimo_error = None
    for intento in range(1, 6):
        try:
            elemento = wait.until(EC.presence_of_element_located((By.XPATH, xpath)))
            wait.until(lambda _d: elemento.is_displayed())

            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", elemento)
            wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
            ActionChains(driver).move_to_element(elemento).pause(0.05).click().perform()

            print(f"[NAV] Click estable en {descripcion} (intento {intento})")
            return
        except (StaleElementReferenceException, ElementClickInterceptedException, TimeoutException) as exc:
            ultimo_error = exc
            print(
                f"[NAV][DEBUG] Reintento {intento}/5 para {descripcion} "
                f"por {type(exc).__name__}: {exc}"
            )
            time.sleep(0.2)

    raise Exception(
        f"[NAV][ERROR] No se pudo hacer click en {descripcion} tras 5 intentos"
    ) from ultimo_error


def click_opcion_en_popup_resource_status(driver, wait, popup, opcion: str):
    print(f"[NAV] Buscando opción {opcion} dentro del popup")
    opcion_literal = _xpath_literal(opcion)
    xpaths = [
        f"//li[@title={opcion_literal}]//span[normalize-space()={opcion_literal}]",
        f"//li[@title={opcion_literal}]",
    ]

    ultimo_error = None
    for xpath in xpaths:
        try:
            click_estable(driver, wait, xpath, f"{opcion} en popup Resource Status")
            return
        except Exception as exc:
            ultimo_error = exc
            print(f"[NAV][DEBUG] XPath no exitoso para {opcion}: {xpath} -> {exc}")

    raise Exception(
        f"[NAV][ERROR] No se pudo hacer clic en {opcion} dentro del popup Resource Status"
    ) from ultimo_error


def confirmar_vista_resource_status_activa(driver, wait, opcion: str):
    opcion_norm = _normalize_label(opcion)

    def _vista_lista(d):
        marcadores = d.find_elements(
            By.XPATH,
            "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active')]"
            "| //li[contains(@class,'el-menu-item') and contains(@class,'is-active')]"
            "| //*[self::h1 or self::h2 or self::h3 or self::span or self::div][normalize-space()]",
        )
        for elemento in marcadores:
            if _texto_normalizado_elemento(elemento) == opcion_norm:
                return True
        return False

    try:
        WebDriverWait(driver, 12).until(_vista_lista)
    except TimeoutException as exc:
        raise Exception(
            f"[NAV][ERROR] No se pudo confirmar apertura de la vista {opcion} después del clic"
        ) from exc


def confirmar_vista_camera_activa(driver, wait):
    print("[NAV] Validando vista Camera")

    def _vista_camera_lista(d):
        real_time_activa = d.find_elements(
            By.XPATH,
            "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active') and normalize-space()='Real-Time Overview']",
        )
        if real_time_activa:
            return False

        marcadores_camera = d.find_elements(
            By.XPATH,
            "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active') and normalize-space()='Camera']"
            "| //li[contains(@class,'el-menu-item') and @title='Camera' and contains(@class,'is-active')]"
            "| //*[self::h1 or self::h2 or self::h3 or self::span or self::div][normalize-space()='Camera']",
        )
        return any(elem.is_displayed() for elem in marcadores_camera)

    try:
        WebDriverWait(driver, 12).until(_vista_camera_lista)
        print("[NAV] Vista Camera confirmada")
    except TimeoutException as exc:
        print("[NAV][ERROR] No se pudo abrir Camera desde el popup de Resource Status")
        raise Exception("No se pudo confirmar apertura de la vista Camera después de hacer clic en popup.") from exc


def abrir_opcion_resource_status(driver, wait, opcion: str):
    opcion = (opcion or "Camera").strip()
    maintenance_xpaths = [
        "//div[@id='maintenanceApp' and contains(translate(@style,'ABCDEFGHIJKLMNOPQRSTUVWXYZ ','abcdefghijklmnopqrstuvwxyz'),'display:block')]",
        "//div[@id='maintenanceApp' and not(contains(translate(@style,'ABCDEFGHIJKLMNOPQRSTUVWXYZ ','abcdefghijklmnopqrstuvwxyz'),'display:none'))]",
    ]
    resource_status_xpaths = [
        "//span[@title='Resource Status']",
        "//div[contains(@class,'el-submenu__title')][.//span[@title='Resource Status']]",
        "//i[contains(@class,'icon-svg-nav_realtime_status_resources')]/ancestor::div[contains(@class,'el-submenu__title')]",
    ]
    opcion_literal = _xpath_literal(opcion)
    opcion_xpaths = [
        f"//li[contains(@class,'el-menu-item') and @title={opcion_literal}]",
        f"//span[normalize-space()={opcion_literal}]/ancestor::li[contains(@class,'el-menu-item')]",
        f"//li[@title={opcion_literal}]",
    ]

    def _guardar_evidencia(step_name: str):
        try:
            DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = DOWNLOAD_DIR / f"debug_maintenance_{step_name}_{ts}.png"
            html_path = DOWNLOAD_DIR / f"debug_maintenance_{step_name}_{ts}.html"
            driver.save_screenshot(str(screenshot_path))
            maintenance_html = driver.execute_script(
                "const el = document.getElementById('maintenanceApp'); return el ? el.outerHTML : '';"
            )
            html_path.write_text(maintenance_html or "", encoding="utf-8")
            print(f"[HIK][MAINTENANCE] Evidencia guardada: {screenshot_path}")
            print(f"[HIK][MAINTENANCE] Evidencia guardada: {html_path}")
        except Exception as ev_exc:
            print(f"[HIK][MAINTENANCE] No se pudo guardar evidencia: {ev_exc}")

    def _find_visible(xpath_list: list[str], timeout: int = 6):
        end_time = time.time() + timeout
        while time.time() < end_time:
            for xp in xpath_list:
                elems = driver.find_elements(By.XPATH, xp)
                for el in elems:
                    try:
                        if el.is_displayed():
                            return el
                    except Exception:
                        continue
            time.sleep(0.15)
        return None

    def _click_seguro(elemento, descripcion: str):
        try:
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", elemento)
        except Exception:
            pass
        try:
            ActionChains(driver).move_to_element(elemento).pause(0.1).click().perform()
            print(f"[HIK][RESOURCE_STATUS] Click en {descripcion} por ActionChains")
            time.sleep(0.25)
            return
        except Exception:
            pass
        try:
            driver.execute_script("arguments[0].click();", elemento)
            print(f"[HIK][RESOURCE_STATUS] Click en {descripcion} por JS")
            time.sleep(0.25)
            return
        except Exception as exc:
            raise Exception(f"No se pudo hacer click en {descripcion}: {exc}") from exc

    try:
        WebDriverWait(driver, 20).until(lambda _d: _find_visible(maintenance_xpaths, timeout=1) is not None)
        print("[HIK][MAINTENANCE] Maintenance activo")
    except TimeoutException as exc:
        _guardar_evidencia("maintenance_inactivo")
        raise Exception("[HIK][MAINTENANCE] maintenanceApp no está activo con display:block") from exc

    nav_base = _find_visible(
        [
            "//div[@id='nav-base']",
            "//div[@id='nav-base' and contains(@class,'isCollapse')]",
            "//div[contains(@class,'nav-base') and contains(@class,'isCollapse')]",
        ],
        timeout=5,
    )

    if nav_base:
        nav_classes = (nav_base.get_attribute("class") or "").lower()
        nav_style = (nav_base.get_attribute("style") or "").lower()
        esta_colapsado = ("iscollapse" in nav_classes) or ("width: 48px" in nav_style)
        if esta_colapsado:
            print("[HIK][MAINTENANCE] Menú lateral colapsado detectado")
            print("[HIK][MAINTENANCE] Intentando expandir menú lateral")
            expand_btn = _find_visible(
                [
                    "//div[@id='nav-base']//div[@title='Expand Menu']",
                    "//div[@id='nav-base']//div[contains(@class,'nav-base-collapse-top')]",
                    "//div[@id='nav-base']//i[contains(@class,'nav-base-collapse-left')]/ancestor::*[self::div or self::button][1]",
                ],
                timeout=4,
            )
            if expand_btn:
                _click_seguro(expand_btn, "Expand Menu")
                time.sleep(0.4)

    ultimo_error = None
    for intento in range(1, 6):
        try:
            rs_menu = _find_visible(resource_status_xpaths, timeout=5)
            if not rs_menu:
                raise Exception("No se encontró el menú Resource Status")
            _click_seguro(rs_menu, "Resource Status")
            print("[HIK][RESOURCE_STATUS] Click en Resource Status")

            opcion_menu = _find_visible(opcion_xpaths, timeout=6)
            if not opcion_menu:
                raise Exception(f"No apareció la opción {opcion} dentro de Resource Status")
            _click_seguro(opcion_menu, f"opción {opcion}")
            print(f"[HIK][RESOURCE_STATUS] Click en opción {opcion}")

            opcion_activa_xpath = (
                f"//li[contains(@class,'el-menu-item') and @title={opcion_literal} and contains(@class,'is-active')]"
                f"| //div[contains(@class,'el-tabs__item') and contains(@class,'is-active') and normalize-space()={opcion_literal}]"
                f"| //*[self::span or self::div or self::h1 or self::h2 or self::h3][normalize-space()={opcion_literal}]"
            )
            real_time_activa_xpath = (
                "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active') and normalize-space()='Real-Time Overview']"
            )
            export_btn_xpath = (
                "//button[contains(@class,'el-button')][.//span[normalize-space()='Export'] or @title='Export']"
            )

            def _validar_apertura(_driver):
                opcion_activa = _driver.find_elements(By.XPATH, opcion_activa_xpath)
                real_time_activa = _driver.find_elements(By.XPATH, real_time_activa_xpath)
                export_btn = _driver.find_elements(By.XPATH, export_btn_xpath)
                if any(e.is_displayed() for e in opcion_activa):
                    return True
                if not any(e.is_displayed() for e in real_time_activa) and any(
                    e.is_displayed() for e in export_btn
                ):
                    return True
                return False

            WebDriverWait(driver, 12).until(_validar_apertura)
            print(f"[HIK][RESOURCE_STATUS] Opción {opcion} abierta correctamente")
            wait_loading_end(driver)
            return
        except Exception as exc:
            ultimo_error = exc
            print(
                f"[HIK][RESOURCE_STATUS] Reintento {intento}/5 para abrir {opcion} "
                f"desde Resource Status: {exc}"
            )
            time.sleep(0.5)

    _guardar_evidencia("resource_status_error")
    raise Exception(f"[HIK][RESOURCE_STATUS] No se pudo abrir {opcion} tras múltiples intentos") from ultimo_error


def _normalize_label(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


def _element_matches(element, target_normalized: str) -> bool:
    textos = [
        element.text,
        element.get_attribute("title"),
        element.get_attribute("aria-label"),
        element.get_attribute("innerText"),
    ]
    return any(_normalize_label(t) == target_normalized for t in textos if t)


def safe_click(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)


def wait_loading_overlays(driver, timeout: int = 60):
    overlays = [
        (By.CSS_SELECTOR, ".el-loading-mask.is-fullscreen"),
        (By.CSS_SELECTOR, ".el-loading-mask"),
        (By.CSS_SELECTOR, ".v-modal"),
        (By.CSS_SELECTOR, ".el-dialog__wrapper"),
    ]
    end_time = time.time() + timeout
    while time.time() < end_time:
        visible = False
        for by, selector in overlays:
            try:
                elems = driver.find_elements(by, selector)
            except Exception:
                continue
            for elem in elems:
                try:
                    if not elem.is_displayed():
                        continue
                    if selector == ".el-dialog__wrapper":
                        # Solo tratar como overlay cuando realmente está visible.
                        dialogos_visibles = elem.find_elements(By.CSS_SELECTOR, ".el-dialog")
                        if not any(d.is_displayed() for d in dialogos_visibles):
                            continue
                    visible = True
                    break
                except Exception:
                    continue
            if visible:
                break
        if not visible:
            return
        time.sleep(0.5)


def wait_loading_end(driver, timeout: int = 15):
    wait_loading_overlays(driver, timeout=timeout)


def click_robusto(driver, element, retries: int = 2):
    for intento in range(retries + 1):
        try:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            element.click()
            return
        except ElementClickInterceptedException:
            wait_loading_overlays(driver, timeout=60)
            if intento >= retries:
                driver.execute_script("arguments[0].click();", element)
                return
        except Exception:
            driver.execute_script("arguments[0].click();", element)
            return


def find_click_by_text(driver, wait, text: str):
    normalized = _normalize_label(text)
    condition = (
        "contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '"
        + normalized
        + "')"
    )

    xpaths = [
        "//div[contains(@class,'tabs') or contains(@class,'tab')][.//*/text()]//*[self::div or self::button or self::span or self::a][{cond}]",
        "//button[{cond}]",
        "//li[{cond}]",
        "//span[{cond}]",
        "//div[{cond}]",
        "//a[{cond}]",
        "//div[contains(@class,'el-select-dropdown')]//li[{cond}]",
        "//ul[contains(@class,'menu') or contains(@class,'list')]//li[{cond}]",
        "//*[@role='tab' and {cond}]",
    ]

    candidates_texts: list[str] = []
    for xpath in xpaths:
        locator = xpath.format(cond=condition)
        try:
            elements = driver.find_elements(By.XPATH, locator)
        except Exception:
            continue

        for elem in elements:
            if not elem.is_displayed():
                continue
            texto_elem = _normalize_label(elem.text or elem.get_attribute("title") or "")
            if texto_elem:
                candidates_texts.append(elem.text.strip() or elem.get_attribute("title") or "")
            try:
                wait.until(EC.element_to_be_clickable(elem))
            except Exception:
                continue

            if _element_matches(elem, normalized):
                return elem, candidates_texts

    return None, candidates_texts


def _switch_to_resource_iframe(driver) -> bool:
    switched = False
    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    try:
        frames = driver.find_elements(By.TAG_NAME, "iframe")
    except Exception:
        return False

    visibles = []
    for frame in frames:
        try:
            if not frame.is_displayed():
                continue
            rect = frame.rect or {}
            area = rect.get("width", 0) * rect.get("height", 0)
            visibles.append((area, frame))
        except Exception:
            continue

    for _, frame in sorted(visibles, key=lambda x: x[0], reverse=True):
        try:
            driver.switch_to.frame(frame)
            switched = True
            break
        except Exception:
            continue

    return switched


def _validar_recurso_seleccionado(driver, target_label: str) -> bool:
    normalized = _normalize_label(target_label)
    indicadores = [
        "//div[contains(@class,'el-tabs__item') and contains(@class,'is-active')]",
        "//li[contains(@class,'is-active') or contains(@class,'active')]",
        "//button[contains(@class,'is-active') or contains(@class,'active')]",
        "//div[contains(@class,'breadcrumb') or contains(@class,'crumb')]//span",
        "//div[contains(@class,'el-select')]//span[contains(@class,'selected') or contains(@class,'el-select__selected')]",
        "//div[contains(@class,'tab') and contains(@class,'active')]",
    ]

    for xp in indicadores:
        try:
            elems = driver.find_elements(By.XPATH, xp)
        except Exception:
            continue
        for elem in elems:
            if not elem.is_displayed():
                continue
            if _element_matches(elem, normalized):
                return True
    return False


def _esperar_refresco_contenido(driver, previo=None, timeout: int = 10):
    try:
        if previo:
            WebDriverWait(driver, timeout).until(EC.staleness_of(previo))
            return True
    except Exception:
        pass

    time.sleep(1.5)
    try:
        nuevo = driver.find_element(By.CSS_SELECTOR, ".el-table__body-wrapper")
    except Exception:
        return False

    if previo and nuevo == previo:
        try:
            WebDriverWait(driver, timeout).until(lambda d: d.find_element(By.CSS_SELECTOR, ".el-table__body-wrapper") != previo)
            return True
        except Exception:
            return False
    return True


def seleccionar_opcion_resource_status(driver, wait, opcion: str) -> None:
    """
    Selecciona Camera / IP Speaker / Encoding Device dentro de Resource Status
    de forma robusta.
    """

    print(f"[6] Seleccionando {opcion}...")

    opcion_normalizada = _normalize_label(opcion)
    mapa_opciones = {
        "camera": "Camera",
        "ip speaker": "IP Speaker",
        "encoding device": "Encoding Device",
    }
    etiqueta_objetivo = mapa_opciones.get(opcion_normalizada)
    if etiqueta_objetivo is None:
        raise Exception(f"Opción de recurso desconocida: {opcion}")

    wait_loading_end(driver)
    _switch_to_resource_iframe(driver)

    tabla_previa = None
    try:
        tabla_previa = driver.find_element(By.CSS_SELECTOR, ".el-table__body-wrapper")
    except Exception:
        tabla_previa = None

    encontrados: list[str] = []

    def registrar_candidatos(elems):
        for e in elems:
            try:
                texto = e.text.strip() or e.get_attribute("title") or ""
            except Exception:
                texto = ""
            if texto:
                encontrados.append(texto)

    try:
        # Estrategia A: tabs/botones visibles
        estrategias_tabs = [
            "//div[contains(@class,'tab') or contains(@class,'tabs')]//div[contains(@class,'tab') or self::button]",
            "//div[contains(@class,'el-tabs__header')]//div[contains(@class,'el-tabs__item')]",
            "//button[contains(@class,'tab') or contains(@class,'el-button')]",
        ]
        for xp in estrategias_tabs:
            try:
                elems = driver.find_elements(By.XPATH, xp)
            except Exception:
                continue
            elems = [e for e in elems if e.is_displayed()]
            registrar_candidatos(elems)
            for elem in elems:
                if _element_matches(elem, _normalize_label(etiqueta_objetivo)):
                    safe_click(driver, elem)
                    wait_loading_end(driver)
                    if _validar_recurso_seleccionado(driver, etiqueta_objetivo) or _esperar_refresco_contenido(driver, tabla_previa):
                        print(f"[6] Recurso seleccionado por pestaña/botón: {etiqueta_objetivo}")
                        return

        # Estrategia B: dropdown de Resource Type / Resource
        selectores_dropdown = [
            "//label[contains(translate(normalize-space(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'resource')]/following::div[contains(@class,'el-select')][1]",
            "//div[contains(@class,'el-select') and .//span[contains(translate(normalize-space(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'resource')]]",
            "//div[contains(@class,'el-select') and not(contains(@class,'is-disabled'))]",
        ]

        for xp in selectores_dropdown:
            try:
                dropdowns = driver.find_elements(By.XPATH, xp)
            except Exception:
                continue
            dropdowns = [d for d in dropdowns if d.is_displayed()]
            registrar_candidatos(dropdowns)
            for dd in dropdowns:
                safe_click(driver, dd)
                time.sleep(0.2)
                wait_loading_end(driver)
                opcion_elem, candidatos = find_click_by_text(driver, wait, etiqueta_objetivo)
                encontrados.extend(candidatos)
                if opcion_elem:
                    safe_click(driver, opcion_elem)
                    wait_loading_end(driver)
                    if _validar_recurso_seleccionado(driver, etiqueta_objetivo) or _esperar_refresco_contenido(driver, tabla_previa):
                        print(f"[6] Recurso seleccionado desde dropdown: {etiqueta_objetivo}")
                        return

        # Estrategia C: menú/lateral/lista
        lista_selectores = [
            "//ul[contains(@class,'menu') or contains(@class,'el-menu')]//li",
            "//div[contains(@class,'list') or contains(@class,'menu')]//div[contains(@class,'item') or self::li]",
            "//div[contains(@class,'side') or contains(@class,'left')]//li",
        ]
        for xp in lista_selectores:
            try:
                elems = driver.find_elements(By.XPATH, xp)
            except Exception:
                continue
            elems = [e for e in elems if e.is_displayed()]
            registrar_candidatos(elems)
            for elem in elems:
                if _element_matches(elem, _normalize_label(etiqueta_objetivo)):
                    safe_click(driver, elem)
                    wait_loading_end(driver)
                    if _validar_recurso_seleccionado(driver, etiqueta_objetivo) or _esperar_refresco_contenido(driver, tabla_previa):
                        print(f"[6] Recurso seleccionado desde menú/lateral: {etiqueta_objetivo}")
                        return

        opcion_elem, candidatos_extra = find_click_by_text(driver, wait, etiqueta_objetivo)
        encontrados.extend(candidatos_extra)
        if opcion_elem:
            safe_click(driver, opcion_elem)
            wait_loading_end(driver)
            if _validar_recurso_seleccionado(driver, etiqueta_objetivo) or _esperar_refresco_contenido(driver, tabla_previa):
                print(f"[6] Recurso seleccionado: {etiqueta_objetivo}")
                return

        print(f"[ERROR] No se encontró la opción solicitada: {etiqueta_objetivo}")
        if encontrados:
            print("[DEBUG] Candidatos visibles:", encontrados[:10])
        raise Exception(
            f"No se pudo hacer clic en la opción '{etiqueta_objetivo}' del menú Resource Status"
        )
    except Exception as exc:
        if encontrados:
            print(f"[DEBUG] Opción solicitada: {etiqueta_objetivo}. Candidatos: {encontrados[:10]}")
        try:
            downloads_dir = DOWNLOAD_DIR
            downloads_dir.mkdir(parents=True, exist_ok=True)
            driver.save_screenshot(str(downloads_dir / "debug_select_resource_error.png"))
        except Exception:
            pass
        raise Exception(
            f"No se pudo hacer clic en la opción '{etiqueta_objetivo}' del menú Resource Status"
        ) from exc


def seleccionar_camera(driver, wait):
    seleccionar_opcion_resource_status(driver, wait, "Camera")


def esperar_tabla_resource_status(driver, wait, opcion: str, timeout: int = 30):
    """
    Espera a que la tabla de la opción seleccionada esté lista:
    - con filas, o
    - con el mensaje de tabla vacía.
    """
    print(f"[7] Esperando que cargue la tabla de {opcion}...")

    def tabla_cargada(d):
        try:
            wrapper = d.find_element(By.CSS_SELECTOR, ".el-table__body-wrapper")
        except Exception:
            return False

        filas = wrapper.find_elements(By.CSS_SELECTOR, "tbody tr")
        empty = d.find_elements(By.CSS_SELECTOR, ".el-table__empty-block")
        return len(filas) > 0 or len(empty) > 0

    wait.until(tabla_cargada)

    if step_timer:
        step_timer.mark(f"[7] Tabla recursos cargada ({opcion})")


def encontrar_boton_export(driver, wait):
    """
    Devuelve el WebElement del botón 'Export' en la barra de herramientas
    de la vista actual (Camera, Encoding Device, etc.).
    Intenta primero el selector original que ya funcionaba para Camera
    y luego prueba selectores más genéricos.
    """
    # 1) INTENTO PRINCIPAL: usar EXACTAMENTE el mismo selector/XPATH
    #    que hoy se usa en este archivo (o que se usaba en export_camera_status_to_excel).
    try:
        boton = wait.until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//div[contains(@class,'access-statics')]"
                    "//div[contains(@class,'resource') and contains(@class,'left')]"
                    "//button[@title='Export']"
                    "//div[contains(@class,'el-button-slot-wrapper') and normalize-space()='Export']/ancestor::button[1]",
                )
            )
        )
        return boton
    except TimeoutException:
        pass

    # 2) INTENTO GENÉRICO 1: toolbar + icono export + texto Export
    xpath_opcion1 = (
        "//div[contains(@class,'toolbar') or contains(@class,'hik-toolbar') or contains(@class,'tool-bar')]"
        "//span[contains(@class,'el-button-wrapper')]"
        "[.//i[contains(@class,'h-icon-export')] and .//div[normalize-space(text())='Export']]"
    )

    try:
        boton = wait.until(
            EC.element_to_be_clickable((By.XPATH, xpath_opcion1))
        )
        return boton
    except TimeoutException:
        pass

    # 3) INTENTO GENÉRICO 2: cualquier botón Export visible
    xpath_opcion2 = (
        "//span[contains(@class,'el-button-wrapper')]"
        "[.//div[contains(@class,'el-button-slot-wrapper') and normalize-space(text())='Export']]"
    )

    boton = wait.until(
        EC.presence_of_element_located((By.XPATH, xpath_opcion2))
    )
    return boton


def _buscar_export_camera_en_contexto(driver):
    xpaths = [
        "//button[@title='Export' and not(@disabled)]",
        "//button[.//i[contains(@class,'icomoon-common_export')] and not(@disabled)]",
        "//*[self::button or self::span][@title='Export']",
        "(//div[contains(@class,'top') or contains(@class,'toolbar') or contains(@class,'tool-bar') or contains(@class,'header')]//*[contains(@class,'export') and (self::button or self::span or self::i or self::div)])[1]",
    ]

    for xpath in xpaths:
        try:
            elems = driver.find_elements(By.XPATH, xpath)
        except Exception:
            continue
        for elem in elems:
            try:
                if not elem.is_displayed():
                    continue
            except Exception:
                continue
            return elem
    return None


def encontrar_boton_export_camera(driver, wait):
    boton = _buscar_export_camera_en_contexto(driver)
    if boton:
        return boton

    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    boton = _buscar_export_camera_en_contexto(driver)
    if boton:
        return boton

    try:
        _switch_to_resource_iframe(driver)
    except Exception:
        pass

    boton = _buscar_export_camera_en_contexto(driver)
    if boton:
        return boton

    raise TimeoutException("No se encontró el botón Export para Camera")


def _buscar_modal_export_visible(driver):
    candidatos = []
    selectores_modal = [
        "//div[contains(@class,'el-drawer__wrapper') or contains(@class,'drawer')]",
        "//div[contains(@class,'el-dialog__wrapper') or contains(@class,'el-dialog')]",
        "//*[contains(@class,'drawer') or contains(@class,'dialog')][.//*[normalize-space()='Export' or contains(normalize-space(),'Export')]]",
    ]

    for xp in selectores_modal:
        try:
            elementos = driver.find_elements(By.XPATH, xp)
        except Exception:
            continue
        for elem in elementos:
            try:
                if not elem.is_displayed():
                    continue
                if not elem.find_elements(
                    By.XPATH,
                    ".//*[contains(@class,'drawer-head-title') or contains(@class,'el-dialog__title') or self::h1 or self::h2 or self::h3 or self::span][contains(normalize-space(),'Export')]",
                ):
                    continue
                candidatos.append(elem)
            except Exception:
                continue

    if candidatos:
        return candidatos[-1]
    return None


def _asegurar_checkbox_exception_data(driver, modal_export):
    checkbox_xpath = (
        ".//label[contains(@class,'el-checkbox') and .//*[contains(normalize-space(),'Export Exception Data')]]"
        "| .//*[contains(@class,'el-checkbox') and .//*[contains(normalize-space(),'Export Exception Data')]]"
    )
    try:
        candidatos = modal_export.find_elements(By.XPATH, checkbox_xpath)
    except Exception:
        candidatos = []

    if not candidatos:
        print("[EXPORT] Checkbox Export Exception Data no visible; se continúa.")
        return

    checkbox = candidatos[0]
    marcado = False
    try:
        clases = checkbox.get_attribute("class") or ""
        marcado = "is-checked" in clases
    except Exception:
        marcado = False

    if not marcado:
        try:
            input_box = checkbox.find_element(By.XPATH, ".//input[@type='checkbox']")
            marcado = input_box.is_selected() or (input_box.get_attribute("checked") is not None)
        except Exception:
            marcado = False

    if marcado:
        print("[EXPORT] Checkbox Export Exception Data ya marcado")
        return

    click_robusto(driver, checkbox)
    print("[EXPORT] Checkbox Export Exception Data marcado")


def _asegurar_excel_en_modal_export(driver, modal_export):
    excel_xpath = (
        ".//label[contains(@class,'el-radio') and (.//span[normalize-space()='Excel'] or contains(@title,'Excel'))]"
        "| .//*[contains(@class,'el-radio') and (.//span[normalize-space()='Excel'] or contains(normalize-space(),'Excel'))]"
    )
    try:
        radios_excel = modal_export.find_elements(By.XPATH, excel_xpath)
    except Exception:
        radios_excel = []

    if not radios_excel:
        raise TimeoutException("No se encontró opción Excel en el modal Export")

    radio_excel = radios_excel[0]
    seleccionado = False
    try:
        clases = radio_excel.get_attribute("class") or ""
        seleccionado = "is-checked" in clases
    except Exception:
        seleccionado = False

    if not seleccionado:
        try:
            radio_input = radio_excel.find_element(By.XPATH, ".//input[@type='radio']")
            seleccionado = radio_input.is_selected() or (radio_input.get_attribute("checked") is not None)
        except Exception:
            seleccionado = False

    if seleccionado:
        print("[EXPORT] Excel ya seleccionado")
        return

    click_robusto(driver, radio_excel)
    print("[EXPORT] Excel seleccionado")


def _click_boton_final_export_modal(driver, modal_export):
    boton_xpath = (
        "(.//button[.//div[normalize-space()='Export'] or .//span[normalize-space()='Export'] or normalize-space()='Export'])[last()]"
        "| (.//*[contains(@class,'el-dialog__footer') or contains(@class,'drawer-footer')]"
        "//button[.//div[normalize-space()='Export'] or .//span[normalize-space()='Export'] or normalize-space()='Export'])[last()]"
    )
    botones = modal_export.find_elements(By.XPATH, boton_xpath)
    botones = [b for b in botones if b.is_displayed()]
    if not botones:
        raise TimeoutException("No se encontró el botón final Export dentro del modal")

    click_robusto(driver, botones[-1])
    print("[EXPORT] Click en botón final Export")


def abrir_y_confirmar_exportacion_resource_status(driver, wait, opcion: str | None = None):
    print(f"[EXPORT] Opción detectada: {opcion or 'N/A'}")
    wait_loading_overlays(driver, timeout=60)

    print(f"[EXPORT] Buscando botón Export de la vista {opcion or 'actual'}")

    try:
        export_toolbar_button = (
            encontrar_boton_export_camera(driver, wait)
            if opcion == "Camera"
            else encontrar_boton_export(driver, wait)
        )
    except Exception:
        export_toolbar_button = encontrar_boton_export(driver, wait)

    click_robusto(driver, export_toolbar_button)
    print("[EXPORT] Click en toolbar export")

    wait_loading_overlays(driver, timeout=60)
    modal_export = wait.until(lambda d: _buscar_modal_export_visible(d))
    print("[EXPORT] Modal Export visible")

    _asegurar_checkbox_exception_data(driver, modal_export)
    _asegurar_excel_en_modal_export(driver, modal_export)
    wait_loading_overlays(driver, timeout=30)
    _click_boton_final_export_modal(driver, modal_export)
    wait_loading_overlays(driver, timeout=60)


def export_resource_status_to_excel(
    driver: webdriver.Chrome,
    wait: WebDriverWait,
    download_dir: Path,
    opcion: str,
) -> Path:
    """
    Navega a Maintenance -> Resource Status -> <opcion>,
    abre el panel Export, selecciona Excel, hace clic en Export
    y espera al archivo descargado en download_dir.
    Devuelve la ruta final del .xlsx.
    """

    print("[NAV] Entrando a Maintenance")
    ir_a_pestana_maintenance(driver, wait)
    abrir_opcion_resource_status(driver, wait, opcion)
    esperar_tabla_resource_status(driver, wait, opcion)

    archivos_previos = os.listdir(download_dir)
    abrir_y_confirmar_exportacion_resource_status(driver, wait, opcion=opcion)

    if step_timer:
        step_timer.mark(f"[8] Export confirmado ({opcion})")

    print("[EXPORT] Esperando descarga")
    archivo_descargado = esperar_descarga(download_dir, archivos_previos, timeout=180)
    print(f"[EXPORT] Archivo detectado: {os.path.basename(archivo_descargado)}")

    if step_timer:
        step_timer.mark("[10] Archivo descargado")
    return Path(archivo_descargado)


def export_camera_status_to_excel(driver: webdriver.Chrome, wait: WebDriverWait, download_dir: Path = DOWNLOAD_DIR):
    """
    Ejecuta el flujo completo de exportación de cámaras a Excel desde la pestaña Camera
    en Resource Status.
    """

    return export_resource_status_to_excel(driver, wait, download_dir, "Camera")



def cerrar_sesion(driver):
    """Cierra sesión de forma tolerante a fallos."""

    cerrado_ok = logout_hikcentral(driver, timeout=8, log_warn=print, log_info=print)
    if not cerrado_ok:
        print("[WARN] Logout UI no disponible; se limpiará el navegador antes de cerrar.")
        cleanup_browser(driver)

def run():
    global step_timer, performance_recorder
    parser = argparse.ArgumentParser(
        description="Exportar opciones de Resource Status a Excel en HikCentral."
    )
    parser.add_argument(
        "--option",
        "-o",
        dest="opcion",
        default="Camera",
        help="Nombre de la opción dentro de Resource Status (ej: 'Camera', 'Encoding Device').",
    )
    args = parser.parse_args()
    opcion = args.opcion

    performance_recorder = PerformanceRecorder(time.perf_counter())

    baseline_cpu = psutil.cpu_percent(interval=1)
    registrar_cpu(baseline_cpu)
    baseline_ram = psutil.virtual_memory().percent
    print(f"[PERF] [0] Baseline antes de automatizar... CPU: {baseline_cpu:.1f}% | RAM: {baseline_ram:.1f}%")
    if performance_recorder:
        performance_recorder.record_baseline(baseline_cpu, baseline_ram)

    driver = None
    step_timer = StepTimer(
        start_time=performance_recorder.start_time if performance_recorder else None,
        recorder=performance_recorder,
    )
    timer = step_timer
    try:
        driver = crear_driver()
        wait = WebDriverWait(driver, 30)

        print(f"[DEBUG] DOWNLOAD_DIR = {DOWNLOAD_DIR}")
        print("[1] Navegando a la URL...")
        driver.get(URL)
        if timer:
            timer.mark("[1] Navegando a la URL")

        # ========================
        # LOGIN
        # ========================
        print("[2] Iniciando sesión...")

        # Campo usuario (por placeholder 'User Name')
        user_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="User Name"]'))
        )
        password_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="Password"]'))
        )

        user_input.clear()
        user_input.send_keys(HIK_USER)

        password_input.clear()
        password_input.send_keys(HIK_PASSWORD)

        # Botón Log In (texto 'Log In')
        login_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Log In']"))
        )
        login_button.click()
        if timer:
            timer.mark("[2] Login")

        # ========================
        # ESPERAR PORTAL PRINCIPAL
        # ========================
        print("[3] Esperando carga del portal principal...")

        # Esperar a que la URL cambie a /portal (login exitoso)
        wait.until(lambda d: "/portal" in d.current_url)
        if timer:
            timer.mark("[3] Portal principal cargado")

        ir_a_pestana_maintenance(driver, wait)

        try:
            limpiar_descargas(DOWNLOAD_DIR)
            archivo_descargado = export_resource_status_to_excel(
                driver, wait, DOWNLOAD_DIR, opcion
            )

            if timer:
                timer.mark("[8] Export completado")

            print(f"[OK] Export de '{opcion}' completado.")

            archivo_procesar = None

            if opcion.lower() == "camera":
                ultimo_archivo = encontrar_ultimo_archivo("Camera_", ".xlsx")
                archivo_procesar = ultimo_archivo or archivo_descargado

                if archivo_procesar:
                    process_camera_resource_status(str(archivo_procesar))

            elif opcion.lower() == "encoding device":
                archivo_procesar = encontrar_ultimo_archivo(
                    "Encoding Device_", ".xlsx"
                )
                if archivo_procesar:
                    process_encoding_device_status(str(archivo_procesar))
                else:
                    print(
                        "[ERROR] No se encontró archivo de Encoding Device para procesar."
                    )

            elif opcion.lower() == "ip speaker":
                archivo_procesar = encontrar_ultimo_archivo(
                    "IP Speaker_", ".xlsx"
                )
                if archivo_procesar:
                    process_ip_speaker_status(str(archivo_procesar))
                else:
                    print(
                        "[ERROR] No se encontró archivo de IP Speaker para procesar."
                    )

            elif opcion.lower() == "alarm input":
                archivo_procesar = encontrar_ultimo_archivo(
                    "Alarm Input_", ".xlsx"
                )
                if archivo_procesar:
                    process_alarm_input_status(str(archivo_procesar))
                else:
                    print(
                        "[ERROR] No se encontró archivo de Alarm Input para procesar."
                    )

            if timer:
                timer.mark("[FIN] Script completo")
        except Exception as e:
            print(f"[ERROR] Ocurrió un problema en la exportación de '{opcion}': {e}")
            if timer:
                timer.mark("[ERROR] Fin por excepción")
            raise

    except Exception as e:
        print(f"[ERROR] Ocurrió un problema en la exportación de '{opcion}': {e.__class__.__name__}: {e}")
        traceback.print_exc()
        if timer:
            timer.mark("[ERROR] Fin por excepción")
    finally:
        if driver:
            try:
                cerrar_sesion(driver)
            finally:
                safe_quit(driver, log_warn=print)

        final_cpu = psutil.cpu_percent(interval=1)
        final_ram = psutil.virtual_memory().percent
        registrar_cpu(final_cpu)
        if performance_recorder:
            performance_recorder.update_cpu(final_cpu)
        print(f"[PERF] [FIN] Estado al terminar script... CPU: {final_cpu:.1f}% | RAM: {final_ram:.1f}%")

        duracion_total_seg = (
            time.perf_counter() - performance_recorder.start_time
            if performance_recorder
            else 0.0
        )

        registrar_ejecucion_y_pasos(
            opcion=opcion,
            duracion_total_seg=duracion_total_seg,
            cpu_final=final_cpu,
            ram_final=final_ram,
            recorder=performance_recorder,
        )


if __name__ == "__main__":
    run()
