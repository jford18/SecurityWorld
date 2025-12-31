import os
import time
import traceback
from datetime import datetime
from pathlib import Path

import psutil
import psycopg2
from dotenv import load_dotenv
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    StaleElementReferenceException,
    TimeoutException,
)
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


def click_boton_buscar_event_and_alarm(driver, wait: WebDriverWait, timeout: int = 25):
    """
    Dentro del módulo 'Event and Alarm' hace clic en el menú lateral 'Search'
    (icono de lupa) para que se despliegue la lista con 'Overview' y
    'Event and Alarm Search'.
    """
    print("[5] Abriendo menú Search (lupa)...")

    # Asegurar que estamos en el documento principal
    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    # Intentar validar que estamos en la vista de Alarm Analysis antes de buscar la lupa
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//*[contains(normalize-space(),'Alarm Analysis') "
                    "or contains(normalize-space(),'Alarm Trend')]",
                )
            )
        )
    except TimeoutException:
        print("[WARN] No se pudo validar 'Alarm Analysis', continúo igual.")

    # Distintos selectores para localizar el menú Search
    xpaths_candidates = [
        # 1) Por texto Search en el título del submenu
        ("//span[contains(@class,'el-submenu__title-text') "
         "and normalize-space()='Search']/ancestor::div[contains(@class,'el-submenu__title')][1]"),
        # 2) Por el icono de lupa y el contenedor de título
        ("//i[contains(@class,'icon-svg-nav_search') "
         "or contains(@class,'nav_search')]/ancestor::div[contains(@class,'el-submenu__title')][1]"),
        # 3) Fallback: por el <li> que contiene el icono Search
        ("//i[contains(@class,'icon-svg-nav_search') "
         "or contains(@class,'nav_search')]/ancestor::li[1]"),
    ]

    last_error = None
    search_element = None

    for xp in xpaths_candidates:
        try:
            search_element = wait.until(
                EC.element_to_be_clickable((By.XPATH, xp))
            )
            break
        except Exception as e:
            last_error = e
            continue

    if not search_element:
        raise TimeoutException(f"No se pudo localizar el menú Search. Último error: {last_error}")

    # Clic con JS para asegurarnos de disparar el evento del menú
    safe_js_click(driver, search_element)

    # Validar que se desplegó el menú: debe aparecer 'Event and Alarm Search'
    try:
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located(
                (By.XPATH, "//span[normalize-space()='Event and Alarm Search']")
            )
        )
        print("[5] Menú Search desplegado correctamente.")
    except TimeoutException:
        print("[WARN] Después del clic no se vio 'Event and Alarm Search', pero continúo.")

    if step_timer:
        step_timer.mark("[5] CLICK_MENU_SEARCH")


def wait_visible(driver, by, value, timeout=20):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def wait_click(driver, by, value, timeout=20):
    el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, value)))
    safe_click(driver, el)
    return el


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


def click_sidebar_alarm_search(driver, timeout=20, timer: StepTimer | None = None):
    """
    Hace clic en el icono de lupa del menú lateral (Search),
    usando el contenedor .el-submenu__title.
    """
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )

    sidebar_container = driver.execute_script(
        """
        const icons = Array.from(
            document.querySelectorAll("i.icon-svg-nav_search, i.h-icon-search, i[class*='nav_search']")
        );
        const visibles = icons.filter(e => e && e.offsetParent !== null);
        if (!visibles.length) return null;
        visibles.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        const icon = visibles[0];
        let container = icon;
        let node = icon;
        while (node) {
            if (node.classList && node.classList.contains('el-submenu__title')) {
                container = node;
                break;
            }
            node = node.parentElement;
        }
        return container;
        """
    )

    if not sidebar_container:
        raise TimeoutException("No se encontró el menú Search del lateral.")

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", sidebar_container)
    driver.execute_script("arguments[0].click();", sidebar_container)

    try:
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located(
                (By.XPATH, "//span[normalize-space()='Event and Alarm Search']")
            )
        )
        print("[4] Menú Search desplegado.")
    except TimeoutException:
        # No re-lanzar la excepción, solo avisar y continuar
        print(
            "[WARN] Después de hacer clic en la lupa no se pudo validar "
            "'Event and Alarm Search', pero continúo de todas formas."
        )

    if timer:
        timer.mark("[4] CLICK_SIDEBAR_SEARCH")


def click_sidebar_event_and_alarm_search(driver, timeout=20, timer: StepTimer | None = None):
    """
    Después de abrir el submenú con la lupa, hace clic en la opción 'Event and Alarm Search'.
    """
    # Opción principal: ítem del submenú lateral
    item_xpath = (
        "//li[contains(@class,'el-menu-item') and "
        ".//span[normalize-space()='Event and Alarm Search']]"
    )

    try:
        item = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.XPATH, item_xpath))
        )
    except TimeoutException:
        # Respaldo: enlace con title/botón en Recently Viewed
        fallback_xpath = (
            "//*[@title='Event and Alarm Search' or "
            "normalize-space(text())='Event and Alarm Search']"
        )
        item = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.XPATH, fallback_xpath))
        )

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", item)
    driver.execute_script("arguments[0].click();", item)

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
    wait: WebDriverWait | None = None
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

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        screenshot_path = LOG_DIR / f"event_and_alarm_search_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        driver.save_screenshot(str(screenshot_path))
        print(f"[INFO] Screenshot guardado en: {screenshot_path}")
        if timer:
            timer.mark("[7] SCREENSHOT_EVENT_AND_ALARM_SEARCH")

        print("[OK] Flujo Event and Alarm Search completado.")
        if timer:
            timer.mark("[8] FIN_OK")

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
    run()
