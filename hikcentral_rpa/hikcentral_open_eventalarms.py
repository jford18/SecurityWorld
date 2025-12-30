import os
import time
import traceback
from datetime import datetime
from pathlib import Path

import psutil
import psycopg2
from dotenv import load_dotenv
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
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

URL = "http://172.16.9.10/#/"
SCRIPT_NAME = "hikcentral_open_eventalarms.py"
HIK_USER = os.getenv("HIK_USER", "Analitica_reportes")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "SW2112asm")

LOG_DIR = Path(r"C:\\portal-sw\\SecurityWorld\\hikcentral_rpa\\logs")

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


def safe_click(driver, element):
    driver.execute_script(
        "arguments[0].scrollIntoView({block: 'center', inline: 'center'});", element
    )
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)


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


def validar_event_and_alarm_abierto(driver, timeout: int = 10):
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//*[contains(@class,'top-nav') or contains(@class,'nav') or contains(@class,'tab')]/"
                    "descendant::*[@title='Event and Alarm' or normalize-space()='Event and Alarm']",
                )
            )
        )
        return True
    except TimeoutException:
        return False


def abrir_event_and_alarm(driver, timer: StepTimer | None = None, timeout: int = 40):
    wait = WebDriverWait(driver, timeout)
    top_nav_xpath = (
        "//*[self::div or self::span or self::a][normalize-space()='Event and Alarm' "
        "and not(ancestor-or-self::*[contains(@style,'display: none')])]"
    )

    print("[3] Navegando a Event and Alarm...")
    cerrar_overlays(driver)
    wait.until(
        EC.presence_of_element_located(
            (
                By.XPATH,
                "//*[contains(@class,'top-nav') or contains(@class,'header') or @role='navigation']",
            )
        )
    )

    usado = None

    # Fallback A: Tab superior visible
    try:
        print("[3A] Intentando abrir pestaña superior 'Event and Alarm'...")
        tab_superior = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.XPATH, top_nav_xpath))
        )
        safe_click(driver, tab_superior)
        if validar_event_and_alarm_abierto(driver):
            usado = "A"
            print("[INFO] Apertura por pestaña superior exitosa.")
    except TimeoutException:
        pass

    # Fallback B: Menú de más pestañas
    if not usado:
        try:
            print("[3B] Intentando abrir desde menú de más pestañas...")
            more_tabs_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, "i.icon-svg-common_more_hori_btn.el-dropdown-selfdefine")
                )
            )
            safe_click(driver, more_tabs_btn)

            dropdown_item = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//ul[contains(@class,'top-nav-menu')]//li[@title='Event and Alarm' "
                    "and contains(@class,'el-dropdown-menu__item')]",
                )
                )
            )
            safe_click(driver, dropdown_item)
            if validar_event_and_alarm_abierto(driver):
                usado = "B"
                print("[INFO] Apertura por menú de pestañas exitosa.")
        except TimeoutException:
            pass

    # Fallback C: Launcher Applications
    if not usado:
        print("[3C] Intentando abrir desde launcher de Applications...")
        try:
            apps_container = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "(//i[@title='Applications' and contains(@class,'app-btn')]/"
                        "ancestor::span[contains(@class,'el-popover-wrap')])[1]",
                    )
                )
            )
            safe_click(driver, apps_container)
            usado = "C"

            event_card = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "(//span[@title='Event and Alarm Search' and contains(@class,'sub-name-key')]/"
                        "ancestor::div[contains(@class,'item-card')])[1]",
                    )
                )
            )
            safe_click(driver, event_card)
        except TimeoutException:
            raise TimeoutException("No se pudo abrir Event and Alarm por ningún método")

    if timer:
        if usado == "A":
            timer.mark("[3] Event and Alarm - pestaña superior")
            timer.mark("[4] Abrir Event and Alarm Search")
        elif usado == "B":
            timer.mark("[3] Event and Alarm - menú de pestañas")
            timer.mark("[4] Abrir Event and Alarm Search")
        elif usado == "C":
            timer.mark("[3] Abrir Applications (fallback)")
            timer.mark("[4] Abrir Event and Alarm Search")

    print("[5] Validar Event and Alarm Search visible...")
    wait.until(
        EC.visibility_of_element_located(
            (
                By.XPATH,
                "//*[normalize-space()='Event and Alarm Search' or @title='Event and Alarm Search']",
            )
        )
    )
    if timer:
        timer.mark("[5] Validar Event and Alarm Search visible")


def crear_driver() -> webdriver.Chrome:
    """Configura y devuelve un driver de Chrome."""

    chrome_options = Options()
    chrome_options.add_argument("--ignore-certificate-errors")
    chrome_options.add_argument("--allow-running-insecure-content")
    chrome_options.add_argument("--safebrowsing-disable-download-protection")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--disable-features=BlockInsecureDownloadRestrictions,DownloadBubble")
    chrome_options.add_argument("--start-maximized")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    driver.maximize_window()
    return driver


def run():
    global step_timer, performance_recorder

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
    step_timer = StepTimer(
        start_time=performance_recorder.start_time if performance_recorder else None,
        recorder=performance_recorder,
    )
    timer = step_timer

    try:
        driver = crear_driver()
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

        print("[3] Navegando a Event and Alarm...")
        driver.switch_to.default_content()
        abrir_event_and_alarm(driver, timer=timer)

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        screenshot_path = LOG_DIR / f"event_and_alarm_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        driver.save_screenshot(str(screenshot_path))
        print(f"[INFO] Screenshot guardado en: {screenshot_path}")
        if timer:
            timer.mark("[6] SCREENSHOT_FINAL")

        print("[OK] Flujo Event and Alarm completado.")
        if timer:
            timer.mark("[7] FIN_OK")

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
    run()
