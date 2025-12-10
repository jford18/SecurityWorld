import argparse
import os
import time
import traceback
from pathlib import Path

import psutil

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


class StepTimer:
    def __init__(self):
        self.start = time.perf_counter()
        self.last = self.start
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
        mem = psutil.virtual_memory()
        mem_percent = mem.percent                               # % RAM total usada
        proc_mem_mb = self.proc.memory_info().rss / (1024**2)   # MB usados por este script

        print(
            f"[PERF] {label:<45} "
            f"paso: {step_secs:6.2f}s | total: {total_secs:6.2f}s | "
            f"CPU: {cpu_percent:5.1f}% | RAM: {mem_percent:5.1f}% | "
            f"PY-MEM: {proc_mem_mb:6.1f} MB"
        )

        self.last = now


# ========================
# CONFIGURACIÓN GENERAL
# ========================
URL = "https://172.16.9.253/#"
HIK_USER = os.getenv("HIK_USER", "Analitica_reportes")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "AbcDef*91Ghj#")

DOWNLOAD_DIR = Path(r"C:\\portal-sw\\SecurityWorld\\hikcentral_rpa\\downloads")

step_timer: StepTimer | None = None


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

    for by, selector in locators:
        try:
            elem = wait.until(EC.element_to_be_clickable((by, selector)))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", elem)
            try:
                elem.click()
            except Exception:
                driver.execute_script("arguments[0].click();", elem)
            if step_timer:
                step_timer.mark("[5] Menú Resource Status")
            return
        except TimeoutException:
            continue

    raise Exception("No se pudo hacer clic en el menú 'Resource Status'")


def seleccionar_opcion_resource_status(driver, wait, opcion: str):
    """
    Asume que el submenú 'Resource Status' ya está expandido.
    Hace clic en la opción indicada (por ejemplo 'Camera' o 'Encoding Device').
    """
    print(f"[6] Seleccionando {opcion}...")

    try:
        # Intento principal: li con title = opcion
        try:
            item = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        f"//li[contains(@class,'el-menu-item') and @title='{opcion}']",
                    )
                )
            )
        except TimeoutException:
            # Fallback por texto visible
            item = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        f"//span[@title='{opcion}' or normalize-space(text())='{opcion}']/ancestor::li[contains(@class,'el-menu-item')]",
                    )
                )
            )

        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", item)
        driver.execute_script("arguments[0].click();", item)

        if step_timer:
            step_timer.mark(f"[6] Opción '{opcion}'")

    except TimeoutException:
        raise Exception(f"No se pudo hacer clic en la opción '{opcion}' del menú Resource Status")


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

    baseline_cpu = psutil.cpu_percent(interval=1)
    baseline_ram = psutil.virtual_memory().percent
    print(f"[PERF] [0] Baseline antes de automatizar... CPU: {baseline_cpu:.1f}% | RAM: {baseline_ram:.1f}%")

    driver = None
    global step_timer
    step_timer = StepTimer()
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
            export_resource_status_to_excel(driver, wait, DOWNLOAD_DIR, opcion)

            if timer:
                timer.mark("[8] Export completado")

            print(f"[OK] Export de '{opcion}' completado.")
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
        print(f"[PERF] [FIN] Estado al terminar script... CPU: {final_cpu:.1f}% | RAM: {final_ram:.1f}%")


if __name__ == "__main__":
    run()
