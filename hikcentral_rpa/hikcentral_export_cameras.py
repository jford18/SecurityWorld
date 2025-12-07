import os
import time
import traceback
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import ElementClickInterceptedException, TimeoutException
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

URL = "http://181.198.203.254:443/#/"

HIK_USER = os.getenv("HIK_USER", "SeguraM")
HIK_PASSWORD = os.getenv("HIK_PASSWORD", "Victor1a3467!")

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)


def configurar_navegador() -> webdriver.Chrome:
    """Configura Chrome con Selenium, carpeta de descargas y manejo de certificado."""

    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--ignore-certificate-errors")  # certificado no confiable
    chrome_options.add_argument("--disable-notifications")

    prefs = {
        "download.default_directory": str(DOWNLOAD_DIR),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
    }
    chrome_options.add_experimental_option("prefs", prefs)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def limpiar_descargas():
    """Elimina archivos previos en la carpeta de descargas para identificar el nuevo Excel."""
    for f in DOWNLOAD_DIR.glob("*"):
        try:
            f.unlink()
        except Exception:
            pass


def esperar_descarga(timeout: int = 60) -> Path:
    """
    Espera hasta que exista algún archivo descargado sin extensión .crdownload.
    Devuelve la ruta del archivo descargado.
    """
    fin = time.time() + timeout
    ultimo_archivo = None

    while time.time() < fin:
        archivos = list(DOWNLOAD_DIR.glob("*"))
        if archivos:
            # Ignorar archivos temporales .crdownload
            archivos_finales = [f for f in archivos if not f.name.endswith(".crdownload")]
            if archivos_finales:
                ultimo_archivo = max(archivos_finales, key=lambda x: x.stat().st_mtime)
                return ultimo_archivo
        time.sleep(1)

    raise TimeoutError("No se detectó ningún archivo descargado en el tiempo esperado.")


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


def run():
    driver = configurar_navegador()
    wait = WebDriverWait(driver, 30)

    try:
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

        print("[4] Buscando pestaña Maintenance en el menú superior...")

        try:
            maintenance_tab = None

            # 1) Intentar primero como link <a> por texto exacto
            try:
                maintenance_tab = wait.until(
                    EC.element_to_be_clickable((By.LINK_TEXT, "Maintenance"))
                )
            except TimeoutException:
                pass

            # 2) Si no se encontró, buscar por texto exacto en cualquier tag visible
            if maintenance_tab is None:
                candidates = driver.find_elements(
                    By.XPATH,
                    "//*[normalize-space(text())='Maintenance']"
                )
                visible = [el for el in candidates if el.is_displayed()]
                if visible:
                    # Tomar el primero visible
                    maintenance_tab = visible[0]

            if maintenance_tab is None:
                raise TimeoutException("No se encontró ningún elemento visible con texto 'Maintenance'")

            print("[4] Abriendo pestaña Maintenance...")

            clicked = False

            # 3) Intentar click directo
            try:
                maintenance_tab.click()
                clicked = True
            except ElementClickInterceptedException:
                clicked = False
            except Exception:
                clicked = False

            # 4) Si el click directo falla, intentar con ActionChains
            if not clicked:
                try:
                    actions = ActionChains(driver)
                    actions.move_to_element(maintenance_tab).click().perform()
                    clicked = True
                except Exception:
                    clicked = False

            # 5) Si aún falla, usar JavaScript como último recurso
            if not clicked:
                driver.execute_script("arguments[0].click();", maintenance_tab)

            # 6) Una vez clicado Maintenance, esperar a que aparezca el submenú Resource Status
            wait.until(
                EC.visibility_of_element_located((By.ID, "subMenuTitle2"))
            )

        except Exception as e:
            print(f"[ERROR] Ocurrió un problema al abrir Maintenance: {e}")
            raise Exception("No se pudo hacer clic en la pestaña 'Maintenance'")

        print("[5] Abriendo menú Resource Status...")

        try:
            # Espera a que el span de Resource Status sea clickeable
            resource_status_span = wait.until(
                EC.element_to_be_clickable((By.ID, "subMenuTitle2"))
            )

            try:
                resource_status_span.click()
            except Exception:
                # Fallback con JavaScript si el click normal falla
                driver.execute_script("arguments[0].click();", resource_status_span)

        except Exception as e:
            print(f"[ERROR] Detalle al intentar abrir Resource Status: {e}")
            raise Exception("No se pudo hacer clic en el menú 'Resource Status'")

        print("[6] Seleccionando Camera...")

        try:
            camera_tab = wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//i[contains(@class, 'icon-svg-nav_realtime_status_cameras')]/ancestor::li[1]")
                )
            )
            camera_tab.click()
        except Exception:
            raise Exception("No se pudo hacer clic en la pestaña 'Cameras'")

        # Esperar a que cargue la tabla y el botón Export
        print("[7] Esperando que cargue la tabla de cámaras...")
        export_button = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Export']"))
        )

        # ========================
        # EXPORTAR A EXCEL
        # ========================
        print("[8] Abriendo panel de Export...")
        limpiar_descargas()
        export_button.click()

        print("[9] Seleccionando formato Excel...")
        excel_option = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Excel']"))
        )
        excel_option.click()

        print("[10] Ejecutando exportación...")
        panel_export_button = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "(//*[normalize-space(text())='Export'])[last()]")
            )
        )
        panel_export_button.click()

        print("[11] Esperando que se descargue el archivo Excel...")
        archivo = esperar_descarga(timeout=90)

        print(f"[OK] Archivo descargado en: {archivo}")

    except Exception as e:
        print(f"[ERROR] Ocurrió un problema: {e.__class__.__name__}: {e}")
        traceback.print_exc()
    finally:
        driver.quit()


if __name__ == "__main__":
    run()
