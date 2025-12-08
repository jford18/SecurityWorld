import os
import time
import traceback
from pathlib import Path

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


# ========================
# CONFIGURACIÓN GENERAL
# ========================

#URL = "http://181.198.203.254:443/#/"
URL = "https://172.16.9.253/#"
HIK_USER = os.getenv("HIK_USER", "Analitica_reportes")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "AbcDef*91Ghj#")

DOWNLOAD_DIR = Path(r"C:\\portal-sw\SecurityWorld\hikcentral_rpa\downloads")


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
            return ruta

        if time.time() - inicio > timeout:
            raise TimeoutError("No se detectó ningún archivo descargado en el tiempo esperado.")

        time.sleep(2)


def export_camera_status_to_excel(driver: webdriver.Chrome, wait: WebDriverWait, download_dir: Path = DOWNLOAD_DIR):
    """
    Ejecuta el flujo completo de exportación de cámaras a Excel desde la pestaña Camera
    en Resource Status.
    """

    print("[8] Abriendo panel de exportación desde Camera...")

    # Guardar listado previo de archivos para detectar el nuevo
    archivos_previos = os.listdir(DOWNLOAD_DIR)

    # 1) Click en el botón Export del header de la pestaña Camera
    export_toolbar_button = wait.until(
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
    driver.execute_script("arguments[0].click();", export_toolbar_button)

    # 2) Esperar a que se abra el drawer/panel de Export
    wait.until(
        EC.visibility_of_element_located(
            (
                By.XPATH,
                "//div[contains(@class,'drawer')]//span[contains(@class,'drawer-head-title') and normalize-space()='Export']",
            )
        )
    )

    # 3) Seleccionar opción Excel si existe
    excel_options = driver.find_elements(
        By.XPATH,
        "//div[contains(@class,'drawer')]//label[contains(@class,'el-radio') and (translate(@title,'excel','EXCEL')='EXCEL' or .//span[normalize-space()='Excel'])]",
    )
    if excel_options:
        excel_option = wait.until(EC.element_to_be_clickable(excel_options[0]))
        driver.execute_script("arguments[0].click();", excel_option)

    # 4) Click en el botón Export dentro del panel/drawer (no Export All)
    export_confirm_button = wait.until(
        EC.element_to_be_clickable(
            (
                By.XPATH,
                "(//div[contains(@class,'drawer') or contains(@class,'el-dialog__footer')]//button[.//div[normalize-space()='Export']])[last()]",
            )
        )
    )
    driver.execute_script("arguments[0].click();", export_confirm_button)

    # 5) Esperar que el archivo termine de descargarse en download_dir
    archivo_descargado = esperar_descarga(DOWNLOAD_DIR, archivos_previos, timeout=180)
    print(f"[10] Archivo descargado en: {archivo_descargado}")


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
            EC.element_to_be_clickable((
                By.XPATH,
                "//button[contains(@class,'el-button') "
                "and .//div[contains(@class,'el-button-slot-wrapper') "
                "and normalize-space()='Go to Maintenance']]"
            ))
        )
        driver.execute_script("arguments[0].click();", boton_go)
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
            EC.element_to_be_clickable((
                By.XPATH,
                "//div[@id='navigation_menuPop']"
                "//div[contains(@id,'nav_box_s_menu_resourcemaintain_operations')]"
                "//span[@title='Maintenance']"
            ))
        )
        driver.execute_script("arguments[0].click();", opcion_maintenance)
        return
    except TimeoutException:
        print("   [Aviso] Menú 'Maintenance' no disponible, pruebo pestaña superior...")

    # 3) Intentar pestaña superior "Maintenance" (comportamiento del primer ambiente)
    try:
        tab_maintenance = wait.until(
            EC.element_to_be_clickable((
                By.XPATH,
                "//div[contains(@class,'el-tabs__nav')]"
                "//div[contains(@class,'el-tabs__item') and normalize-space()='Maintenance']"
            ))
        )
        driver.execute_script("arguments[0].click();", tab_maintenance)
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
            return
        except TimeoutException:
            continue

    raise Exception("No se pudo hacer clic en el menú 'Resource Status'")


def esperar_tabla_camaras(driver, wait, timeout: int = 30):
    """
    Espera a que la tabla de cámaras esté lista:
    - con filas, o
    - con el mensaje de tabla vacía.
    """
    print("[7] Esperando que cargue la tabla de cámaras...")

    def tabla_cargada(d):
        try:
            wrapper = d.find_element(By.CSS_SELECTOR, ".el-table__body-wrapper")
        except Exception:
            return False

        filas = wrapper.find_elements(By.CSS_SELECTOR, "tbody tr")
        empty = d.find_elements(By.CSS_SELECTOR, ".el-table__empty-block")
        # Consideramos que la tabla "cargó" si tiene filas o si aparece el bloque vacío
        return len(filas) > 0 or len(empty) > 0

    wait.until(tabla_cargada)


def run():
    driver = crear_driver()
    wait = WebDriverWait(driver, 30)

    try:
        print(f"[DEBUG] DOWNLOAD_DIR = {DOWNLOAD_DIR}")
        print("[1] Navegando a la URL...")
        driver.get(URL)

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

        # ========================
        # ESPERAR PORTAL PRINCIPAL
        # ========================
        print("[3] Esperando carga del portal principal...")

        # Esperar a que la URL cambie a /portal (login exitoso)
        wait.until(lambda d: "/portal" in d.current_url)

        ir_a_pestana_maintenance(driver, wait)

        abrir_menu_resource_status(driver, wait)

        print("[6] Seleccionando Camera...")

        try:
            camera_tab = None
            labels_to_try = ["Cameras", "Camera"]

            # 1) Intentar encontrar un <span> con texto exacto 'Cameras' o 'Camera'
            for label in labels_to_try:
                try:
                    camera_tab = wait.until(
                        EC.element_to_be_clickable(
                            (By.XPATH, f"//span[normalize-space(text())='{label}']")
                        )
                    )
                    break
                except TimeoutException:
                    camera_tab = None

            # 2) Si no se encontró, buscar cualquier elemento visible con ese texto
            if camera_tab is None:
                for label in labels_to_try:
                    candidates = driver.find_elements(
                        By.XPATH,
                        f"//*[normalize-space(text())='{label}']"
                    )
                    visible = [el for el in candidates if el.is_displayed()]
                    if visible:
                        camera_tab = visible[0]
                        break

            # 3) Como último intento, usar el icono de cameras y subir al padre clickeable
            if camera_tab is None:
                try:
                    camera_tab = wait.until(
                        EC.presence_of_element_located(
                            (
                                By.XPATH,
                                "//i[contains(@class, 'icon-svg-nav_realtime_status_cameras')]/ancestor::*[self::li or self::div or self::button][1]"
                            )
                        )
                    )
                except TimeoutException:
                    camera_tab = None

            if camera_tab is None:
                raise TimeoutException("No se encontró ningún elemento visible para la pestaña Camera/Cameras")

            # --- Realizar el click con varios fallbacks ---
            clicked = False

            # 4) Click directo
            try:
                camera_tab.click()
                clicked = True
            except ElementClickInterceptedException:
                clicked = False
            except Exception:
                clicked = False

            # 5) Si falla, usar ActionChains
            if not clicked:
                try:
                    actions = ActionChains(driver)
                    actions.move_to_element(camera_tab).click().perform()
                    clicked = True
                except Exception:
                    clicked = False

            # 6) Si aún falla, usar JavaScript
            if not clicked:
                driver.execute_script("arguments[0].click();", camera_tab)

        except Exception as e:
            print(f"[ERROR] Ocurrió un problema al seleccionar Camera: {e}")
            raise Exception("No se pudo hacer clic en la pestaña 'Cameras'")

        try:
            esperar_tabla_camaras(driver, wait)


            # 2) Iniciar el flujo robusto de exportación
            limpiar_descargas(DOWNLOAD_DIR)
            export_camera_status_to_excel(driver, wait, DOWNLOAD_DIR)

            # Aquí podrías añadir lógica adicional para renombrar/mover el archivo descargado
        except Exception as e:
            print(f"[ERROR] Ocurrió un problema en la exportación de cámaras: {e}")
            raise

    except Exception as e:
        print(f"[ERROR] Ocurrió un problema: {e.__class__.__name__}: {e}")
        traceback.print_exc()
    finally:
        driver.quit()


if __name__ == "__main__":
    run()
