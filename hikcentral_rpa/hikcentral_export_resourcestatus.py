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
from selenium.webdriver import ActionChains
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
URL = "https://172.16.9.253/#"
SCRIPT_NAME = "hikcentral_export_resourcestatus.py"
HIK_USER = os.getenv("HIK_USER", "Analitica_reportes")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "AbcDef*91Ghj#")

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
    from datetime import datetime

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
        conn = None
        cur = None
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
                "Device Address": "device_address",
                "Area": "site_name",
                "Device Model": "device_model",
                "Network Status": "network_status",
                "Video Signal": "video_signal",
                "Recording Status": "recording_status",
                "Auto-Check Time": "auto_check_time",
            },
            inplace=True,
        )

        df["auto_check_time"] = pd.to_datetime(df["auto_check_time"], errors="coerce")
        df["auto_check_time"] = df["auto_check_time"].where(
            df["auto_check_time"].notna(), None
        )

        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'hik_camera_resource_status'
            """
        )
        db_columns = {row[0] for row in cur.fetchall()}
        cur.close()
        cur = None

        possible_mappings = {
            "camera_name": ["camera_name"],
            "device_code": ["device_code"],
            "device_address": ["device_address", "ip_address"],
            "site_name": ["site_name"],
            "network_status": ["network_status", "online_status"],
            "video_signal": ["video_signal", "signal_status"],
            "recording_status": ["recording_status", "record_status"],
            "auto_check_time": ["auto_check_time", "last_online_time"],
            "device_model": ["device_model"],
        }

        insert_columns: list[str] = []
        df_columns: list[str] = []

        for df_col, candidates in possible_mappings.items():
            if df_col not in df.columns:
                continue
            target = next((c for c in candidates if c in db_columns), None)
            if target:
                insert_columns.append(target)
                df_columns.append(df_col)

        for key in ("camera_name", "device_code"):
            if key not in df_columns and key in df.columns and key in db_columns:
                insert_columns.insert(0, key)
                df_columns.insert(0, key)

        if "camera_name" not in insert_columns or "device_code" not in insert_columns:
            print(
                "[ERROR] La tabla hik_camera_resource_status no tiene columnas camera_name y device_code compatibles."
            )
            return

        df_for_db = df[df_columns].copy()
        df_for_db = df_for_db.replace({np.nan: None})
        df_for_db = df_for_db.where(df_for_db.notna(), None)
        records = df_for_db.to_dict(orient="records")

        if not records:
            print("[INFO] No hay registros de cámaras para insertar/actualizar.")
            return

        cols_sql = ", ".join(insert_columns + ["updated_at"])
        vals_sql = ", ".join([f"%({c})s" for c in df_columns] + ["NOW()"])

        update_cols = [c for c in insert_columns if c not in ("camera_name", "device_code")]
        set_sql = ", ".join([f"{c} = EXCLUDED.{c}" for c in update_cols] + ["updated_at = NOW()"])

        sql = f"""
            INSERT INTO hik_camera_resource_status (
                {cols_sql}
            )
            VALUES (
                {vals_sql}
            )
            ON CONFLICT (camera_name, device_code)
            DO UPDATE SET
                {set_sql};
        """

        try:
            with conn:
                with conn.cursor() as cur_db:
                    execute_batch(cur_db, sql, records, page_size=500)
        except Exception as db_error:
            print(f"[ERROR] No se pudieron insertar/actualizar las cámaras: {db_error}")
            traceback.print_exc()
            return

        print(f"[INFO] Cámaras insertadas/actualizadas: {len(records)}")

    except Exception as e:
        print(f"[ERROR] Error al procesar el archivo de cámaras: {e}")
        traceback.print_exc()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


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

def seleccionar_opcion_resource_status(driver, wait, opcion: str):
    """
    Abre la opción indicada (por ejemplo: "Camera", "Encoding Device", "IP Speaker")
    dentro de Resource Status.

    Estrategia:
      1) Intentar usar el menú lateral "Resource Status".
      2) Si no se encuentra la opción ahí, usar el panel de "Recently visited"
         con elementos <div class="recently-visited-menu" title="...">.
    """

    try:
        # 1) Intentar expandir el menú lateral "Resource Status"
        submenu_li = None
        try:
            span_resource = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "//span[@id='subMenuTitle2' and normalize-space()='Resource Status']",
                    )
                )
            )
            submenu_li = span_resource.find_element(
                By.XPATH, "./ancestor::li[contains(@class,'el-submenu')]"
            )

            # Si el submenú no está abierto, haz clic para expandirlo
            submenu_classes = submenu_li.get_attribute("class") or ""
            if "is-opened" not in submenu_classes:
                span_resource.click()
        except TimeoutException:
            # Si no se encuentra el menú lateral, pasamos al plan B
            submenu_li = None

        # 2) Buscar la opción en el menú lateral expandido
        if submenu_li is not None:
            try:
                opcion_element = wait.until(
                    EC.element_to_be_clickable(
                        (
                            By.XPATH,
                            (
                                "//li[contains(@class,'el-submenu')"
                                "  and .//span[@id='subMenuTitle2']]"
                                f"//li[contains(@class,'el-menu-item') and @title='{opcion}']"
                            ),
                        )
                    )
                )
                driver.execute_script(
                    "arguments[0].scrollIntoView({block: 'center'});",
                    opcion_element,
                )
                ActionChains(driver).move_to_element(opcion_element).click().perform()
                print(f"[5] Opción Resource Status seleccionada (menú lateral): {opcion}")
                return
            except TimeoutException:
                # Si la opción no está en el menú lateral, seguir al plan B
                pass

        # 3) Plan B: usar el panel "Recently visited" / Quick Start
        #    Usa los <div class="recently-visited-menu" title="...">
        opcion_quick = wait.until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    f"div.recently-visited-menu[title='{opcion}']",
                )
            )
        )
        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center'});", opcion_quick
        )
        ActionChains(driver).move_to_element(opcion_quick).click().perform()
        print(f"[5] Opción Resource Status seleccionada (Quick Start): {opcion}")

    except Exception as exc:
        # Mantén el mismo mensaje de error que usa el script actualmente
        raise Exception(
            f"No se pudo hacer clic en la opción '{opcion}' del menú Resource Status"
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
