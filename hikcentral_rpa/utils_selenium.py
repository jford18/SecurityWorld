from __future__ import annotations

from typing import Callable

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def _noop(_: str):
    return


def _wait_overlay_gone(driver, timeout: int = 8):
    overlay_selectors = [
        ".el-loading-mask",
        ".v-modal",
        ".el-message-box__wrapper",
    ]
    for selector in overlay_selectors:
        try:
            WebDriverWait(driver, timeout).until(
                EC.invisibility_of_element_located((By.CSS_SELECTOR, selector))
            )
        except TimeoutException:
            pass


def _try_logout_clicks(driver, timeout: int = 8) -> bool:
    user_selectors = [
        (By.CSS_SELECTOR, "div.top-right-area__avatar"),
        (By.CSS_SELECTOR, "div.head-user__wrapper"),
        (By.CSS_SELECTOR, "div.user-avatar"),
        (By.CSS_SELECTOR, "[class*='user'] [class*='avatar']"),
    ]

    logout_selectors = [
        (
            By.XPATH,
            "//*[self::span or self::li or self::a][contains(normalize-space(.), 'Log Out') or contains(normalize-space(.), 'Logout') or contains(normalize-space(.), 'Sign out') or contains(normalize-space(.), 'Cerrar sesión') or contains(normalize-space(.), 'Cerrar sesion')]",
        ),
        (By.XPATH, "//li[.//*[contains(normalize-space(.), 'Log Out') or contains(normalize-space(.), 'Logout')]]"),
    ]

    wait = WebDriverWait(driver, timeout)
    _wait_overlay_gone(driver, timeout=timeout)

    user_btn = None
    for selector in user_selectors:
        try:
            user_btn = wait.until(EC.element_to_be_clickable(selector))
            driver.execute_script("arguments[0].click();", user_btn)
            break
        except Exception:
            continue

    if user_btn is None:
        return False

    _wait_overlay_gone(driver, timeout=timeout)

    for selector in logout_selectors:
        try:
            logout_btn = wait.until(EC.element_to_be_clickable(selector))
            driver.execute_script("arguments[0].click();", logout_btn)
            wait.until(
                EC.any_of(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="User Name"]')),
                    EC.url_contains("/login"),
                    EC.url_contains("/#/"),
                )
            )
            return True
        except Exception:
            continue

    return False


def logout_hikcentral(
    driver,
    timeout: int = 8,
    log_warn: Callable[[str], None] | None = None,
    log_info: Callable[[str], None] | None = None,
) -> bool:
    """Intenta cerrar sesión en HikCentral en modo best-effort, sin propagar excepciones."""

    warn = log_warn or _noop
    info = log_info or _noop

    if driver is None:
        return False

    try:
        driver.switch_to.default_content()
        if _try_logout_clicks(driver, timeout=timeout):
            info("[INFO] Sesión cerrada correctamente.")
            return True

        for frame in driver.find_elements(By.CSS_SELECTOR, "iframe, frame"):
            try:
                driver.switch_to.default_content()
                driver.switch_to.frame(frame)
                if _try_logout_clicks(driver, timeout=timeout):
                    driver.switch_to.default_content()
                    info("[INFO] Sesión cerrada correctamente.")
                    return True
            except Exception:
                continue

        return False
    except Exception as exc:
        warn(f"[WARN] Error intentando cerrar sesión: {repr(exc)}")
        return False
    finally:
        try:
            driver.switch_to.default_content()
        except Exception:
            pass


def cleanup_browser(driver):
    """Limpieza adicional cuando logout no pudo completarse."""

    if not driver:
        return

    try:
        driver.delete_all_cookies()
    except Exception:
        pass

    try:
        driver.execute_script(
            "window.localStorage && window.localStorage.clear && window.localStorage.clear();"
        )
        driver.execute_script(
            "window.sessionStorage && window.sessionStorage.clear && window.sessionStorage.clear();"
        )
    except Exception:
        pass


def safe_quit(driver, log_warn: Callable[[str], None] | None = None):
    warn = log_warn or _noop
    try:
        if driver:
            driver.quit()
    except Exception as exc:
        warn(f"[WARN] Error al cerrar driver.quit(): {repr(exc)}")
