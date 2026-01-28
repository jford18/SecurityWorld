import argparse
import os
import shutil
import sys
import re
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
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
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
HIK_EXPORT_PASSWORD = os.getenv("HIK_EXPORT_PASSWORD", HIK_PASSWORD)

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


def parse_hosts_from_args(host: str | None, hosts: str | None) -> list[str]:
    candidates: list[str] = []
    if host and host.strip():
        candidates.append(host.strip())
    if hosts:
        candidates.extend([h.strip() for h in hosts.split(",") if h.strip()])

    seen = set()
    deduped: list[str] = []
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        deduped.append(candidate)
    return deduped


def parse_hosts_from_env() -> list[str]:
    env_host = os.getenv("HIK_HOST")
    if env_host and env_host.strip():
        return [env_host.strip()]

    env_hosts = os.getenv("HIK_HOSTS")
    if env_hosts and env_hosts.strip():
        return [h.strip() for h in env_hosts.split(",") if h.strip()]

    return DEFAULT_HOSTS


def get_downloadcenter_root() -> Path:
    env_root = os.getenv("HIK_DOWNLOADCENTER") or os.getenv("HC_DOWNLOADCENTER")
    if env_root and env_root.strip():
        return Path(env_root.strip())

    user_home = Path(os.environ.get("USERPROFILE", str(Path.home())))
    return user_home / "HCWebControlService" / "Downloadcenter"


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


def snapshot_alarm_reports(downloadcenter_root: Path) -> set[Path]:
    if not downloadcenter_root.exists():
        return set()

    files: set[Path] = set()
    for p in downloadcenter_root.rglob("*"):
        if not p.is_file():
            continue
        name = p.name
        if not name.startswith("Alarm_Report_"):
            continue
        if not name.lower().endswith((".xlsx", ".xls")):
            continue
        files.add(p)
    return files


def wait_new_alarm_report(
    downloadcenter_root: Path,
    before: set[Path],
    start_ts: float | None = None,
    timeout: int = 180,
) -> Path | None:
    fin = time.time() + timeout
    last_candidate: Path | None = None
    last_print = 0.0

    while time.time() < fin:
        current = snapshot_alarm_reports(downloadcenter_root)
        nuevos = [p for p in current if p not in before]

        if nuevos:
            # el más nuevo por fecha de modificación
            if start_ts is not None:
                nuevos = [
                    p
                    for p in nuevos
                    if p.exists() and p.stat().st_mtime >= (start_ts - 2)
                ]
            if nuevos:
                last_candidate = max(nuevos, key=lambda p: p.stat().st_mtime)

            # esperar tamaño estable (descarga terminada)
            try:
                size1 = last_candidate.stat().st_size
                time.sleep(1)
                size2 = last_candidate.stat().st_size
                if size1 == size2 and size2 > 0:
                    # validar que se puede abrir (evitar lock)
                    try:
                        with open(last_candidate, "rb") as f:
                            f.read(64)
                        return last_candidate
                    except Exception:
                        # si está bloqueado, seguir esperando
                        pass
            except Exception:
                pass

        now = time.time()
        if now - last_print >= 5:
            last_print = now
            try:
                cand = last_candidate
                if cand and cand.exists():
                    log_size = cand.stat().st_size
                    print(
                        "[EXPORT] esperando... candidatos nuevos detectados. "
                        f"último={cand.name} size={log_size} bytes"
                    )
                else:
                    print("[EXPORT] esperando... aún sin archivo nuevo en Downloadcenter")
            except Exception:
                print("[EXPORT] esperando... (sin detalle)")

        time.sleep(1)

    return last_candidate


def copiar_alarm_report_a_downloads(src: Path, host_dir: Path, host_label: str) -> Path:
    host_dir.mkdir(parents=True, exist_ok=True)
    host_suffix = host_label.replace(".", "_")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    destino = host_dir / f"Alarm_Report_{timestamp}_{host_suffix}{src.suffix}"
    shutil.copy2(src, destino)
    return destino


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


def log_step(msg: str, logger=None):
    if logger:
        logger(msg)
    else:
        print(msg)


def safe_click(driver, element, step_name: str | None = None, logger=None):
    try:
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
        element.click()
        if step_name:
            log_step(f"✅ {step_name}: OK", logger)
    except ElementClickInterceptedException as exc:
        try:
            driver.execute_script("arguments[0].click();", element)
            if step_name:
                log_step(f"✅ {step_name}: OK", logger)
        except Exception as js_exc:
            if step_name:
                log_step(f"❌ {step_name}: FAIL -> {js_exc}", logger)
            raise js_exc
    except StaleElementReferenceException as exc:
        if step_name:
            log_step(f"❌ {step_name}: FAIL -> {exc}", logger)
        raise
    except Exception as exc:
        if step_name:
            log_step(f"❌ {step_name}: FAIL -> {exc}", logger)
        raise


def wait_for_overlays_to_clear(driver, timeout=8, logger=None):
    overlay_selectors = [
        ".el-loading-mask",
        ".loading",
        ".spinner",
        ".ant-spin",
        "[class*='loading']",
    ]
    for selector in overlay_selectors:
        try:
            if driver.find_elements(By.CSS_SELECTOR, selector):
                log_step("Overlay detectado / esperando...", logger)
            WebDriverWait(driver, timeout).until(
                EC.invisibility_of_element_located((By.CSS_SELECTOR, selector))
            )
        except TimeoutException:
            continue
        except Exception:
            continue


def click_seguro(driver, by, locator, nombre, timeout=12, logger=None):
    end_time = time.time() + timeout
    last_exc: Exception | None = None
    while time.time() < end_time:
        try:
            wait = WebDriverWait(driver, max(2, min(6, timeout)))
            element = wait.until(EC.presence_of_element_located((by, locator)))
            wait.until(EC.element_to_be_clickable((by, locator)))
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
            try:
                element.click()
                log_step("Click normal ok", logger)
                return element
            except ElementClickInterceptedException as exc:
                last_exc = exc
                try:
                    driver.execute_script("arguments[0].click();", element)
                    log_step("Click JS ok", logger)
                    return element
                except Exception as js_exc:
                    last_exc = js_exc
                    try:
                        ActionChains(driver).move_to_element(element).pause(0.2).click().perform()
                        log_step("Click ActionChains ok", logger)
                        return element
                    except Exception as ac_exc:
                        last_exc = ac_exc
                        continue
            except StaleElementReferenceException as exc:
                last_exc = exc
                continue
        except (TimeoutException, StaleElementReferenceException) as exc:
            last_exc = exc
            continue
    if last_exc:
        raise last_exc
    raise TimeoutException(f"No se pudo hacer click en {nombre}")


def click_export_toolbar_button(driver, timeout=15, logger=None) -> None:
    """
    Click 100% seguro al botón Export del toolbar (arriba derecha).
    Evita confundir el texto 'Export' del drawer (existe oculto en el DOM).
    """
    wait_for_overlays_to_clear(driver, timeout=8, logger=logger)

    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    wait = WebDriverWait(driver, timeout)

    # 1) anclar al contenedor del toolbar
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.alarm-head-operation")))

    # 2) botón real Export dentro del toolbar
    export_btn = wait.until(
        EC.element_to_be_clickable(
            (By.CSS_SELECTOR, "div.alarm-head-operation button[title='Export'].el-button.is-icon-text")
        )
    )

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", export_btn)

    try:
        export_btn.click()
        log_step("Click Export toolbar OK", logger)
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", export_btn)
        log_step("Click Export toolbar OK (JS)", logger)

    # 3) validar drawer abierto: div.drawer div.main visible y SIN main-hide
    def drawer_abierto(d):
        mains = d.find_elements(By.CSS_SELECTOR, "div.drawer div.main")
        for m in mains:
            try:
                cls = (m.get_attribute("class") or "")
                if m.is_displayed() and ("main-hide" not in cls):
                    return True
            except Exception:
                continue
        return False

    wait.until(drawer_abierto)


def click_export_and_enter_password(driver, export_password, logger=None, timeout=15):
    """
    Hace clic en el botón 'Export', espera la apertura del modal de exportación,
    ingresa la contraseña y confirma la exportación.
    """
    wait = WebDriverWait(driver, timeout)

    log_step("🔹 Buscando botón Export...", logger)
    try:
        container = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.alarm-head-operation")))
        export_btn = container.find_element(By.CSS_SELECTOR, "button[title='Export'].el-button.is-icon-text")
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", export_btn)
        try:
            export_btn.click()
            log_step("✔️ Click Export (normal)", logger)
        except ElementClickInterceptedException:
            driver.execute_script("arguments[0].click();", export_btn)
            log_step("✔️ Click Export (JS fallback)", logger)
    except Exception as e:
        take_screenshot(driver, "error_click_export")
        raise RuntimeError(f"No se pudo hacer clic en Export: {e}")

    # Esperar a que aparezca el modal con campo de contraseña
    log_step("🔹 Esperando modal de exportación...", logger)
    try:
        password_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password'].el-input__inner"))
        )
        password_input.clear()
        password_input.send_keys(export_password)
        driver.execute_script("arguments[0].blur();", password_input)
        log_step("✔️ Contraseña escrita", logger)
    except TimeoutException:
        take_screenshot(driver, "error_password_modal")
        raise RuntimeError("No apareció el campo de contraseña en modal de exportación.")

    # Hacer clic en botón Save
    log_step("🔹 Buscando botón Save...", logger)
    try:
        save_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[.//span[text()='Save']]")))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", save_btn)
        try:
            save_btn.click()
            log_step("✔️ Click botón Save (normal)", logger)
        except ElementClickInterceptedException:
            driver.execute_script("arguments[0].click();", save_btn)
            log_step("✔️ Click botón Save (JS fallback)", logger)
    except Exception as e:
        take_screenshot(driver, "error_click_save")
        raise RuntimeError(f"No se pudo hacer clic en Save: {e}")


def find_in_frames(driver, wait, by, value, logger=None):
    log_step("🔹 STEP EXPORT-FRAME: buscando en frames...", logger)
    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    try:
        element = wait.until(EC.visibility_of_element_located((by, value)))
        return element
    except TimeoutException:
        pass

    frames = driver.find_elements(By.TAG_NAME, "iframe")
    for frame in frames:
        try:
            driver.switch_to.default_content()
            driver.switch_to.frame(frame)
        except Exception:
            continue
        try:
            element = wait.until(EC.visibility_of_element_located((by, value)))
            return element
        except TimeoutException:
            try:
                driver.switch_to.default_content()
            except Exception:
                pass
            continue

    raise TimeoutException(f"No se encontró elemento {value} en frames.")


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


# ====== Export drawer (robusto ElementUI) ======
EXPORT_DRAWER_CONTAINER_SELECTOR = (
    "div.el-drawer__wrapper, div.el-dialog__wrapper, div.el-drawer, div.el-dialog, "
    "div.drawer-main, [role='dialog']"
)
EXPORT_DRAWER_PASSWORD_SELECTOR = 'input.el-input__inner[placeholder="Password"]'
EXPORT_DRAWER_SAVE_REL_XPATH = ".//button[normalize-space()='Save' or .//*[normalize-space()='Save']]"
EXPORT_PANEL_XPATH = (
    "//div[(contains(@class,'el-drawer') or contains(@class,'el-dialog') "
    "or contains(@class,'drawer-main') or contains(@class,'el-drawer__wrapper') "
    "or contains(@class,'el-dialog__wrapper') or @role='dialog')]"
    "[.//*[normalize-space()='Export']]"
)


def _set_input_value_js(driver, input_el, value: str):
    driver.execute_script(
        """
        const el = arguments[0];
        const val = arguments[1];
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        """,
        input_el,
        value,
    )


def _blur_active(driver):
    try:
        driver.execute_script(
            "document.activeElement && document.activeElement.blur && document.activeElement.blur();"
        )
    except Exception:
        pass


def _is_visible_element(driver, element) -> bool:
    try:
        return bool(
            driver.execute_script(
                """
                return (function(el){
                    if(!el) return false;

                    const cls_attr = (el.getAttribute("class") || "");
                    if (cls_attr.includes("main-hide")) return false;

                    const right = (window.getComputedStyle(el).right || "");
                    if (right.includes("-400px")) return false;

                    const ariaHidden = el.getAttribute("aria-hidden");
                    if (ariaHidden === "true") return false;

                    const s = window.getComputedStyle(el);
                    if(!s || s.display==='none' || s.visibility==='hidden' || Number(s.opacity)===0) {
                        return false;
                    }

                    const r = el.getBoundingClientRect();
                    if (r.width <= 0 || r.height <= 0) return false;

                    // ✅ Debe intersectar con el viewport (evita drawers fuera de pantalla como right:-400px)
                    const vw = window.innerWidth || document.documentElement.clientWidth;
                    const vh = window.innerHeight || document.documentElement.clientHeight;

                    const intersects =
                        r.right > 0 &&
                        r.bottom > 0 &&
                        r.left < vw &&
                        r.top < vh;

                    if (!intersects) return false;

                    return true;
                })(arguments[0]);
                """,
                element,
            )
        )
    except Exception:
        return False


def get_visible_export_container(driver, timeout=8, take_fail_screenshot: bool = True):
    wait = WebDriverWait(driver, timeout)
    last_print_ts = 0.0

    def _locate_container(_driver):
        nonlocal last_print_ts
        candidates = _driver.find_elements(By.CSS_SELECTOR, EXPORT_DRAWER_CONTAINER_SELECTOR)
        visible = [el for el in candidates if _is_visible_element(_driver, el)]
        now = time.time()
        if now - last_print_ts >= 2.0:
            print(
                f"[EXPORT] buscando drawer... visibles={len(visible)} candidatos={len(candidates)}"
            )
            last_print_ts = now
        best = None
        best_score = -1
        for idx, element in enumerate(visible):
            score = 0
            password_selectors = [
                'input.el-input__inner[placeholder="Password"][type="password"]',
                'input.el-input__inner[outerinputtype="password"]',
                'input[type="password"][placeholder="Password"]',
            ]
            for selector in password_selectors:
                if element.find_elements(By.CSS_SELECTOR, selector):
                    score += 100
                    break
            if element.find_elements(By.XPATH, EXPORT_DRAWER_SAVE_REL_XPATH):
                score += 20
            try:
                inner_text = _driver.execute_script("return arguments[0].innerText || '';", element)
            except Exception:
                inner_text = element.text or ""
            if "Export" in (inner_text or ""):
                score += 10
            if score > best_score or score == best_score:
                best_score = score
                best = element
        return best if best is not None else False

    try:
        return wait.until(_locate_container)
    except TimeoutException as exc:
        logger_warn = globals().get("log_warn", print)
        try:
            candidates = driver.find_elements(By.CSS_SELECTOR, EXPORT_DRAWER_CONTAINER_SELECTOR)
            visible_texts = []
            for candidate in candidates:
                if not _is_visible_element(driver, candidate):
                    continue
                try:
                    text = driver.execute_script(
                        "return (arguments[0].innerText || '').trim();", candidate
                    )
                except Exception:
                    text = (candidate.text or "").strip()
                visible_texts.append((text or "")[:200])
            logger_warn(
                "[EXPORT] No se encontró container visible de Export. "
                f"Candidatos: {len(candidates)}. Textos visibles: {visible_texts}"
            )
        except Exception:
            logger_warn("[EXPORT] No se encontró container visible de Export.")
        if take_fail_screenshot:
            try:
                take_screenshot(driver, "export_container_missing")
            except Exception:
                logger_warn("[EXPORT] No se pudo guardar screenshot del drawer Export.")
        raise exc


def find_export_drawer_any_frame(driver, timeout=12):
    try:
        driver.switch_to.default_content()
        container = get_visible_export_container(driver, timeout=timeout, take_fail_screenshot=False)
        if container:
            return container, "default"
    except TimeoutException:
        pass

    frames = driver.find_elements(By.TAG_NAME, "iframe") + driver.find_elements(By.TAG_NAME, "frame")
    for idx, frame in enumerate(frames):
        try:
            driver.switch_to.default_content()
            driver.switch_to.frame(frame)
        except Exception:
            continue
        try:
            container = get_visible_export_container(
                driver, timeout=timeout, take_fail_screenshot=False
            )
        except TimeoutException:
            container = None
        if container:
            return container, f"iframe[{idx}]"

    try:
        driver.switch_to.default_content()
    except Exception:
        pass
    return None, "none"


def _dump_export_candidates(driver, scope_label: str):
    try:
        candidates = driver.find_elements(By.CSS_SELECTOR, EXPORT_DRAWER_CONTAINER_SELECTOR)
    except Exception as exc:
        print(f"[EXPORT][DEBUG] {scope_label} error listando candidatos: {exc}")
        return
    visible = []
    visible_texts = []
    for candidate in candidates:
        if not _is_visible_element(driver, candidate):
            continue
        visible.append(candidate)
        try:
            text = driver.execute_script("return (arguments[0].innerText || '').trim();", candidate)
        except Exception:
            text = (candidate.text or "").strip()
        visible_texts.append((text or "")[:200])
    print(
        f"[EXPORT][DEBUG] {scope_label} candidatos={len(candidates)} visibles={len(visible)} "
        f"textos={visible_texts}"
    )


def set_el_input_password(driver, container, password: str, required: bool = True):
    logger_warn = globals().get("log_warn", print)
    logger_error = globals().get("log_error", print)

    pwd_input = None
    selectors = [
        'input.el-input__inner[placeholder="Password"][type="password"]',
        'input.el-input__inner[outerinputtype="password"]',
        'input[type="password"][placeholder="Password"]',
    ]

    for selector in selectors:
        matches = container.find_elements(By.CSS_SELECTOR, selector)
        if matches:
            pwd_input = matches[0]
            break

    if pwd_input is None:
        try:
            pwd_input = container.find_element(
                By.XPATH,
                ".//input[contains(@class,'el-input__inner') and @type='password' and "
                "@placeholder='Password']",
            )
        except Exception:
            pwd_input = None

    if pwd_input is None:
        if not required:
            print("[7] Drawer Export sin input Password. Continuo sin setear password.")
            return 0

        try:
            drawer_html = driver.execute_script("return arguments[0].outerHTML;", container)
            preview = (drawer_html or "")[:1500]
            logger_error(
                "[EXPORT] Drawer Export visible pero no se encontró input Password. "
                f"Preview HTML: {preview}"
            )
        except Exception:
            logger_error("[EXPORT] Drawer Export visible pero no se encontró input Password.")
        try:
            take_screenshot(driver, "export_password_input_missing")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del drawer Export.")
        raise RuntimeError("No se encontró el input Password en el drawer Export.")

    try:
        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center'});", pwd_input
        )
    except Exception:
        pass

    print("[7] Seteando password en input placeholder=Password ...")
    pwd_input.click()
    pwd_input.send_keys(Keys.CONTROL, "a")
    pwd_input.send_keys(Keys.BACKSPACE)
    pwd_input.send_keys(password)

    value = (pwd_input.get_attribute("value") or "").strip()
    if not value:
        driver.execute_script(
            """
            const el = arguments[0];
            const val = arguments[1];
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            """,
            pwd_input,
            password,
        )
        value = (pwd_input.get_attribute("value") or "").strip()

    print(f"[7] Password value length={len(value)}")

    if not value:
        # Si el input existe pero no se logra setear, esto sí es error.
        logger_error(
            "[EXPORT] No se pudo setear el password en el drawer Export. "
            f"type={pwd_input.get_attribute('type')}, "
            f"outerinputtype={pwd_input.get_attribute('outerinputtype')}, "
            f"placeholder={pwd_input.get_attribute('placeholder')}, "
            f"class={pwd_input.get_attribute('class')}"
        )
        try:
            take_screenshot(driver, "export_password_set_failed")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del drawer Export.")
        raise RuntimeError("No se pudo setear el password en el drawer Export.")
    return len(value)


def _get_visible_export_modal(driver):
    modal_xpaths = [
        "//div[contains(@class,'el-dialog__wrapper') or contains(@class,'el-drawer__wrapper')]"
        "[.//*[normalize-space()='Export']]",
        "//div[contains(@class,'el-dialog') or contains(@class,'el-drawer')][.//*[normalize-space()='Export']]",
    ]
    for modal_xpath in modal_xpaths:
        try:
            candidates = driver.find_elements(By.XPATH, modal_xpath)
        except Exception:
            continue
        for candidate in candidates:
            if _is_visible_element(driver, candidate):
                return candidate
    return None


def wait_for_export_panel(driver, timeout: int = 20):
    try:
        driver.switch_to.default_content()
    except Exception:
        pass
    wait = WebDriverWait(driver, timeout)
    return wait.until(EC.visibility_of_element_located((By.XPATH, EXPORT_PANEL_XPATH)))


def fill_export_confirm_password(driver, panel, password: str) -> None:
    logger_warn = globals().get("log_warn", print)
    logger_error = globals().get("log_error", print)

    label_xpath = (
        ".//label[.//span[normalize-space()='Confirm Password'] or "
        "normalize-space()='Confirm Password' or "
        "contains(normalize-space(),'Confirm Password')]/following::input[@type='password'][1]"
    )
    fallback_xpath = ".//input[@type='password' and @placeholder='Password']"

    pwd_input = None
    selector_used = ""
    try:
        pwd_input = panel.find_element(By.XPATH, label_xpath)
        selector_used = f"xpath:{label_xpath}"
    except Exception:
        try:
            pwd_input = panel.find_element(By.XPATH, fallback_xpath)
            selector_used = f"xpath:{fallback_xpath}"
        except Exception as exc:
            logger_error(
                "[EXPORT] No se encontró input Confirm Password en panel Export. "
                f"label_xpath={label_xpath} fallback_xpath={fallback_xpath}"
            )
            try:
                take_screenshot(driver, "export_confirm_password_missing")
            except Exception:
                logger_warn("[EXPORT] No se pudo guardar screenshot del input Confirm Password.")
            raise exc

    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", pwd_input)
    except Exception:
        pass

    value = ""

    try:
        pwd_input.click()
        pwd_input.send_keys(Keys.CONTROL, "a")
        pwd_input.send_keys(Keys.BACKSPACE)
        pwd_input.send_keys(password)
        value = (pwd_input.get_attribute("value") or "").strip()
    except Exception:
        value = (pwd_input.get_attribute("value") or "").strip()

    if not value:
        try:
            ActionChains(driver).move_to_element(pwd_input).pause(0.1).click().pause(0.1).key_down(
                Keys.CONTROL
            ).send_keys("a").key_up(Keys.CONTROL).send_keys(Keys.BACKSPACE).send_keys(
                password
            ).perform()
        except Exception:
            pass
        value = (pwd_input.get_attribute("value") or "").strip()

    if not value:
        try:
            driver.execute_script(
                """
                const el = arguments[0];
                const val = arguments[1];
                el.focus();
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                """,
                pwd_input,
                password,
            )
        except Exception:
            pass
        value = (pwd_input.get_attribute("value") or "").strip()

    if not value:
        logger_error(
            "[EXPORT] No se pudo setear Confirm Password en panel Export. "
            f"selector={selector_used}"
        )
        try:
            take_screenshot(driver, "export_confirm_password_set_failed")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del Confirm Password.")
        raise RuntimeError("No se pudo setear Confirm Password en el panel Export.")

    print(f"[EXPORT] Confirm Password seteado (len={len(value)}) usando {selector_used}.")


def dump_export_modal_html(driver, label_prefix: str) -> Path | None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = LOG_DIR / f"{label_prefix}_{timestamp}.html"
    try:
        modal = _get_visible_export_modal(driver)
    except Exception:
        modal = None
    if not modal:
        return None
    try:
        html = driver.execute_script("return arguments[0].outerHTML;", modal)
    except Exception:
        html = None
    if not html:
        return None
    output_path.write_text(html, encoding="utf-8")
    print(f"[EXPORT] HTML del modal Export guardado en: {output_path}")
    return output_path


def complete_export_modal(driver, password: str, timeout: int = 20) -> None:
    logger_warn = globals().get("log_warn", print)
    logger_error = globals().get("log_error", print)

    save_xpath = ".//button[@title='Save' or .//*[normalize-space()='Save']]"

    wait = WebDriverWait(driver, timeout)
    try:
        modal = wait_for_export_panel(driver, timeout=timeout)
    except TimeoutException as exc:
        try:
            take_screenshot(driver, "export_modal_missing")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del modal Export.")
        raise exc

    log_info = globals().get("log_info", print)
    log_info("[EXPORT] Modal Export visible.")

    try:
        fill_export_confirm_password(driver, modal, password)
    except Exception:
        logger_error("[EXPORT] No se pudo setear el Confirm Password en el modal Export.")
        raise

    try:
        save_btn = modal.find_element(By.XPATH, save_xpath)
    except Exception as exc:
        try:
            take_screenshot(driver, "export_modal_save_missing")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del botón Save.")
        raise exc

    print("[EXPORT] Clic en Save (modal Export)...")
    try:
        save_btn.click()
    except Exception:
        driver.execute_script("arguments[0].click();", save_btn)

    try:
        wait.until(
            lambda d: not _is_visible_element(d, modal)
            or not modal.is_displayed()
        )
    except (TimeoutException, StaleElementReferenceException) as exc:
        try:
            take_screenshot(driver, "export_modal_still_visible")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del modal Export.")
        raise RuntimeError("El modal Export no se cerró tras Save.") from exc


def click_save_in_container(driver, container, timeout=10):
    logger_warn = globals().get("log_warn", print)
    logger_error = globals().get("log_error", print)

    try:
        save_btn = WebDriverWait(driver, timeout).until(
            lambda d: container.find_element(By.XPATH, EXPORT_DRAWER_SAVE_REL_XPATH)
        )
    except TimeoutException as exc:
        try:
            take_screenshot(driver, "export_save_button_missing")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del drawer Export.")
        raise exc

    print("[7] Clic Save...")
    try:
        save_btn.click()
    except Exception:
        driver.execute_script("arguments[0].click();", save_btn)

    error_nodes = container.find_elements(By.CSS_SELECTOR, ".is-error")
    required_text = container.find_elements(
        By.XPATH,
        ".//*[contains(translate(normalize-space(),'REQUIRED','required'),'required')]",
    )
    if error_nodes or required_text:
        try:
            take_screenshot(driver, "export_save_required_error")
        except Exception:
            logger_warn("[EXPORT] No se pudo guardar screenshot del drawer Export.")
        raise RuntimeError("El drawer Export indicó error de requerido tras Save.")

    try:
        WebDriverWait(driver, timeout).until(lambda d: not _is_visible_element(d, container))
    except TimeoutException:
        if _is_visible_element(driver, container):
            try:
                take_screenshot(driver, "export_save_drawer_still_visible")
            except Exception:
                logger_warn("[EXPORT] No se pudo guardar screenshot del drawer Export.")
            raise RuntimeError("El drawer Export no se cerró tras Save.")


def try_click_save_in_container(driver, container, timeout=6) -> bool:
    """
    Intenta hacer clic en Save si existe dentro del container.
    Si no existe o no aparece, NO revienta (vuelve a comportamiento "como antes").
    """
    try:
        click_save_in_container(driver, container, timeout=timeout)
        return True
    except TimeoutException:
        print("[7] No se encontró botón Save en el drawer Export. Continuo.")
        return False
    except Exception as exc:
        # si hay drawer pero el click falla raro, preferimos fallar con evidencia
        print(f"[WARN] Error al intentar Save en drawer Export: {exc}")
        try:
            take_screenshot(driver, "export_save_click_error")
        except Exception:
            pass
        raise


def type_export_password_if_needed(driver, timeout=8, timer=None):
    """
    Si el cuadro Export muestra el campo Password, escribe la misma
    contraseña HIK_PASSWORD usada en el login.
    Si no aparece el campo, continuar sin error.
    """
    try:
        drawer = get_visible_export_container(driver, timeout=timeout)
    except TimeoutException:
        return False

    set_el_input_password(driver, drawer, HIK_PASSWORD)
    return True


def click_export_save_button(driver, timeout=10, timer=None):
    """
    Hace clic en el botón Save del cuadro Export.
    Usa EXPORT_SAVE_BUTTON_XPATH, que apunta al <button> con título 'Save'
    y cuyo interior contiene el div.el-button-slot-wrapper con texto 'Save'.
    """
    step_name = "[7] CLICK_EXPORT_EVENT_AND_ALARM_SAVE_BUTTON"
    try:
        drawer = get_visible_export_container(driver, timeout=timeout)
        click_save_in_container(driver, drawer, timeout=timeout)

        if timer is not None:
            timer.mark(step_name)

    except TimeoutException:
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


def export_event_alarms(driver, wait, export_password: str, logger=None) -> bool:
    log_step("🚀 EXPORT: inicio", logger)

    try:
        log_step("🔹 STEP EXPORT-01: Click Export (toolbar)...", logger)
        click_export_toolbar_button(driver, timeout=12, logger=logger)

        # A veces aparece un menú para elegir Excel
        try:
            click_seguro(
                driver,
                By.XPATH,
                "//*[normalize-space()='Excel']/ancestor-or-self::*[self::li or self::button or "
                "self::a or self::div][1]",
                "Excel",
                timeout=3,
                logger=logger,
            )
        except Exception:
            pass

        log_step("🔹 STEP EXPORT-02: Completar modal Export...", logger)
        try:
            complete_export_modal(driver, export_password, timeout=20)
        except Exception:
            try:
                take_screenshot(driver, "export_password_failed")
            except Exception:
                pass
            try:
                dump_export_modal_html(driver, "export_modal_failed")
            except Exception:
                pass
            log_step("⚠️ Export modal falló, intentando flujo alternativo...", logger)
            click_export_and_enter_password(
                driver,
                export_password,
                logger=logger,
                timeout=20,
            )

        log_step("✅ EXPORT: completado", logger)
        return True

    except Exception as exc:
        log_step(f"❌ EXPORT: FAIL -> {exc}", logger)
        try:
            take_screenshot(driver, "export_flow_failed")
        except Exception:
            pass
        return False


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

    # snapshot del downloadcenter ANTES de exportar
    downloadcenter_root = get_downloadcenter_root()
    before = snapshot_alarm_reports(downloadcenter_root)
    print(f"[EXPORT] Downloadcenter: {downloadcenter_root}")

    export_password = password or HIK_EXPORT_PASSWORD
    ok = export_event_alarms(driver, wait, export_password, logger=print)
    if not ok:
        print("[EXPORT] Export falló, se aborta la espera de descarga.")
        return None

    if timer:
        timer.mark("[7] CLICK_EXPORT_EVENT_AND_ALARM")

    save_ts = time.time()

    # Esperar el archivo REAL en Downloadcenter (NO en DOWNLOAD_DIR)
    log_info = globals().get("log_info", print)
    log_error = globals().get("log_error", print)
    log_info("[EXPORT] Esperando Alarm_Report_* en Downloadcenter (HCWebControlService)...")
    src_file = wait_new_alarm_report(
        downloadcenter_root,
        before,
        start_ts=save_ts,
        timeout=max(300, timeout),
    )

    if not src_file or not src_file.exists():
        log_error("[ERROR] No se detectó Alarm_Report_* en Downloadcenter.")
        take_screenshot(driver, "event_and_alarm_search_no_file")
        return None

    # Copiar a tu downloads por host y renombrar
    limpiar_descargas(download_dir)  # limpia SOLO tu carpeta destino
    final_file = copiar_alarm_report_a_downloads(src_file, download_dir, host_label)
    log_info(f"[EXPORT] Archivo detectado en Downloadcenter: {src_file}")
    log_info(f"[EXPORT] Archivo copiado a: {final_file}")

    if timer:
        timer.mark("[9] Descarga detectada")

    return final_file


def click_trigger_filter(
    driver, mode: str, timeout=20, timer: StepTimer | None = None
):
    """
    En la pantalla 'Event and Alarm Search' hace clic en el botón del filtro Trigger Alarm.
    mode: ALL / TRIGGER / NOT_TRIGGER
    """

    # Asegurar que la pantalla de Event and Alarm Search está cargada
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located(
            (By.XPATH, "//*[contains(normalize-space(),'Event and Alarm Search')]")
        )
    )

    label = {"ALL": "All", "TRIGGER": "Trigger Alarm", "NOT_TRIGGER": "Not Trigger Alarm"}[
        mode
    ]
    btn_xpath = (
        f"//div[@title='{label}' "
        "and contains(@class,'button') "
        f"and normalize-space()='{label}']"
    )

    btn = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.XPATH, btn_xpath))
    )
    safe_js_click(driver, btn)

    WebDriverWait(driver, timeout).until(
        lambda d: "select" in d.find_element(By.XPATH, btn_xpath).get_attribute("class")
    )

    print(f"[9] Botón '{label}' seleccionado correctamente.")
    if timer:
        timer.mark(f"[9] CLICK_TRIGGER_FILTER_{mode}")


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
        total_pre = len(df)
        if total_pre == 0:
            log_info("[EVENT] Report sin registros (0 filas). Se omite carga.")
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
                    (0, 0, 0, id_extraccion),
                )
            conn.commit()
            return {"filas_extraidas": 0, "insertados": 0, "omitidos_duplicado": 0}

        # IMPORTANTE:
        # En muchos reportes la columna "Mark" viene vacía (checkbox),
        # así que NO debemos filtrar por Mark. En su lugar, filtramos por
        # columnas de negocio que sí deberían tener datos.
        key_cols = [
            "Name",
            "Triggering Time (Client)",
            "Source",
            "Region",
            "Trigger Event",
        ]

        def _has_data(v) -> bool:
            if v is None or pd.isna(v):
                return False
            s = str(v).strip()
            if s == "" or s.lower() == "nan":
                return False
            return True

        # mantener filas donde al menos una columna clave tenga data
        if all(c in df.columns for c in key_cols):
            mask = df[key_cols].apply(lambda s: s.map(_has_data)).any(axis=1)
            total_before = len(df)
            df = df[mask].copy()
            log_info(
                "[EVENT] Filas después de filtro por columnas clave: "
                f"{len(df)} (antes: {total_before})"
            )
        else:
            log_info(
                "[WARN] No se pudo aplicar filtro por columnas clave. "
                f"Columnas presentes: {list(df.columns)}"
            )

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
        df = df.map(to_py)

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

        if df.empty:
            # guardar evidencia rápida para debug
            try:
                LOG_DIR.mkdir(parents=True, exist_ok=True)
                debug_csv = (
                    LOG_DIR
                    / f"debug_alarm_report_vacio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                )
                # intenta salvar primeras 50 filas del RAW (sin romper)
                raw.head(50).to_csv(debug_csv, index=False, header=False)
                log_info(f"[DEBUG] Se guardó RAW preview (50 filas) en: {debug_csv}")
            except Exception as e:
                log_info(f"[DEBUG] No se pudo guardar preview RAW: {e}")

        if df[required_data_cols].dropna(how="all").empty:
            log_info(
                "[EVENT] Report sin datos en columnas requeridas. Se omite carga (0 filas)."
            )
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
                    (0, 0, 0, id_extraccion),
                )
            conn.commit()
            return {"filas_extraidas": 0, "insertados": 0, "omitidos_duplicado": 0}

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
                normalize_value(row.get("priority")),
                normalize_value(row.get("status")),
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
            sql = """
                INSERT INTO public.hik_alarm_evento (
                    ID_EXTRACCION,
                    MARK,
                    NAME,
                    TRIGGER_ALARM,
                    PRIORITY,
                    TRIGGERING_TIME_CLIENT,
                    SOURCE,
                    REGION,
                    TRIGGER_EVENT,
                    DESCRIPTION,
                    STATUS,
                    ALARM_ACKNOWLEDGMENT_TIME,
                    ALARM_CATEGORY,
                    REMARKS,
                    MORE,
                    EVENT_KEY,
                    PERIODO,
                    FECHA_CREACION
                )
                VALUES %s
                ON CONFLICT (EVENT_KEY) DO NOTHING;
            """
            with conn.cursor() as cur:
                execute_values(cur, sql, rows, page_size=500)
                total_insertados = cur.rowcount
            conn.commit()
            total_omitidos = total_preparados - total_insertados
            log_info(f"[INFO] Total registros preparados: {total_preparados}")
            log_info(f"[INFO] Insertados: {total_insertados}")
            log_info(f"[INFO] Omitidos por duplicado: {total_omitidos}")

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
        df = df.map(to_py)

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


def run_for_host(host: str, trigger_filter_mode: str) -> dict:
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
        click_trigger_filter(driver, trigger_filter_mode, timeout=30, timer=timer)
        click_search_button(driver, timeout=40, timer=timer)

        limpiar_descargas(host_dir)
        export_file_path = click_export_event_and_alarm(
            driver,
            password=HIK_EXPORT_PASSWORD,
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
    parser.add_argument("--hosts", type=str, help="Hosts/IP separados por coma")
    parser.add_argument(
        "--trigger-filter",
        type=str,
        default="ALL",
        choices=["ALL", "TRIGGER", "NOT_TRIGGER"],
        help="Filtro Trigger Alarm en Event and Alarm Search",
    )
    args = parser.parse_args()

    if args.host or args.hosts:
        hosts_to_run = parse_hosts_from_args(args.host, args.hosts)
    else:
        hosts_to_run = parse_hosts_from_env()

    trigger_filter_mode = args.trigger_filter.upper()
    resultados = []
    for host in hosts_to_run:
        if not host_is_up(host):
            print(f"[WARN] Host no responde: {host}. Se omite.")
            resultados.append(
                {
                    "host": host,
                    "ok": False,
                    "error": "Host no responde",
                    "archivo": None,
                    "filas_extraidas": 0,
                    "insertados": 0,
                    "omitidos_duplicado": 0,
                }
            )
            continue

        try:
            res = run_for_host(host, trigger_filter_mode)
            resultados.append(res)
        except Exception as ex:
            print(f"[ERROR] Falló host {host}: {ex}")
            resultados.append({"host": host, "ok": False, "error": str(ex)})

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
