import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnv = () => {
  const manualEnvPath = path.join(__dirname, 'manual.env');
  const rootEnvPath = path.join(process.cwd(), '.env');

  if (fs.existsSync(manualEnvPath)) {
    dotenv.config({ path: manualEnvPath });
  } else if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  } else {
    dotenv.config();
  }
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

const takeScreenshot = async (page, outDir, entry) => {
  const filename = `${String(entry.order).padStart(2, '0')}-${slugify(entry.title)}.png`;
  const destination = path.resolve(outDir, filename);
  await page.screenshot({ path: destination, fullPage: true });
  console.log(`OK: ${entry.title} => ${filename}`);
};

const performLogin = async (page, baseUrl, credentials) => {
  await page.goto(buildUrl(baseUrl, '/login'), { waitUntil: 'networkidle' });
  await page.fill('input#username', credentials.user);
  await page.fill('input#password', credentials.pass);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  const consoleSelect = page.locator('#console');
  if (await consoleSelect.count()) {
    try {
      await consoleSelect.waitFor({ state: 'visible', timeout: 5000 });
      const options = await consoleSelect.locator('option:not([value=""])').all();
      if (options.length > 0) {
        const firstValue = await options[0].getAttribute('value');
        if (firstValue) {
          await consoleSelect.selectOption(firstValue);
        }
      }
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.warn('No fue posible seleccionar una consola automáticamente:', error);
    }
  }
};

const main = async () => {
  loadEnv();

  const baseUrl = process.env.MANUAL_BASE_URL;
  const user = process.env.MANUAL_USER;
  const pass = process.env.MANUAL_PASS;
  const outDir = process.env.MANUAL_OUT;

  if (!baseUrl || !user || !pass || !outDir) {
    throw new Error('Faltan variables de entorno: asegúrate de definir MANUAL_BASE_URL, MANUAL_USER, MANUAL_PASS y MANUAL_OUT.');
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

  await performLogin(page, baseUrl, { user, pass });

  for (const entry of pages) {
    if (entry.path === '/login') {
      continue;
    }
    await page.goto(buildUrl(baseUrl, entry.path), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await takeScreenshot(page, outputDir, entry);
  }

  await browser.close();
};

main().catch((error) => {
  console.error('Error al generar capturas:', error);
  process.exit(1);
});
