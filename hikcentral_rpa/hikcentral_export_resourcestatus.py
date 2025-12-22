import argparse
import os
import re
import time
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
    TimeoutException,
)
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


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
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "SW2112asm")

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

    try:
        df = pd.read_excel(excel_file, sheet_name="Camera", header=7)
        df = df[df["Name"].notna()].copy()
        df = df[
            [
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
        ].copy()

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
                "Auto-Check Time": "last_online_time",
            },
            inplace=True,
        )

        df["last_online_time"] = pd.to_datetime(df["last_online_time"], errors="coerce")
        df["last_online_time"] = df["last_online_time"].where(
            df["last_online_time"].notna(), None
        )

        def normalize_online_status(value):
            if value is None or (isinstance(value, float) and np.isnan(value)):
                return None
            value_str = str(value).strip()
            if not value_str:
                return None
            if value_str.lower() == "online":
                return "ONLINE"
            if value_str.lower() == "offline":
                return "OFFLINE"
            return value_str.upper()

        df["online_status"] = df["online_status"].apply(normalize_online_status)

        records: list[dict] = []
        for _, row in df.iterrows():
            device_code = str(row.get("device_code") or "").strip()
            if not device_code:
                continue

            records.append(
                {
                    "camera_name": (row.get("camera_name") or "").strip(),
                    "device_code": device_code,
                    "site_name": (row.get("site_name") or "").strip(),
                    "device_type": (row.get("device_type") or "").strip(),
                    "online_status": row.get("online_status"),
                    "record_status": (row.get("record_status") or "").strip(),
                    "signal_status": (row.get("signal_status") or "").strip(),
                    "last_online_time": row.get("last_online_time"),
                    "ip_address": (row.get("ip_address") or "").strip(),
                }
            )

        if not records:
            print("[INFO] No hay registros de cámaras para insertar/actualizar.")
            return

        sql = """
            INSERT INTO PUBLIC.HIK_CAMERA_RESOURCE_STATUS (
                CAMERA_NAME, DEVICE_CODE, SITE_NAME, DEVICE_TYPE, ONLINE_STATUS, RECORD_STATUS, SIGNAL_STATUS, LAST_ONLINE_TIME, IP_ADDRESS, CREATED_AT, UPDATED_AT
            )
            SELECT
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

        try:
            conn = get_pg_connection()
            with conn:
                with conn.cursor() as cur:
                    execute_batch(cur, sql, records, page_size=500)
            print(f"[INFO] Cámaras insertadas/actualizadas: {len(records)}")
        except Exception as db_error:
            print(f"[ERROR] No se pudieron insertar/actualizar las cámaras: {db_error}")
            traceback.print_exc()
        finally:
            if 'conn' in locals() and conn:
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


def abrir_menu_resource_status(driver, wait):
    print("[5] Abriendo menú Resource Status...")

    locators = [
        (By.ID, "subMenuTitle1"),  # Nuevo ambiente
        (By.ID, "subMenuTitle2"),  # Ambiente anterior
        (
            By.XPATH,
            "//span[@title='Resource Status' and contains(@class,'first-level-weight')]",
        ),
        (
            By.XPATH,
            "//i[contains(@class,'icon-svg-nav_realtime_status_resources')]"
            "/ancestor::div[contains(@class,'el-submenu__title')][1]",
        ),
    ]

    local_wait = WebDriverWait(driver, 45)

    def intentar_click_resource_status(d):
        for by, selector in locators:
            try:
                elem = EC.element_to_be_clickable((by, selector))(d)
            except Exception:
                continue

            if not elem:
                continue

            try:
                d.execute_script("arguments[0].scrollIntoView({block: 'center'});", elem)
                try:
                    elem.click()
                except Exception:
                    d.execute_script("arguments[0].click();", elem)
                return True
            except Exception:
                continue

        return False

    try:
        local_wait.until(intentar_click_resource_status)
        if step_timer:
            step_timer.mark("[5] Menú Resource Status")
    except TimeoutException:
        raise Exception("No se pudo hacer clic en el menú 'Resource Status'")


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


def wait_loading_end(driver, timeout: int = 15):
    overlays = [
        (By.CSS_SELECTOR, ".el-loading-mask"),
        (By.CSS_SELECTOR, ".el-loading-spinner"),
        (By.CSS_SELECTOR, "div.loading-mask"),
        (By.CSS_SELECTOR, "div.hik-loader, div.hik-loading"),
    ]
    end_time = time.time() + timeout
    while time.time() < end_time:
        visible = False
        for by, selector in overlays:
            try:
                elems = driver.find_elements(by, selector)
            except Exception:
                continue
            if any(e.is_displayed() for e in elems):
                visible = True
                break
        if not visible:
            return
        time.sleep(0.5)


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

    abrir_menu_resource_status(driver, wait)
    seleccionar_opcion_resource_status(driver, wait, opcion)
    esperar_tabla_resource_status(driver, wait, opcion)

    print(f"[8] Abriendo panel de exportación desde {opcion}...")

    if step_timer:
        step_timer.mark(f"[8] Panel exportación ({opcion})")

    archivos_previos = os.listdir(download_dir)
    
    export_toolbar_button = encontrar_boton_export(driver, wait)

    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", export_toolbar_button)
    driver.execute_script("arguments[0].click();", export_toolbar_button)

    wait.until(
        EC.visibility_of_element_located(
            (
                By.XPATH,
                "//div[contains(@class,'drawer')]//span[contains(@class,'drawer-head-title') and normalize-space()='Export']",
            )
        )
    )

    if step_timer:
        step_timer.mark(f"[8] Panel exportación abierto ({opcion})")

    excel_options = driver.find_elements(
        By.XPATH,
        "//div[contains(@class,'drawer')]//label[contains(@class,'el-radio') and (translate(@title,'excel','EXCEL')='EXCEL' or .//span[normalize-space()='Excel'])]",
    )
    if excel_options:
        excel_option = wait.until(EC.element_to_be_clickable(excel_options[0]))
        driver.execute_script("arguments[0].click();", excel_option)

    export_confirm_button = wait.until(
        EC.element_to_be_clickable(
            (
                By.XPATH,
                "(//div[contains(@class,'drawer') or contains(@class,'el-dialog__footer')]//button[.//div[normalize-space()='Export']])[last()]",
            )
        )
    )
    driver.execute_script("arguments[0].click();", export_confirm_button)

    if step_timer:
        step_timer.mark(f"[8] Export lanzado ({opcion})")

    archivo_descargado = esperar_descarga(download_dir, archivos_previos, timeout=180)
    print(f"[10] Archivo descargado en: {archivo_descargado}")

    if step_timer:
        step_timer.mark("[10] Archivo descargado")
    return Path(archivo_descargado)


def export_camera_status_to_excel(driver: webdriver.Chrome, wait: WebDriverWait, download_dir: Path = DOWNLOAD_DIR):
    """
    Ejecuta el flujo completo de exportación de cámaras a Excel desde la pestaña Camera
    en Resource Status.
    """

    return export_resource_status_to_excel(driver, wait, download_dir, "Camera")


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
            driver.quit()

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
