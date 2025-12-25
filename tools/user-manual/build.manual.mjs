import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

let chromium = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = __dirname;
const pagesJsonPath = path.join(baseDir, 'manual.pages.json');
const outDir = path.join(baseDir, 'out');
const manualMdPath = path.join(baseDir, 'manual.md');
const manualHtmlPath = path.join(baseDir, 'manual.html');
const manualPdfPath = path.join(baseDir, 'manual.pdf');

const formatOrder = (order) => String(order).padStart(2, '0');

const formatDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadPages = async () => {
  const raw = await fs.readFile(pagesJsonPath, 'utf-8');
  const pages = JSON.parse(raw);
  return pages.sort((a, b) => a.order - b.order);
};

const loadImages = async () => {
  try {
    const files = await fs.readdir(outDir);
    return files.filter((file) => file.toLowerCase().endsWith('.png'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const findImageForOrder = (images, order) => {
  const prefix = `${formatOrder(order)}-`;
  return images.find((file) => file.startsWith(prefix)) || null;
};

const loadChromium = async () => {
  if (chromium) return chromium;
  const playwright = await import('playwright');
  chromium = playwright.chromium;
  return chromium;
};

const buildMarkdown = (pages, images) => {
  const lines = [];
  lines.push('# Manual de Usuario');
  lines.push(`Fecha: ${formatDate()}`);
  lines.push('');
  lines.push('## Índice');
  pages.forEach((page) => {
    const sectionId = `${formatOrder(page.order)}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    lines.push(`- [${formatOrder(page.order)}. ${page.title}](#${sectionId})`);
  });
  lines.push('');

  pages.forEach((page) => {
    const sectionId = `${formatOrder(page.order)}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const imageFile = findImageForOrder(images, page.order);
    lines.push(`## ${formatOrder(page.order)}. ${page.title}`);
    lines.push(`<a id="${sectionId}"></a>`);
    lines.push(`- Ruta: ${page.path}`);
    lines.push('- Descripción: (pendiente)');
    lines.push('- Pasos:');
    for (let step = 1; step <= 5; step += 1) {
      lines.push(`  ${step}. (pendiente)`);
    }
    lines.push('- Imagen:');
    if (imageFile) {
      lines.push(`  ![](./out/${imageFile})`);
    } else {
      lines.push('  (captura pendiente)');
    }
    lines.push('');
  });

  return lines.join('\n');
};

const buildHtml = (pages, images) => {
  const sections = pages
    .map((page) => {
      const imageFile = findImageForOrder(images, page.order);
      const sectionId = `${formatOrder(page.order)}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const steps = Array.from({ length: 5 }, (_, index) => `<li>(pendiente)</li>`).join('');
      const imageBlock = imageFile
        ? `<div class="image"><img src="./out/${imageFile}" alt="${page.title}"></div>`
        : '<p class="pending">(captura pendiente)</p>';
      return `
<section id="${sectionId}">
  <h2>${formatOrder(page.order)}. ${page.title}</h2>
  <p><strong>Ruta:</strong> ${page.path}</p>
  <p><strong>Descripción:</strong> (pendiente)</p>
  <p><strong>Pasos:</strong></p>
  <ol>${steps}</ol>
  ${imageBlock}
</section>`;
    })
    .join('\n');

  const tocItems = pages
    .map((page) => {
      const sectionId = `${formatOrder(page.order)}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      return `<li><a href="#${sectionId}">${formatOrder(page.order)}. ${page.title}</a></li>`;
    })
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Manual de Usuario</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 15mm; color: #1a1a1a; }
    h1, h2 { color: #0a0a0a; }
    .cover { text-align: center; margin-bottom: 20mm; }
    .cover h1 { font-size: 32px; margin-bottom: 4mm; }
    .cover p { font-size: 16px; margin: 0; }
    .toc { margin-bottom: 20mm; }
    .toc ol { padding-left: 18px; }
    section { page-break-after: always; margin-bottom: 20mm; }
    section:last-of-type { page-break-after: auto; }
    img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
    .image { margin-top: 8px; }
    .pending { font-style: italic; color: #888; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Manual de Usuario</h1>
    <p>Fecha: ${formatDate()}</p>
  </div>
  <div class="toc">
    <h2>Índice</h2>
    <ol>${tocItems}</ol>
  </div>
  ${sections}
</body>
</html>`;
};

const saveFile = async (filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`OK: ${path.basename(filePath)}`);
};

const generatePdf = async () => {
  const engine = await loadChromium();
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = pathToFileURL(manualHtmlPath).href;
  await page.goto(fileUrl);
  await page.pdf({
    path: manualPdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
  });
  await browser.close();
  console.log(`OK: ${path.basename(manualPdfPath)}`);
};

const generatePlaceholderPdf = async () => {
  const placeholder = `%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<< /Type /Catalog /Pages 3 0 R >>endobj\n3 0 obj<< /Type /Pages /Kids [4 0 R] /Count 1 >>endobj\n4 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>endobj\n5 0 obj<< /Length 80 >>stream\nBT /F1 12 Tf 72 720 Td (Ejecuta build.manual.mjs con Playwright instalado para generar el PDF definitivo) Tj ET\nendstream endobj\n6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 7\n0000000000 65535 f \n0000000010 00000 n \n0000000043 00000 n \n0000000102 00000 n \n0000000175 00000 n \n0000000373 00000 n \n0000000503 00000 n \ntrailer<< /Size 7 /Root 2 0 R >>\nstartxref\n592\n%%EOF`;
  await fs.writeFile(manualPdfPath, placeholder, 'utf-8');
  console.warn(`WARN: ${path.basename(manualPdfPath)} generado como placeholder (sin Playwright).`);
};

const run = async () => {
  const pages = await loadPages();
  const images = await loadImages();

  const md = buildMarkdown(pages, images);
  await saveFile(manualMdPath, md);

  const html = buildHtml(pages, images);
  await saveFile(manualHtmlPath, html);

  try {
    await generatePdf();
  } catch (error) {
    console.warn('No se pudo generar manual.pdf con Playwright:', error.message);
    await generatePlaceholderPdf();
  }
};

run().catch((error) => {
  console.error('Error generando el manual:', error);
  process.exit(1);
});
