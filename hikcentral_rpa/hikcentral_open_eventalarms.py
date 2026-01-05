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


def click_search_button(driver, timeout: int = 20, timer: StepTimer | None = None):
    """
    En la pantalla 'Event and Alarm Search' hace clic en el botón rojo 'Search'
    para ejecutar la consulta con los filtros actuales.
    """
    print("[6] Haciendo clic en botón Search...")

    btn = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable(
            (
                By.XPATH,
                "//button[contains(@class,'el-button') and "
                "(normalize-space()='Search' or @title='Search')]",
            )
        )
    )

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
    driver.execute_script("arguments[0].click();", btn)

    # Esperar a que se carguen los resultados (al menos una celda en la tabla)
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//div[contains(@class,'hik-table')]//table//tr[1]//td",
                )
            )
        )
    except TimeoutException:
        # No lanzamos error duro, solo dejamos log
        print(
            "[WARN] No se pudo validar visualmente la carga de resultados después de Search."
        )

    print("[6] CLICK_SEARCH_BUTTON")
    if timer:
        timer.mark("[6] CLICK_SEARCH_BUTTON")


def click_export_event_and_alarm(driver, timeout: int = 30, timer: StepTimer | None = None):
    """
    En la pantalla 'Event and Alarm Search' hace clic en el botón/icono 'Export'
    que aparece en la parte superior derecha de la grilla.
    Debe funcionar aunque el botón sea un <button>, <div>, <span> o un icono con title='Export'.
    """
    print("[7] Abriendo panel Export en Event and Alarm Search...")

    # Asegurarnos de que la página terminó de renderizar
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )

    # Distintos XPATH para ubicar el botón o icono de Export
    xpaths = [
        # 1) Elemento con title='Export' que sea botón o esté dentro de uno
        "//*[@title='Export']/ancestor-or-self::button[1]",
        # 2) Span con texto 'Export' dentro de un botón
        "//span[normalize-space()='Export']/ancestor::button[1]",
        # 3) Cualquier elemento con title='Export' (icono, div, etc.)
        "//*[@title='Export']",
        # 4) Cualquier elemento visible cuyo texto sea exactamente 'Export'
        "//*[normalize-space(text())='Export']",
    ]

    export_el = None
    last_error = None

    for xp in xpaths:
        try:
            export_el = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.XPATH, xp))
            )
            # Si lo encontramos, ya no probamos más XPATH
            break
        except Exception as e:
            last_error = e
            continue

    if not export_el:
        # Si después de probar todos los XPATH no tenemos elemento, lanzamos TimeoutException
        raise TimeoutException(f"No se encontró el botón/icono Export. Último error: {last_error}")

    # Hacemos clic con JS para evitar problemas de overlays o de "element not clickable"
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", export_el)
    driver.execute_script("arguments[0].click();", export_el)

    print("[7] Botón Export clickeado en Event and Alarm Search.")

    WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located(
            (
                By.XPATH,
                "//div[contains(@class,'drawer')]//span[contains(@class,'drawer-head-title') and normalize-space()='Export']",
            )
        )
    )

    try:
        search_button = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//div[contains(@class,'drawer')]//button[contains(@class,'el-button--primary') and normalize-space()='Search']",
                )
            )
        )
    except Exception:
        search_button = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable(
                (
                    By.XPATH,
                    "//button[contains(@class,'el-button--primary') and normalize-space()='Search']",
                )
            )
        )

    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", search_button)
    driver.execute_script("arguments[0].click();", search_button)

    if timer:
        timer.mark("[7] CLICK_EXPORT_EVENT_AND_ALARM")


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
        click_trigger_alarm_button(driver, timeout=30, timer=timer)
        click_search_button(driver, timeout=30, timer=timer)

        limpiar_descargas(DOWNLOAD_DIR)
        click_export_event_and_alarm(driver, timeout=30, timer=timer)

        print("[8] Esperando descarga de Event and Alarm Search...")
        archivo = esperar_descarga_event_and_alarm(timeout=180)

        if archivo is None:
            print("[ERROR] No se detectó ningún archivo descargado desde Event and Alarm Search.")
        else:
            size_mb = archivo.stat().st_size / (1024 * 1024)
            print(f"[8] Archivo de Event and Alarm Search descargado: {archivo} ({size_mb:.2f} MB)")
            if timer:
                timer.mark("[8] EXPORT_DOWNLOAD_OK")

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        screenshot_path = LOG_DIR / f"event_and_alarm_search_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        driver.save_screenshot(str(screenshot_path))
        print(f"[INFO] Screenshot guardado en: {screenshot_path}")
        if timer:
            timer.mark("[9] SCREENSHOT_EVENT_AND_ALARM_SEARCH")

        print("[OK] Flujo Event and Alarm Search + Export completado.")
        if timer:
            timer.mark("[10] FIN_OK")

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
