import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnv = () => {
  dotenv.config({ path: new URL('./manual.env', import.meta.url) });
};

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .replace(/-+/g, '-');

const ensureOutputDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const readPages = (pagesPath) => {
  const raw = fs.readFileSync(pagesPath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.slice().sort((a, b) => Number(a.order) - Number(b.order));
};

const buildUrl = (baseUrl, relativePath) => {
  const normalizedPath = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`;
  return new URL(normalizedPath, baseUrl).href;
};

const getTagName = async (locator) => {
  const handle = await locator.elementHandle();
  if (!handle) return null;
  return handle.evaluate((el) => el.tagName.toLowerCase());
};

const selectConsoleOption = async (selectLocator) => {
  const consoleName = process.env.MANUAL_CONSOLA;
  let selectedLabel = null;

  if (consoleName) {
    try {
      const result = await selectLocator.selectOption({ label: consoleName });
      if (result && result.length > 0) {
        selectedLabel = consoleName;
        return selectedLabel;
      }
    } catch (error) {
      console.warn(`No fue posible seleccionar la consola por etiqueta: ${consoleName}`, error);
    }
    try {
      const result = await selectLocator.selectOption(consoleName);
      if (result && result.length > 0) {
        selectedLabel = consoleName;
        return selectedLabel;
      }
    } catch (error) {
      console.warn(`No fue posible seleccionar la consola por valor: ${consoleName}`, error);
    }
  }

  const options = await selectLocator.locator('option').all();
  for (const option of options) {
    const value = (await option.getAttribute('value')) ?? '';
    if (value.trim() === '') {
      continue;
    }
    await selectLocator.selectOption(value);
    selectedLabel = (await option.textContent())?.trim() ?? value;
    break;
  }

  if (!selectedLabel && options.length > 0) {
    selectedLabel = (await options[0].textContent())?.trim() ?? null;
  }

  return selectedLabel;
};

const takeNamedScreenshot = async (page, outDir, filename) => {
  if (!outDir) return;
  const destination = path.resolve(outDir, filename);
  ensureOutputDir(path.dirname(destination));
  await page.screenshot({ path: destination, fullPage: true });
  console.log(`OK: ${filename}`);
};

const enterConsole = async (page, outDir) => {
  const consoleLabel = page.getByLabel('Seleccione Consola');
  const consoleText = page.getByText('Seleccione Consola', { exact: false });
  const fallbackSelect = page.locator('select').first();

  try {
    await Promise.race([
      consoleLabel.waitFor({ state: 'visible', timeout: 5000 }),
      consoleText.waitFor({ state: 'visible', timeout: 5000 }),
      fallbackSelect.waitFor({ state: 'visible', timeout: 5000 }),
    ]);
  } catch {
    console.log('Console screen not detected, continuing');
    return;
  }

  let selectedConsole = null;
  let consoleLocator = null;

  if (await consoleLabel.count()) {
    consoleLocator = consoleLabel;
  } else if (await fallbackSelect.count()) {
    const tagName = await getTagName(fallbackSelect);
    if (tagName === 'select') {
      consoleLocator = fallbackSelect;
    }
  }

  if (consoleLocator) {
    const tagName = await getTagName(consoleLocator);
    if (tagName === 'select') {
      selectedConsole = await selectConsoleOption(consoleLocator);
    } else {
      await consoleLocator.click();
      const consoleName = process.env.MANUAL_CONSOLA;
      let optionLocator = consoleName
        ? page.getByRole('option', { name: consoleName }).first()
        : page.getByRole('option').first();

      if (!(await optionLocator.count())) {
        optionLocator = consoleName
          ? page.getByText(consoleName, { exact: false }).first()
          : page.locator('[role="option"]').first();
      }

      if (await optionLocator.count()) {
        await optionLocator.click();
        selectedConsole = consoleName ?? (await optionLocator.textContent())?.trim() ?? null;
      }
    }
  } else {
    const container = consoleText.first();
    if (await container.count()) {
      const trigger = container.locator('..').locator('input,[role="combobox"],button').first();
      if (await trigger.count()) {
        await trigger.click();
        const consoleName = process.env.MANUAL_CONSOLA;
        let optionLocator = consoleName
          ? page.getByRole('option', { name: consoleName }).first()
          : page.getByRole('option').first();

        if (!(await optionLocator.count())) {
          optionLocator = consoleName
            ? page.getByText(consoleName, { exact: false }).first()
            : page.locator('[role="option"]').first();
        }

        if (await optionLocator.count()) {
          await optionLocator.click();
          selectedConsole = consoleName ?? (await optionLocator.textContent())?.trim() ?? null;
        }
      }
    }
  }

  await takeNamedScreenshot(page, outDir, '01-seleccion-consola.png');

  const enterButton = page.getByRole('button', { name: 'Ingresar' });
  if (await enterButton.count()) {
    await enterButton.click();
  }

  await Promise.allSettled([
    page.waitForSelector('text=PRINCIPAL', { timeout: 15000 }),
    page.waitForSelector('nav', { timeout: 15000 }),
  ]);

  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  } catch (error) {
    console.warn('No fue posible confirmar la salida de /login:', error);
  }

  console.log(`Consola seleccionada: ${selectedConsole ?? 'no seleccionada'}`);
  console.log(`URL tras ingresar: ${page.url()}`);

  await takeNamedScreenshot(page, outDir, '02-post-ingresar.png');
};

const takeScreenshot = async (page, outDir, entry) => {
  const filename = `${String(entry.order).padStart(2, '0')}-${slugify(entry.title)}.png`;
  await takeNamedScreenshot(page, outDir, filename);
};

const performLogin = async (page, baseUrl, credentials, outDir) => {
  await page.goto(buildUrl(baseUrl, '/login'), { waitUntil: 'networkidle' });
  await page.fill('input#username', credentials.user);
  await page.fill('input#password', credentials.pass);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  await enterConsole(page, outDir);
};

const waitForSidebar = async (page) => {
  await Promise.allSettled([
    page.waitForSelector('text=PRINCIPAL', { timeout: 15000 }),
    page.waitForSelector('aside nav', { timeout: 15000 }),
    page.waitForSelector('text=Dashboard', { timeout: 15000 }),
  ]);
};

const escapeRestrictedPage = async (page) => {
  await waitForSidebar(page);

  if (!page.url().includes('/sin-permiso')) {
    return;
  }

  const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
  const firstMenuLink = page.locator("aside a[href^='/']").first();

  if ((await dashboardLink.count()) > 0) {
    await dashboardLink.click();
  } else if ((await firstMenuLink.count()) > 0) {
    await firstMenuLink.click();
  }

  try {
    await page.waitForURL((url) => !url.pathname.includes('/sin-permiso'), { timeout: 10000 });
  } catch (error) {
    console.warn('No fue posible salir de /sin-permiso', error);
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
};

const navigateViaMenu = async (page, baseUrl, entry) => {
  const normalizedPath = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
  let clicked = false;

  const byHref = page.locator(`a[href="${normalizedPath}"]`).first();
  if ((await byHref.count()) > 0) {
    await byHref.click();
    clicked = true;
  } else {
    const menuText = entry.menuText ?? entry.title;
    const byText = page.getByRole('link', { name: menuText }).first();
    if ((await byText.count()) > 0) {
      await byText.click();
      clicked = true;
    }
  }

  if (!clicked) {
    await page.goto(buildUrl(baseUrl, normalizedPath), { waitUntil: 'networkidle' });
  }

  await page.waitForLoadState('networkidle');
  try {
    await page.waitForURL((url) => url.pathname.includes(normalizedPath), { timeout: 8000 });
  } catch {}

  return normalizedPath;
};

const isRestricted = async (page) => {
  const restrictedText = page.getByText('Acceso restringido', { exact: false });
  return (await restrictedText.isVisible()) || page.url().includes('/sin-permiso');
};

const main = async () => {
  loadEnv();

  const baseUrl = process.env.MANUAL_BASE_URL;
  const user = process.env.MANUAL_USER;
  const pass = process.env.MANUAL_PASS;
  const outDir = process.env.MANUAL_OUT;

  const missingVars = [];
  if (!baseUrl) missingVars.push('MANUAL_BASE_URL');
  if (!user) missingVars.push('MANUAL_USER');
  if (!pass) missingVars.push('MANUAL_PASS');
  if (!outDir) missingVars.push('MANUAL_OUT');

  if (missingVars.length > 0) {
    console.error(`Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  const pagesPath = path.join(__dirname, 'manual.pages.json');
  const pages = readPages(pagesPath);
  const loginEntry = pages.find((entry) => entry.path === '/login');

  const outputDir = path.resolve(process.cwd(), outDir);
  ensureOutputDir(outputDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  if (loginEntry) {
    await page.goto(buildUrl(baseUrl, loginEntry.path), { waitUntil: 'networkidle' });
    await takeScreenshot(page, outputDir, loginEntry);
  }

  await performLogin(page, baseUrl, { user, pass }, outputDir);
  await escapeRestrictedPage(page);

  for (const entry of pages) {
    if (entry.path === '/login') {
      continue;
    }
    const normalizedPath = await navigateViaMenu(page, baseUrl, entry);
    await page.waitForTimeout(500);

    const restricted = await isRestricted(page);
    const filename = `${String(entry.order).padStart(2, '0')}-${slugify(entry.title)}${
      restricted ? '-restringido' : ''
    }.png`;

    await takeNamedScreenshot(page, outputDir, filename);
    console.log('PAGE', entry.order, entry.title, 'EXPECTED', normalizedPath, 'FINAL', page.url(), 'RESTRICTED', restricted);
  }

  await browser.close();
};

main().catch((error) => {
  console.error('Error al generar capturas:', error);
  process.exit(1);
});
