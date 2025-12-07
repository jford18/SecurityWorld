import os
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


# ========================
# CONFIGURACIÓN GENERAL
# ========================

URL = "https://181.198.203.254:443/#/"

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

        # Esperar que aparezca la pestaña "Maintenance" en la barra superior
        print("[3] Esperando carga del portal principal...")
        maintenance_tab = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Maintenance']"))
        )

        # ========================
        # NAVEGAR A CAMERA
        # ========================
        print("[4] Abriendo pestaña Maintenance...")
        maintenance_tab.click()

        # Resource Status
        print("[5] Abriendo menú Resource Status...")
        resource_status = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//*[normalize-space(text())='Resource Status']")
            )
        )
        resource_status.click()

        # Camera
        print("[6] Seleccionando Camera...")
        camera_item = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Camera']"))
        )
        camera_item.click()

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

        # Opción Excel
        print("[9] Seleccionando formato Excel...")
        excel_option = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//*[normalize-space(text())='Excel']"))
        )
        excel_option.click()

        # Botón Export del panel lateral (tomamos el último botón con texto Export)
        print("[10] Ejecutando exportación...")
        panel_export_button = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "(//*[normalize-space(text())='Export'])[last()]")
            )
        )
        panel_export_button.click()

        # Esperar descarga
        print("[11] Esperando que se descargue el archivo Excel...")
        archivo = esperar_descarga(timeout=90)

        print(f"[OK] Archivo descargado en: {archivo}")

    except Exception as e:
        print(f"[ERROR] Ocurrió un problema: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    run()
