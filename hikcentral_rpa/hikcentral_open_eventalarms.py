import argparse
import os
import time
import traceback
from datetime import datetime
import hashlib
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

import pandas as pd
import numpy as np
import psutil
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.common.exceptions import TimeoutException as SeleniumTimeout
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


class PerformanceRecorder:
    def __init__(self, start_time: float | None = None):
        self.start_time = start_time if start_time is not None else time.perf_counter()
        self.steps: list[dict] = []
        self.cpu_max: float | None = None
        self.proc = psutil.Process(os.getpid())

    def _parse_step_label(self, label: str) -> tuple[int | None, str]:
        import re

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
            return {
                "filas_extraidas": total_preparados,
                "insertados": total_insertados,
                "omitidos_duplicado": total_omitidos,
            }

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
        self.proc = psutil.Process(os.getpid())

    def mark(self, label: str):
        now = time.perf_counter()
        step_secs = now - self.last
        total_secs = now - self.start

        cpu_percent = psutil.cpu_percent(interval=0.1)
        registrar_cpu(cpu_percent)
        mem = psutil.virtual_memory()
        mem_percent = mem.percent
        proc_mem_mb = self.proc.memory_info().rss / (1024**2)

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


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)

DEFAULT_HOSTS = ["172.16.9.10", "172.16.9.11"]
URL = ""
SCRIPT_NAME = "hikcentral_open_eventalarms.py"
HIK_USER = os.getenv("HIK_USER", "Analitica_reportes")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "SW2112asm")

LOG_DIR = Path(r"C:\\portal-sw\\SecurityWorld\\hikcentral_rpa\\logs")
DOWNLOAD_DIR = Path(r"C:\\portal-sw\\SecurityWorld\\hikcentral_rpa\\downloads")


def host_is_up(host: str, timeout: float = 2.5) -> bool:
    url = f"http://{host}/"
    request = Request(url, method="GET")
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status < 500
    except (HTTPError, URLError, TimeoutError, OSError):
        return False


def resolve_hik_host(cli_host: str | None) -> tuple[str, str]:
    if cli_host:
        return cli_host.strip(), "arg"

    env_host = os.getenv("HIK_HOST")
    if env_host and env_host.strip():
        return env_host.strip(), "env"

    env_hosts = os.getenv("HIK_HOSTS")
    if env_hosts:
        hosts = [h.strip() for h in env_hosts.split(",") if h.strip()]
    else:
        hosts = DEFAULT_HOSTS

    for host in hosts:
        if host_is_up(host):
            return host, "autodetect"
        print(f"[WARN] Host no responde: {host}")

    raise RuntimeError("Ningún host HikCentral disponible en HIK_HOSTS/DEFAULT_HOSTS")


def parse_hosts_from_env() -> list[str]:
    env_hosts = os.getenv("HIK_HOSTS")
    if env_hosts:
        return [h.strip() for h in env_hosts.split(",") if h.strip()]
    return DEFAULT_HOSTS


def parse_hosts_from_args(cli_host: str | None, cli_hosts: str | None) -> list[str]:
    if cli_host and cli_hosts:
        raise ValueError("Usa solo --host o --hosts, no ambos.")
    if cli_host:
        return [cli_host.strip()]
    if cli_hosts:
        return [h.strip() for h in cli_hosts.split(",") if h.strip()]
    return parse_hosts_from_env()


def get_downloadcenter_root() -> Path:
    user_home = Path(os.environ["USERPROFILE"])
    root = user_home / "HCWebControlService" / "Downloadcenter"
    return root


def take_screenshot(driver, label: str) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_path = LOG_DIR / f"{label}_{timestamp}.png"
    driver.save_screenshot(str(screenshot_path))
    print(f"[INFO] Screenshot guardado en: {screenshot_path}")
    return screenshot_path


def find_latest_alarm_report(download_dir: Path) -> Path | None:
    """
    Busca recursivamente en download_dir la última hoja de cálculo de Event & Alarm Search.
    HikCentral crea una carpeta 'Alarm_Report_YYYYMMDDHHMMSS' y dentro un archivo
    'Alarm_Report_YYYYMMDDHHMMSS.xlsx'.
    """
    base_dir = download_dir
    candidates: list[Path] = []

    for folder in base_dir.glob("Alarm_Report_*"):
        if folder.is_dir():
            for file in folder.glob("*.xls*"):
                candidates.append(file)

    if not candidates:
        return None

    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def find_last_alarm_report_file() -> Path | None:
    """
    Busca el último archivo Alarm_Report_* en la carpeta:
    C:/Users/<usuario>/HCWebControlService/Downloadcenter recorriendo subcarpetas.

    Devuelve un Path o None si no encuentra nada.
    """
    base_dir = get_downloadcenter_root()
    if not base_dir.exists():
        print(f"[ERROR] Carpeta de Downloadcenter no existe: {base_dir}")
        return None

    candidates: list[Path] = []
    for path in base_dir.rglob("*"):
        if not path.is_file():
            continue
        name = path.name
        if not name.startswith("Alarm_Report_"):
            continue
        if not name.lower().endswith((".xlsx", ".xls")):
            continue
        candidates.append(path)

    if not candidates:
        print("[ERROR] No se encontró ningún archivo Alarm_Report_* en Downloadcenter.")
        return None

    last_file = max(candidates, key=lambda p: p.stat().st_mtime)
    print(f"[INFO] Último Alarm_Report encontrado: {last_file}")
    return last_file


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


def crear_registro_extraccion(conn, archivo_nombre: str) -> int:
    """
    Inserta una fila en hik_alarm_extraccion con estado EN_PROCESO
    y devuelve el id generado.
    """
    log_info = globals().get("log_info", print)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.hik_alarm_extraccion (archivo_nombre)
            VALUES (%s)
            RETURNING id;
            """,
            (archivo_nombre,),
        )
        extraccion_id = cur.fetchone()[0]
    conn.commit()
    log_info(
        f"[EVENT] Creado registro hik_alarm_extraccion id={extraccion_id} para archivo {archivo_nombre}"
    )
    return extraccion_id


def normalize_ts(value):
    """
    Devuelve None si el valor es NaT/NaN/None.
    Si es un Timestamp de pandas, lo convierte a datetime nativo sin tz.
    Si es un datetime ya nativo, lo deja igual.
    """
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime().replace(tzinfo=None)
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    return value


def to_py(v):
    # Convierte nulos pandas/numpy a None y timestamps a datetime python
    if v is None:
        return None
    # pd.NA / NaN / NaT
    if pd.isna(v):
        return None
    # pandas Timestamp
    if isinstance(v, pd.Timestamp):
        return v.to_pydatetime()
    # numpy scalar -> python scalar
    if isinstance(v, (np.generic,)):
        return v.item()
    # strings: strip opcional
    if isinstance(v, str):
        s = v.strip()
        return s if s != "" else None
    return v


def calcular_periodo(value):
    """
    Calcula el periodo (YYYYMMDD) a partir de un valor de fecha/hora.
    Si el valor es NaT/NaN/None o no es una fecha válida, devuelve None.
    """
    if pd.isna(value):
        return None

    v = value
    if isinstance(v, pd.Timestamp):
        v = v.to_pydatetime().replace(tzinfo=None)
    elif isinstance(v, datetime):
        v = v.replace(tzinfo=None)
    else:
        try:
            v = pd.to_datetime(v).to_pydatetime().replace(tzinfo=None)
        except Exception:
            return None

    return int(v.strftime("%Y%m%d"))


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
        return id_ejecucion
    except Exception as e:
        print(f"[ERROR] No se pudo registrar el rendimiento en la base de datos: {e}")
        return None


def safe_click(driver, el):
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    try:
        el.click()
    except (ElementClickInterceptedException, StaleElementReferenceException):
        driver.execute_script("arguments[0].click();", el)


def safe_js_click(driver, el):
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    driver.execute_script("arguments[0].click();", el)


def _safe_js_click(driver, el):
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    driver.execute_script("arguments[0].click();", el)


def ir_a_event_and_alarm(driver, wait: WebDriverWait):
    """
    Abre el módulo 'Event and Alarm' usando el menú principal de HikCentral.
    1) Abre el popup de menús (navigation_addMenuBtn)
    2) Dentro de navigation_menuPop hace clic en la tarjeta Event and Alarm.
    """
    print("[3] Abriendo módulo Event and Alarm...")

    # Asegurar que estamos en el documento principal
    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    visible = False
    try:
        menu_pop = driver.find_element(By.ID, "navigation_menuPop")
        visible = menu_pop.is_displayed()
    except Exception:
        visible = False

    if not visible:
        menu_btn = wait.until(
            EC.element_to_be_clickable((By.ID, "navigation_addMenuBtn"))
        )
        driver.execute_script("arguments[0].click();", menu_btn)

    try:
        tile_xpath = (
            "//div[@id='navigation_menuPop']"
            "//div[contains(@id,'nav_box_s_menu_alarm_event')]"
            "//*[normalize-space()='Event and Alarm' or @title='Event and Alarm']"
        )
        tile = wait.until(EC.element_to_be_clickable((By.XPATH, tile_xpath)))
    except TimeoutException:
        tile_xpath = (
            "//div[@id='navigation_menuPop']"
            "//div[contains(@class,'nav-pop-quick-entry-list')]"
            "//*[normalize-space()='Event and Alarm' or @title='Event and Alarm']"
        )
        tile = wait.until(EC.element_to_be_clickable((By.XPATH, tile_xpath)))

    driver.execute_script("arguments[0].click();", tile)

    WebDriverWait(driver, 30).until(
        EC.presence_of_element_located(
            (
                By.XPATH,
                "//*[contains(normalize-space(),'Alarm Analysis') or contains(normalize-space(),'Alarm Trend')]",
            )
        )
    )


def wait_visible(driver, by, value, timeout=20):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def wait_click(driver, by, value, timeout=20):
    el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, value)))
    safe_click(driver, el)
    return el


# XPaths específicos para el diálogo Export de Event and Alarm Search
EXPORT_PASSWORD_INPUT_XPATH = (
    "//input[@type='password' and @placeholder='Password'"
    " and contains(@class,'el-input__inner')]"
)

EXPORT_SAVE_BUTTON_XPATH = (
    "("
    "//button[@title='Save'"
    "        and contains(@class,'el-button')"
    "        and contains(@class,'el-button--primary')"
    "        and .//div[contains(@class,'el-button-slot-wrapper')"
    "                 and normalize-space()='Save']"
    "]"
    ")[1]"
)


def type_export_password_if_needed(driver, timeout=8, timer=None):
    """
    Si el cuadro Export muestra el campo Password, escribe la misma
    contraseña HIK_PASSWORD usada en el login.
    Si no aparece el campo, continuar sin error.
    """
    wait = WebDriverWait(driver, timeout)

    logger_warn = globals().get("log_warn", print)
    logger_info = globals().get("log_info", print)

    try:
        pwd_input = wait.until(
            EC.visibility_of_element_located((By.XPATH, EXPORT_PASSWORD_INPUT_XPATH))
        )
    except TimeoutException:
        logger_warn(
            "[EXPORT] No apareció cuadro de password en Export, se asume que no es requerido."
        )
        return False

    pwd_input.click()
    pwd_input.clear()
    pwd_input.send_keys(HIK_PASSWORD)

    logger_info("[EXPORT] Password escrito correctamente en el cuadro Export.")
    return True


def click_export_save_button(driver, timeout=10, timer=None):
    """
    Hace clic en el botón Save del cuadro Export.
    Usa EXPORT_SAVE_BUTTON_XPATH, que apunta al <button> con título 'Save'
    y cuyo interior contiene el div.el-button-slot-wrapper con texto 'Save'.
    """
    step_name = "[7] CLICK_EXPORT_EVENT_AND_ALARM_SAVE_BUTTON"
    logger_info = globals().get("log_info", print)

    try:
        wait = WebDriverWait(driver, timeout)
        save_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, EXPORT_SAVE_BUTTON_XPATH))
        )

        logger_info("[EXPORT] Botón Save localizado, haciendo clic...")

        # A veces Selenium .click() falla por overlays; usa JS click como refuerzo.
        try:
            save_btn.click()
        except Exception:
            driver.execute_script("arguments[0].click();", save_btn)

        logger_info("[EXPORT] Botón Save del cuadro Export clickeado correctamente.")

        if timer is not None:
            timer.mark(step_name)

    except TimeoutException:
        log_error("[EXPORT] No se pudo localizar/clic el botón Save del cuadro Export (timeout).")
        raise


def cerrar_overlays(driver):
    posibles_overlays = [
        (By.CSS_SELECTOR, "button.close-button"),
        (By.CSS_SELECTOR, ".el-dialog__headerbtn"),
    ]
    for by, selector in posibles_overlays:
        try:
            elementos = driver.find_elements(by, selector)
            for el in elementos:
                if el.is_displayed():
                    safe_click(driver, el)
        except Exception:
            continue


def cerrar_buscador_global_si_abrio(driver):
    try:
        inp = driver.find_elements(By.XPATH, "//input[contains(@placeholder,'enter function')]")
        if inp:
            driver.switch_to.active_element.send_keys("\ue00c")  # ESC
    except Exception:
        pass


def handle_export_password_if_needed(driver, timeout: int = 8):
    """
    Si al exportar aparece un cuadro de diálogo pidiendo password,
    escribe la misma clave del login (HIK_PASSWORD) y hace clic en Confirm / OK.
    Si no aparece nada, sigue de largo sin lanzar excepción.
    """
    try:
        dialog = WebDriverWait(driver, timeout).until(
            EC.visibility_of_element_located(
                (
                    By.XPATH,
                    "//div[contains(@class,'el-message-box') and .//input[@type='password']]",
                )
            )
        )
        print("[7] Diálogo de contraseña de export detectado.")
    except TimeoutException:
        print("[7] No apareció diálogo de contraseña, continúo sin password.")
        return

    # input de password dentro del cuadro
    password_input = dialog.find_element(By.XPATH, ".//input[@type='password']")
    password_input.clear()
    password_input.send_keys(HIK_PASSWORD)

    # botón Confirm / OK dentro del mismo cuadro
    try:
        confirm_btn = dialog.find_element(
            By.XPATH, ".//button[.//span[normalize-space()='Confirm']]"
        )
    except Exception:
        confirm_btn = dialog.find_element(
            By.XPATH, ".//button[.//span[normalize-space()='OK']]"
        )

    safe_js_click(driver, confirm_btn)
    print("[7] Contraseña de export ingresada y confirmada.")


def handle_password_confirm_if_present(driver, timeout: int = 10):
    """
    Si aparece el diálogo de confirmación de contraseña al exportar,
    ingresa HIK_PASSWORD y confirma. Si no aparece, no lanza error.
    """
    try:
        wait = WebDriverWait(driver, timeout)

        dialog = wait.until(
            EC.visibility_of_element_located(
                (
                    By.XPATH,
                    "//*[contains(normalize-space(),'Confirm') and contains(normalize-space(),'Password')]/ancestor::div[contains(@class,'el-dialog') or contains(@class,'drawer-main')][1]",
                )
            )
        )

        pwd_input = dialog.find_element(By.XPATH, ".//input[@type='password' or @placeholder='Password']")

        pwd_input.clear()
        pwd_input.send_keys(HIK_PASSWORD)

        confirm_btn = dialog.find_element(
            By.XPATH,
            ".//button[.//span[normalize-space()='OK' or normalize-space()='Confirm' or normalize-space()='Aceptar']]",
        )

        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", confirm_btn)
        driver.execute_script("arguments[0].click();", confirm_btn)

        WebDriverWait(driver, timeout).until(EC.invisibility_of_element(dialog))

        print("[INFO] Diálogo de confirmación de password resuelto correctamente.")

    except SeleniumTimeout:
        print("[INFO] No apareció diálogo de confirmación de password, continúo.")
    except Exception as e:
        print(f"[WARN] Error manejando diálogo de password: {e}")


def click_sidebar_alarm_search(driver, timeout=20, timer: StepTimer | None = None):
    """
    Hace clic en el icono de lupa del menú lateral (Search).
    IMPORTANTE: esta función SOLO abre el panel de Search; no intenta
    encontrar 'Event and Alarm Search'. Eso se hace en
    click_sidebar_event_and_alarm_search.
    """
    # Esperar a que la página esté completamente cargada
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState === 'complete'")
    )

    js = """
        const icons = Array.from(
            document.querySelectorAll("i.icon-svg-nav_search, i.h-icon-search, i[class*='nav_search']")
        );
        const visibles = icons.filter(e => e && e.offsetParent !== null);
        if (!visibles.length) {
            return false;
        }
        // La lupa del menú lateral es la que está más a la izquierda
        visibles.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        const icon = visibles[0];

        // Buscar el contenedor clickeable (el-submenu__title) o usar el propio ícono
        let container = icon.closest('.el-submenu__title');
        if (!container) {
            container = icon;
        }

        container.scrollIntoView({ block: 'center' });
        container.click();
        return true;
    """

    # Ejecutar el JS hasta que haga clic correctamente en la lupa
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script(js)
    )

    # Dar un pequeño tiempo para que el menú se despliegue
    time.sleep(1.5)

    print("[4] Menú Search (lupa) clickeado.")
    if timer:
        timer.mark("[4] CLICK_SIDEBAR_SEARCH")


def click_sidebar_event_and_alarm_search(driver, timeout=20, timer: StepTimer | None = None):
    print("[5] Abriendo Event and Alarm Search desde el menú Search...")

    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[normalize-space(text())='Trigger Alarm']")
            )
        )
        print("[5] Event and Alarm Search ya está visible, no es necesario abrirla.")
        if timer:
            timer.mark("[5] EVENT_AND_ALARM_SEARCH_YA_VISIBLE")
        return
    except TimeoutException:
        pass

    item_xpath = (
        "//li[contains(@class,'el-menu-item') and "
        ".//span[normalize-space()='Event and Alarm Search']]"
    )

    try:
        item = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.XPATH, item_xpath))
        )
    except TimeoutException:
        fallback_xpath = (
            "//*[@title='Event and Alarm Search' or "
            "normalize-space(text())='Event and Alarm Search' or "
            ".//span[normalize-space()='Event and Alarm Search']]"
        )
        item = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.XPATH, fallback_xpath))
        )

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", item)
    driver.execute_script("arguments[0].click();", item)

    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located(
            (By.XPATH, "//*[normalize-space(text())='Trigger Alarm']")
        )
    )

    print("[5] Pantalla Event and Alarm Search abierta.")
    if timer:
        timer.mark("[5] CLICK_EVENT_AND_ALARM_SEARCH")


def validar_event_and_alarm_search_screen(driver, timeout=30, timer: StepTimer | None = None):
    """
    Valida que la pantalla actual corresponde a 'Event and Alarm Search'.
    Basta con encontrar algún título o texto visible con ese nombre.
    """
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located(
            (
                By.XPATH,
                "//*[contains(normalize-space(),'Event and Alarm Search')]"
            )
        )
    )
    if timer:
        timer.mark("[6] VALIDAR_EVENT_AND_ALARM_SEARCH")


def click_search_button(driver, timeout=30, timer: StepTimer | None = None):
    """
    Hace clic en el gran botón rojo 'Search' del formulario Event and Alarm Search.
    Usa el <div class="el-button-slot-wrapper">Search</div> visto en DevTools.
    """
    print("[6] Haciendo clic en botón Search...")

    wait = WebDriverWait(driver, timeout)

    # Selector principal: button primario con el texto 'Search' dentro de div.el-button-slot-wrapper
    search_xpath = (
        "//button[contains(@class,'el-button') and contains(@class,'el-button--primary') "
        "and (.//div[@class='el-button-slot-wrapper' and normalize-space()='Search'] "
        "     or .//div[normalize-space()='Search'] "
        "     or .//span[normalize-space()='Search'])]"
    )

    try:
        search_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, search_xpath))
        )
    except TimeoutException:
        # Fallback muy genérico por si cambian clases pero se mantiene el texto
        fallback_xpath = "//div[normalize-space()='Search']/ancestor::button[1]"
        search_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, fallback_xpath))
        )

    safe_js_click(driver, search_btn)

    # Intentar validar que la tabla tenga filas (la búsqueda se ejecutó)
    try:
        wait.until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//div[contains(@class,'el-table__body-wrapper')]//table//tr"
                )
            )
        )
    except TimeoutException:
        print("[WARN] No se pudo validar visualmente la carga de resultados después de Search.")

    if timer:
        timer.mark("[6] CLICK_SEARCH_BUTTON")


def click_export_event_and_alarm(
    driver,
    password,
    download_dir: Path,
    host_label: str,
    timeout=30,
    timer: StepTimer | None = None,
):
    """
    Abre el panel 'Export' en Event and Alarm Search, introduce password si se solicita
    y hace clic en la opción de exportar (Excel) para disparar la descarga.
    """
    print("[7] Abriendo panel Export en Event and Alarm Search...")

    wait = WebDriverWait(driver, timeout)

    export_icon_xpath = "//i[contains(@class,'h-icon-export')]/ancestor::button[1]"

    try:
        export_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, export_icon_xpath))
        )
    except TimeoutException:
        fallback_xpath = "//*[normalize-space()='Export']/ancestor::button[1]"
        export_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, fallback_xpath))
        )

    safe_js_click(driver, export_btn)
    if timer:
        timer.mark("[7] CLICK_EXPORT_EVENT_AND_ALARM_BUTTON")

    log_info = globals().get("log_info", print)
    log_error = globals().get("log_error", print)

    type_export_password_if_needed(driver, timeout=8, timer=timer)

    # Hacer clic en el botón Save del diálogo Export
    click_export_save_button(driver, timeout=10, timer=timer)

    export_dialog_xpath = (
        "//div[contains(@class,'el-dialog__wrapper')]//span[contains(@class,'el-dialog__title') and contains(normalize-space(),'Export')]"
    )
    try:
        WebDriverWait(driver, timeout).until(
            EC.visibility_of_element_located((By.XPATH, export_dialog_xpath))
        )
    except TimeoutException:
        print("[WARN] No se mostró el diálogo de Export después de hacer clic en el botón.")
        if timer:
            timer.mark("[7] CLICK_EXPORT_EVENT_AND_ALARM_ERROR_NO_DIALOG")
        return None

    excel_option_xpath = (
        "//div[contains(@class,'el-dialog__wrapper')]//label[contains(@class,'el-radio') and "
        "(contains(translate(@title,'excel','EXCEL'),'EXCEL') or .//span[contains(translate(normalize-space(),'excel','EXCEL'),'EXCEL')])]"
    )
    try:
        excel_option = wait.until(
            EC.element_to_be_clickable((By.XPATH, excel_option_xpath))
        )
        safe_js_click(driver, excel_option)
    except TimeoutException:
        print("[WARN] No se encontró la opción de formato Excel en el diálogo de Export.")
        if timer:
            timer.mark("[7] CLICK_EXPORT_EVENT_AND_ALARM_ERROR_NO_EXCEL")
        return None

    if timer:
        timer.mark("[7] CLICK_EXPORT_EVENT_AND_ALARM")

    log_info("[EXPORT] Esperando archivo Alarm_Report_* en carpeta de descargas...")

    archivo = esperar_descarga_y_renombrar_host(
        download_dir=download_dir,
        host_label=host_label,
        timeout=timeout,
    )

    log_info(f"[EXPORT] Ruta final del archivo exportado: {archivo}")

    if not archivo:
        log_error("[ERROR] No se detectó ningún archivo descargado desde Event and Alarm Search.")
        take_screenshot(driver, "event_and_alarm_search")
        return None

    return archivo


def click_trigger_alarm_button(driver, timeout=20, timer: StepTimer | None = None):
    """
    En la pantalla 'Event and Alarm Search' hace clic en el botón 'Trigger Alarm'
    dentro del grupo de filtros Trigger Alarm (All / Not Trigger Alarm / Trigger Alarm).
    """

    # Asegurar que la pantalla de Event and Alarm Search está cargada
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(),'Event and Alarm Search')]")
        )
    )

    # XPath específico para el botón Trigger Alarm
    btn_xpath = (
        "//div[@title='Trigger Alarm' "
        "and contains(@class,'button') "
        "and normalize-space()='Trigger Alarm']"
    )

    # Esperar a que el botón sea clickable
    btn = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.XPATH, btn_xpath))
    )

    # Scroll y clic con JS para asegurarnos de disparar el evento
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
    driver.execute_script("arguments[0].click();", btn)

    # Esperar a que el botón quede marcado (class incluye 'select')
    WebDriverWait(driver, timeout).until(
        lambda d: "select" in d.find_element(By.XPATH, btn_xpath).get_attribute("class")
    )

    print("[9] Botón 'Trigger Alarm' seleccionado correctamente.")
    if timer:
        timer.mark("[9] CLICK_TRIGGER_ALARM")


def limpiar_descargas(download_dir: Path = DOWNLOAD_DIR):
    """Elimina archivos previos en la carpeta de descargas para identificar el nuevo Excel."""
    for f in download_dir.glob("*"):
        try:
            f.unlink()
        except Exception:
            pass


def esperar_descarga_archivo(nombre_parcial: str | None = None, timeout: int = 180) -> Path | None:
    """
    Espera a que se descargue un archivo en DOWNLOAD_DIR.

    Si se especifica `nombre_parcial`, busca archivos cuyo nombre contenga esa
    cadena (excluyendo extensiones temporales). Valida que el archivo no tenga
    la extensión .crdownload y que su tamaño se mantenga estable antes de
    devolverlo.
    """

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    fin = time.time() + timeout
    candidato: Path | None = None

    while time.time() < fin:
        archivos = [
            f
            for f in DOWNLOAD_DIR.glob("*")
            if f.is_file()
            and not f.name.endswith(".crdownload")
            and (nombre_parcial is None or nombre_parcial in f.name)
        ]

        if archivos:
            candidato = max(archivos, key=lambda f: f.stat().st_mtime)
            size1 = candidato.stat().st_size
            time.sleep(1)
            size2 = candidato.stat().st_size
            if size1 == size2 and size2 > 0:
                return candidato

        time.sleep(1)

    return candidato


def esperar_descarga_event_and_alarm(timeout: int = 180) -> Path | None:
    """
    Espera a que aparezca un nuevo archivo de export de Event and Alarm Search
    en DOWNLOAD_DIR y devuelve el Path cuando la descarga termina.
    """

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    existentes = {f.name for f in DOWNLOAD_DIR.glob("*") if f.is_file()}

    fin = time.time() + timeout
    candidato: Path | None = None

    while time.time() < fin:
        archivos = [
            f
            for f in DOWNLOAD_DIR.glob("*")
            if f.is_file() and not f.name.endswith(".crdownload")
        ]
        nuevos = [f for f in archivos if f.name not in existentes]

        if nuevos:
            candidato = max(nuevos, key=lambda f: f.stat().st_mtime)
            size1 = candidato.stat().st_size
            time.sleep(1)
            size2 = candidato.stat().st_size
            if size1 == size2 and size2 > 0:
                return candidato

        time.sleep(1)

    return None


def esperar_descarga_y_renombrar(
    download_dir: Path = DOWNLOAD_DIR,
    prefix: str = "event_and_alarm",
    timeout: int = 180,
) -> Path:
    """
    Espera la finalización de una descarga en download_dir y renombra el archivo
    con el prefijo indicado.
    """

    download_dir.mkdir(parents=True, exist_ok=True)
    existentes = {f.name for f in download_dir.glob("*") if f.is_file()}
    fin = time.time() + timeout
    ultimo_archivo: Path | None = None

    while time.time() < fin:
        archivos = [f for f in download_dir.glob("*") if f.is_file()]
        nuevos = [f for f in archivos if f.name not in existentes]

        if nuevos:
            ultimo_archivo = max(nuevos, key=lambda f: f.stat().st_mtime)

            if ultimo_archivo.suffix == ".crdownload":
                time.sleep(1)
                continue

            size1 = ultimo_archivo.stat().st_size
            time.sleep(1)
            size2 = ultimo_archivo.stat().st_size
            if size1 == size2 and size2 > 0:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                nuevo_nombre = f"{prefix}_{timestamp}{ultimo_archivo.suffix}"
                destino = download_dir / nuevo_nombre
                ultimo_archivo = ultimo_archivo.rename(destino)
                print(f"[INFO] Archivo descargado y renombrado a: {ultimo_archivo}")
                if step_timer:
                    step_timer.mark("[9] Descarga detectada")
                return ultimo_archivo

        time.sleep(1)

    raise TimeoutError("No se detectó ningún archivo descargado en el tiempo esperado.")


def esperar_descarga_y_renombrar_host(
    download_dir: Path,
    host_label: str,
    timeout: int = 180,
) -> Path:
    """
    Espera la finalización de una descarga en download_dir y renombra el archivo
    con sufijo del host.
    """
    download_dir.mkdir(parents=True, exist_ok=True)
    existentes = {f.name for f in download_dir.glob("*") if f.is_file()}
    fin = time.time() + timeout
    ultimo_archivo: Path | None = None
    host_suffix = host_label.replace(".", "_")

    while time.time() < fin:
        archivos = [f for f in download_dir.glob("*") if f.is_file()]
        nuevos = [f for f in archivos if f.name not in existentes]

        if nuevos:
            ultimo_archivo = max(nuevos, key=lambda f: f.stat().st_mtime)

            if ultimo_archivo.suffix == ".crdownload":
                time.sleep(1)
                continue

            size1 = ultimo_archivo.stat().st_size
            time.sleep(1)
            size2 = ultimo_archivo.stat().st_size
            if size1 == size2 and size2 > 0:
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                nuevo_nombre = f"Alarm_Report_{timestamp}_{host_suffix}{ultimo_archivo.suffix}"
                destino = download_dir / nuevo_nombre
                ultimo_archivo = ultimo_archivo.rename(destino)
                print(f"[INFO] Archivo descargado y renombrado a: {ultimo_archivo}")
                if step_timer:
                    step_timer.mark("[9] Descarga detectada")
                return ultimo_archivo

        time.sleep(1)

    raise TimeoutError("No se detectó ningún archivo descargado en el tiempo esperado.")


def insertar_alarm_evento_from_excel(excel_path: Path) -> dict:
    log_info = globals().get("log_info", print)
    log_error = globals().get("log_error", print)

    conn = get_pg_connection()
    id_extraccion = None
    total_preparados = 0
    total_insertados = 0
    total_omitidos = 0
    try:
        archivo_nombre = os.path.basename(excel_path)
        id_extraccion = crear_registro_extraccion(conn, archivo_nombre)

        log_info(f"[INFO] Leyendo Alarm Report desde: {excel_path}")
        raw = pd.read_excel(
            excel_path,
            sheet_name="Alarm and Event Log",
            header=None,
            dtype=str,
        )

        header_row = None
        for idx in range(len(raw)):
            value = raw.iloc[idx, 0]
            if str(value).strip() == "Mark":
                header_row = idx
                break

        if header_row is None:
            raise ValueError(
                "[EVENT] No se encontró fila de cabecera (columna 0 == 'Mark') en Alarm_Report."
            )

        headers = [str(h).strip() for h in raw.iloc[header_row].tolist()]
        df = raw.iloc[header_row + 1 :].copy()
        df.columns = headers

        df = df.dropna(how="all")
        df = df[df["Mark"].notna()].copy()

        log_info(f"[EVENT] header_row detectado: {header_row}")
        log_info(f"[EVENT] Columnas encontradas en Alarm_Report: {list(df.columns)}")

        column_map = {
            "Mark": "mark",
            "Name": "name",
            "Trigger Alarm": "trigger_alarm",
            "Priority": "priority",
            "Triggering Time (Client)": "triggering_time_client",
            "Source": "source",
            "Region": "region",
            "Trigger Event": "trigger_event",
            "Description": "description",
            "Status": "status",
            "Alarm Acknowledgment Time": "alarm_acknowledgment_time",
            "Alarm Category": "alarm_category",
            "Remarks": "remarks",
            "More": "more",
        }

        missing_cols = [col for col in column_map.keys() if col not in df.columns]
        if missing_cols:
            raise ValueError(
                f"[EVENT] Faltan columnas esperadas en Alarm_Report: {missing_cols}"
            )

        df = df[list(column_map.keys())].rename(columns=column_map)

        string_columns = [
            "mark",
            "name",
            "trigger_alarm",
            "priority",
            "source",
            "region",
            "trigger_event",
            "description",
            "status",
            "alarm_category",
            "remarks",
            "more",
        ]
        for col in string_columns:
            if col not in df.columns:
                continue
            df[col] = df[col].astype("string")
            df[col] = df[col].str.strip()
            df[col] = df[col].where(df[col].notna(), None)

        df["triggering_time_client"] = pd.to_datetime(
            df["triggering_time_client"], errors="coerce"
        )
        df["alarm_acknowledgment_time"] = pd.to_datetime(
            df["alarm_acknowledgment_time"], errors="coerce"
        )
        df = df.applymap(to_py)

        required_data_cols = [
            "name",
            "triggering_time_client",
            "source",
            "region",
            "trigger_event",
        ]
        for col in required_data_cols:
            if col not in df.columns:
                raise ValueError(f"[EVENT] Falta columna requerida: {col}")

        if df[required_data_cols].dropna(how="all").empty:
            raise ValueError(
                "[EVENT] Las columnas requeridas no contienen datos. Se aborta la carga."
            )

        def build_event_key(row) -> str:
            def normalize_value(value) -> str:
                if pd.isna(value):
                    return ""
                if isinstance(value, pd.Timestamp):
                    return value.to_pydatetime().replace(tzinfo=None).isoformat()
                return str(value).strip()

            parts = [
                normalize_value(row.get("name")),
                normalize_value(row.get("triggering_time_client")),
                normalize_value(row.get("source")),
                normalize_value(row.get("region")),
                normalize_value(row.get("trigger_event")),
            ]
            raw_key = "|".join(parts)
            return hashlib.md5(raw_key.encode("utf-8")).hexdigest()

        total_original = len(df)
        df["event_key"] = df.apply(build_event_key, axis=1)
        df = df.drop_duplicates(subset=["event_key"]).copy()

        df["id_extraccion"] = id_extraccion

        preview_records = df.head(2).to_dict(orient="records")
        log_info(f"[EVENT] Filas extraídas: {len(df)}")
        log_info(f"[EVENT] Preview registros mapeados: {preview_records}")

        rows = []
        fecha_creacion = datetime.now()
        for _, row in df.iterrows():
            triggering_time = normalize_ts(row.get("triggering_time_client"))
            ack_time = normalize_ts(row.get("alarm_acknowledgment_time"))
            periodo = calcular_periodo(triggering_time)
            rows.append(
                (
                    id_extraccion,
                    row.get("mark"),
                    row.get("name"),
                    row.get("trigger_alarm"),
                    row.get("priority"),
                    triggering_time,
                    row.get("source"),
                    row.get("region"),
                    row.get("trigger_event"),
                    row.get("description"),
                    row.get("status"),
                    ack_time,
                    row.get("alarm_category"),
                    row.get("remarks"),
                    row.get("more"),
                    row.get("event_key"),
                    periodo,
                    fecha_creacion,
                )
            )

        total_preparados = len(rows)
        total_insertados = 0
        total_omitidos = 0

        if not rows:
            log_info("[INFO] No hay filas para insertar en hik_alarm_evento.")
        else:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'hik_alarm_evento'
                      AND column_name = 'fecha_actualizacion';
                    """
                )
                has_fecha_actualizacion = cur.fetchone() is not None

            event_keys = df["event_key"].tolist()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*)
                    FROM public.hik_alarm_evento
                    WHERE EVENT_KEY = ANY(%s);
                    """,
                    (event_keys,),
                )
                existentes = cur.fetchone()[0]

            columnas = [
                "ID_EXTRACCION",
                "MARK",
                "NAME",
                "TRIGGER_ALARM",
                "PRIORITY",
                "TRIGGERING_TIME_CLIENT",
                "SOURCE",
                "REGION",
                "TRIGGER_EVENT",
                "DESCRIPTION",
                "STATUS",
                "ALARM_ACKNOWLEDGMENT_TIME",
                "ALARM_CATEGORY",
                "REMARKS",
                "MORE",
                "EVENT_KEY",
                "PERIODO",
                "FECHA_CREACION",
            ]
            if has_fecha_actualizacion:
                columnas.append("FECHA_ACTUALIZACION")

            columnas_sql = ",\n                    ".join(columnas)
            valores_placeholders = ", ".join(["%s"] * len(rows[0]))
            template = f"({valores_placeholders}"
            if has_fecha_actualizacion:
                template = f"{template}, NOW()"
            template = f"{template})"

            update_set = """
                    MARK = EXCLUDED.MARK,
                    NAME = EXCLUDED.NAME,
                    TRIGGER_ALARM = EXCLUDED.TRIGGER_ALARM,
                    PRIORITY = EXCLUDED.PRIORITY,
                    TRIGGERING_TIME_CLIENT = EXCLUDED.TRIGGERING_TIME_CLIENT,
                    SOURCE = EXCLUDED.SOURCE,
                    REGION = EXCLUDED.REGION,
                    TRIGGER_EVENT = EXCLUDED.TRIGGER_EVENT,
                    DESCRIPTION = EXCLUDED.DESCRIPTION,
                    STATUS = EXCLUDED.STATUS,
                    ALARM_ACKNOWLEDGMENT_TIME = EXCLUDED.ALARM_ACKNOWLEDGMENT_TIME,
                    ALARM_CATEGORY = EXCLUDED.ALARM_CATEGORY,
                    REMARKS = EXCLUDED.REMARKS,
                    MORE = EXCLUDED.MORE,
                    PERIODO = EXCLUDED.PERIODO
            """
            if has_fecha_actualizacion:
                update_set = f"{update_set},\n                    FECHA_ACTUALIZACION = NOW()"

            sql = f"""
                INSERT INTO public.hik_alarm_evento (
                    {columnas_sql}
                )
                VALUES %s
                ON CONFLICT (EVENT_KEY) DO UPDATE SET
                    {update_set};
            """
            with conn.cursor() as cur:
                execute_values(cur, sql, rows, page_size=500, template=template)
            conn.commit()
            total_insertados = total_preparados - existentes
            total_omitidos = existentes
            log_info(f"[INFO] Total registros preparados: {total_preparados}")
            log_info(f"[INFO] Nuevos insertados: {total_insertados}")
            log_info(f"[INFO] Actualizados por duplicado: {total_omitidos}")

        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.hik_alarm_extraccion
                SET fecha_fin = now(),
                    total_filas = %s,
                    total_nuevos = %s,
                    total_duplicados = %s,
                    estado = 'OK'
                WHERE id = %s;
                """,
                (total_preparados, total_insertados, total_omitidos, id_extraccion),
            )
        conn.commit()

    except Exception as exc:
        log_error(f"[ERROR] Falló la carga a hik_alarm_evento: {exc}")
        try:
            conn.rollback()
        except Exception:
            pass
        if id_extraccion is not None:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.hik_alarm_extraccion
                    SET fecha_fin = now(),
                        estado = 'ERROR',
                        observacion = %s
                    WHERE id = %s;
                    """,
                    (str(exc), id_extraccion),
                )
            conn.commit()
        raise
    finally:
        conn.close()
    return {
        "filas_extraidas": total_preparados,
        "insertados": total_insertados,
        "omitidos_duplicado": total_omitidos,
    }


def procesar_alarm_report(file_path: str, timer: StepTimer) -> None:
    """
    Lee el archivo Excel de Alarm Report exportado desde HikCentral y
    lo inserta en la tabla hik_alarm_evento.
    """
    step_name = "[10] DB_PROCESAR_ALARM_REPORT"
    logger_info = globals().get("log_info", print)
    logger_error = globals().get("log_error", print)

    conn = get_pg_connection()
    id_extraccion = None

    try:
        archivo_nombre = os.path.basename(file_path)
        id_extraccion = crear_registro_extraccion(conn, archivo_nombre)

        logger_info("[DB] Procesar Alarm Report e insertar en hik_alarm_evento")
        logger_info(f"[DB] Leyendo archivo Excel de Alarm Report: {file_path}")

        df = pd.read_excel(file_path)
        df.columns = [str(c).strip() for c in df.columns]
        logger_info(f"[EVENT] Columnas encontradas en Alarm_Report: {list(df.columns)}")

        col_event_key = None
        for c in df.columns:
            if str(c).strip().lower() == "event key":
                col_event_key = c
                break

        if not col_event_key:
            raise ValueError(
                "[EVENT] No se encontró columna 'Event Key' en Alarm_Report, se aborta la carga."
            )

        total_original = len(df)
        df[col_event_key] = df[col_event_key].astype(str).str.strip()
        df = df[
            (df[col_event_key].notna())
            & (df[col_event_key] != "")
            & (df[col_event_key].str.lower() != "nan")
        ].copy()
        filtradas = total_original - len(df)
        if filtradas > 0:
            logger_info(f"[EVENT] Filas descartadas por Event Key vacío o NaN: {filtradas}")
        df = df.where(pd.notnull(df), None)

        column_map = {
            "Mark": "mark",
            "Name": "name",
            "Trigger Alarm": "trigger_alarm",
            "Priority": "priority",
            "Triggering Time (Client)": "triggering_time_client",
            "Source": "source",
            "Region": "region",
            "Trigger Event": "trigger_event",
            "Description": "description",
            "Status": "status",
            "Alarm Acknowledgment Time": "alarm_acknowledgment_time",
            "Alarm Category": "alarm_category",
            "Remarks": "remarks",
            "More": "more",
            col_event_key: "event_key",
        }

        columnas_disponibles = [col for col in column_map.keys() if col in df.columns]
        if not columnas_disponibles:
            raise ValueError("[DB] No se encontraron columnas válidas en el Alarm Report.")

        df = df[columnas_disponibles]
        df["id_extraccion"] = id_extraccion

        if "Triggering Time (Client)" in df.columns:
            df["Triggering Time (Client)"] = pd.to_datetime(
                df["Triggering Time (Client)"], errors="coerce"
            )
        df["periodo"] = pd.NA

        if "Alarm Acknowledgment Time" in df.columns:
            df["Alarm Acknowledgment Time"] = pd.to_datetime(
                df["Alarm Acknowledgment Time"], errors="coerce"
            )

        df["fecha_creacion"] = datetime.now()
        df = df.where(pd.notnull(df), None)
        df = df.applymap(to_py)

        registros = []
        for _, row in df.iterrows():
            raw_event_key = row.get(col_event_key)
            if raw_event_key is None:
                continue

            event_key = str(raw_event_key).strip()
            if not event_key or event_key.lower() == "nan":
                continue

            triggering_time = normalize_ts(row.get("Triggering Time (Client)"))
            alarm_ack_time = normalize_ts(row.get("Alarm Acknowledgment Time"))
            periodo = calcular_periodo(triggering_time)

            registros.append(
                (
                    id_extraccion,
                    row.get("Mark"),
                    row.get("Name"),
                    row.get("Trigger Alarm"),
                    row.get("Priority"),
                    triggering_time,
                    row.get("Source"),
                    row.get("Region"),
                    row.get("Trigger Event"),
                    row.get("Description"),
                    row.get("Status"),
                    alarm_ack_time,
                    row.get("Alarm Category"),
                    row.get("Remarks"),
                    row.get("More"),
                    event_key,
                    periodo,
                )
            )

        if not registros:
            logger_info("[DB] No hay registros de Alarm Report para insertar.")
            total_preparados = len(registros)
            total_insertados = 0
            total_omitidos = 0
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.hik_alarm_extraccion
                    SET fecha_fin = now(),
                        total_filas = %s,
                        total_nuevos = %s,
                        total_duplicados = %s,
                        estado = 'OK'
                    WHERE id = %s;
                    """,
                    (total_preparados, total_insertados, total_omitidos, id_extraccion),
                )
            conn.commit()
            return {
                "filas_extraidas": total_preparados,
                "insertados": total_insertados,
                "omitidos_duplicado": total_omitidos,
            }

        total_preparados = len(registros)
        total_insertados = 0
        total_omitidos = 0
        logger_info(f"[EVENT] Registros a insertar en hik_alarm_evento: {total_preparados}")

        sql = """
            INSERT INTO public.hik_alarm_evento (
                id_extraccion,
                mark,
                name,
                trigger_alarm,
                priority,
                triggering_time_client,
                source,
                region,
                trigger_event,
                description,
                status,
                alarm_acknowledgment_time,
                alarm_category,
                remarks,
                more,
                event_key,
                periodo
            ) VALUES %s
            ON CONFLICT (event_key) DO NOTHING;
        """
        with conn.cursor() as cur:
            execute_values(cur, sql, registros, page_size=500)
            total_insertados = cur.rowcount
        conn.commit()
        total_omitidos = total_preparados - total_insertados
        logger_info(
            f"[INFO] Total registros preparados: {total_preparados}"
        )
        logger_info(f"[INFO] Insertados: {total_insertados}")
        logger_info(f"[INFO] Omitidos por duplicado: {total_omitidos}")
        logger_info(
            f"[DB] Se insertaron {total_insertados} registros en hik_alarm_evento "
            f"(id_extraccion={id_extraccion})."
        )

        total_filas = total_preparados
        total_nuevos = total_insertados
        total_duplicados = total_omitidos
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.hik_alarm_extraccion
                SET fecha_fin = now(),
                    total_filas = %s,
                    total_nuevos = %s,
                    total_duplicados = %s,
                    estado = 'OK'
                WHERE id = %s;
                """,
                (total_filas, total_nuevos, total_duplicados, id_extraccion),
            )
        conn.commit()

        if timer:
            timer.mark(step_name)

        return {
            "filas_extraidas": total_preparados,
            "insertados": total_insertados,
            "omitidos_duplicado": total_omitidos,
        }

    except Exception as exc:
        logger_error(f"[DB] Error al procesar Alarm Report: {exc}")
        try:
            conn.rollback()
        except Exception:
            pass
        if id_extraccion is not None:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE public.hik_alarm_extraccion
                    SET fecha_fin = now(),
                        estado = 'ERROR',
                        observacion = %s
                    WHERE id = %s;
                    """,
                    (str(exc), id_extraccion),
                )
            conn.commit()
        raise
    finally:
        conn.close()


def crear_driver(download_dir: Path) -> webdriver.Chrome:
    """Configura y devuelve un driver de Chrome listo para descargar archivos."""

    download_dir.mkdir(parents=True, exist_ok=True)

    chrome_options = Options()

    prefs = {
        "download.default_directory": str(download_dir),
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
            "downloadPath": str(download_dir),
        },
    )

    driver.maximize_window()
    print(f"[DEBUG] DOWNLOAD_DIR = {download_dir}")
    return driver


def cerrar_sesion(driver, wait: WebDriverWait):
    """Intenta cerrar sesión y limpiar las cookies para evitar sesiones pegadas."""

    try:
        driver.switch_to.default_content()

        perfil_button = wait.until(
            EC.element_to_be_clickable(
                (
                    By.CSS_SELECTOR,
                    "div.top-right-area__avatar, div.head-user__wrapper, div.user-avatar",
                )
            )
        )
        perfil_button.click()

        logout_button = wait.until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//li[.//span[normalize-space()='Log Out'] or normalize-space()='Log Out']"
                    " | //*[normalize-space(text())='Log Out']",
                )
            )
        )
        logout_button.click()

        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="User Name"]'))
        )
    except Exception:
        print("[WARN] No se pudo cerrar sesión limpiamente.")


def run_for_host(host: str) -> dict:
    global step_timer, performance_recorder

    print(f"[INFO] === Iniciando extracción para host {host} ===")
    performance_recorder = PerformanceRecorder(time.perf_counter())

    baseline_cpu = psutil.cpu_percent(interval=1)
    registrar_cpu(baseline_cpu)
    baseline_ram = psutil.virtual_memory().percent
    print(
        f"[PERF] [0] Baseline antes de automatizar... CPU: {baseline_cpu:.1f}% | RAM: {baseline_ram:.1f}%"
    )
    if performance_recorder:
        performance_recorder.record_baseline(baseline_cpu, baseline_ram)

    driver = None
    wait: WebDriverWait | None = None
    step_timer = StepTimer(
        start_time=performance_recorder.start_time if performance_recorder else None,
        recorder=performance_recorder,
    )
    timer = step_timer

    export_file_path: Path | None = None
    resultados_carga = {
        "filas_extraidas": 0,
        "insertados": 0,
        "omitidos_duplicado": 0,
    }
    host_dir = DOWNLOAD_DIR / host.replace(".", "_")

    try:
        global URL
        URL = f"http://{host}/#/"

        driver = crear_driver(download_dir=host_dir)
        wait = WebDriverWait(driver, 30)

        print("[1] Abriendo URL de login...")
        driver.get(URL)
        if timer:
            timer.mark("[1] ABRIR_URL_LOGIN")

        print("[2] Iniciando sesión...")
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

        login_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Log In']"))
        )
        login_button.click()
        if timer:
            timer.mark("[2] LOGIN")

        print("[3] Esperando carga del portal principal...")
        wait.until(lambda d: "/portal" in d.current_url)
        if timer:
            timer.mark("[3] PORTAL_PRINCIPAL_CARGADO")

        print("[3] Navegando a Event and Alarm...")
        ir_a_event_and_alarm(driver, wait)
        if timer:
            timer.mark("[4] EVENT_AND_ALARM_ABIERTO")

        click_sidebar_alarm_search(driver, timeout=30, timer=timer)
        click_sidebar_event_and_alarm_search(driver, timeout=30, timer=timer)
        validar_event_and_alarm_search_screen(driver, timeout=40, timer=timer)
        click_trigger_alarm_button(driver, timeout=30, timer=timer)
        click_search_button(driver, timeout=40, timer=timer)

        limpiar_descargas(host_dir)
        export_file_path = click_export_event_and_alarm(
            driver,
            password=HIK_PASSWORD,
            download_dir=host_dir,
            host_label=host,
            timeout=30,
            timer=timer,
        )

        print(f"[INFO] Ruta final del archivo exportado: {export_file_path}")

        if export_file_path is None:
            raise RuntimeError(
                "No se detectó ningún archivo descargado desde Event and Alarm Search."
            )

        size_mb = export_file_path.stat().st_size / (1024 * 1024)
        print(
            f"[8] Archivo de Event and Alarm Search descargado: {export_file_path} "
            f"({size_mb:.2f} MB)"
        )

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        screenshot_path = LOG_DIR / f"event_and_alarm_search_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        driver.save_screenshot(str(screenshot_path))
        print(f"[INFO] Screenshot guardado en: {screenshot_path}")
        if timer:
            timer.mark("[9] SCREENSHOT_EVENT_AND_ALARM_SEARCH")

        print("[OK] Flujo Event and Alarm Search + Export completado.")
        if timer:
            timer.mark("[10] FIN_OK")

        resultados_carga = insertar_alarm_evento_from_excel(export_file_path)

        print(
            "[INFO] === Fin host "
            f"{host} | extraídas: {resultados_carga['filas_extraidas']} | "
            f"insertados: {resultados_carga['insertados']} | "
            f"duplicados: {resultados_carga['omitidos_duplicado']} ==="
        )

        return {
            "host": host,
            "ok": True,
            "archivo": str(export_file_path),
            **resultados_carga,
            "error": None,
        }

    except Exception as e:
        print(f"[ERROR] Ocurrió un problema en el flujo Event and Alarm: {e}")
        traceback.print_exc()
        if driver:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            error_screenshot = LOG_DIR / f"event_and_alarm_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            try:
                driver.save_screenshot(str(error_screenshot))
                print(f"[INFO] Screenshot de error guardado en: {error_screenshot}")
            except Exception:
                print("[WARN] No se pudo guardar el screenshot de error.")
        if timer:
            timer.mark("[ERROR] Fin por excepción")
        raise

    finally:
        if driver:
            try:
                if wait:
                    cerrar_sesion(driver, wait)
            except Exception:
                pass
            driver.quit()

        final_cpu = psutil.cpu_percent(interval=1)
        final_ram = psutil.virtual_memory().percent
        registrar_cpu(final_cpu)
        if performance_recorder:
            performance_recorder.update_cpu(final_cpu)
        print(
            f"[PERF] [FIN] Estado al terminar script... CPU: {final_cpu:.1f}% | RAM: {final_ram:.1f}%"
        )

        duracion_total_seg = (
            time.perf_counter() - performance_recorder.start_time if performance_recorder else 0.0
        )

        registrar_ejecucion_y_pasos(
            opcion="Event and Alarm",
            duracion_total_seg=duracion_total_seg,
            cpu_final=final_cpu,
            ram_final=final_ram,
            recorder=performance_recorder,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automatiza Event and Alarm Search en HikCentral.")
    parser.add_argument("--host", type=str, help="Host/IP de HikCentral (ej: 172.16.9.11)")
    parser.add_argument(
        "--hosts",
        type=str,
        help="Lista de hosts separados por coma (ej: 172.16.9.10,172.16.9.11)",
    )
    args = parser.parse_args()

    if args.host:
        hosts_to_run = [args.host.strip()]
    else:
        hosts_to_run = DEFAULT_HOSTS

    resultados = []
    for host in hosts_to_run:
        if not host_is_up(host):
            print(f"[WARN] Host no responde: {host}. Se intentará igual.")

        try:
            res = run_for_host(host)
            resultados.append(res)
        except Exception as ex:
            print(f"[ERROR] Falló host {host}: {ex}")
            resultados.append(
                {
                    "host": host,
                    "ok": False,
                    "error": str(ex),
                    "archivo": None,
                    "filas_extraidas": 0,
                    "insertados": 0,
                    "omitidos_duplicado": 0,
                }
            )

    print("[INFO] === Resumen final por host ===")
    for res in resultados:
        if res.get("ok"):
            print(
                "[INFO] Host "
                f"{res.get('host')} | ok | archivo: {res.get('archivo')} | "
                f"extraídas: {res.get('filas_extraidas')} | "
                f"insertados: {res.get('insertados')} | "
                f"duplicados: {res.get('omitidos_duplicado')}"
            )
        else:
            print(
                "[INFO] Host "
                f"{res.get('host')} | ERROR | "
                f"motivo: {res.get('error', 'desconocido')}"
            )

    if any(res.get("ok") for res in resultados):
        raise SystemExit(0)
    raise SystemExit(1)
