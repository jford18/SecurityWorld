import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

let chromium = null;

const BASE_DIR = dirname(fileURLToPath(import.meta.url));
const MD_PATH = join(BASE_DIR, 'manual.md');
const HTML_PATH = join(BASE_DIR, 'manual.html');
const PDF_PATH = join(BASE_DIR, 'manual.pdf');
const OUT_DIR = join(BASE_DIR, 'out');
const PAGES_PATH = join(BASE_DIR, 'manual.pages.json');

const loadChromium = async () => {
  if (chromium) return chromium;
  const playwright = await import('playwright');
  chromium = playwright.chromium;
  return chromium;
};

const loadPages = async () => {
  const raw = await fsPromises.readFile(PAGES_PATH, 'utf-8');
  const pages = JSON.parse(raw);
  return pages.sort((a, b) => a.order - b.order);
};

const buildManualFromPages = async () => {
  const pages = await loadPages();
  const lines = ['# Manual de Usuario', '', '## Índice'];

  pages.forEach((page) => {
    const sectionId = `${String(page.order).padStart(2, '0')}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    lines.push(`- [${String(page.order).padStart(2, '0')}. ${page.title}](#${sectionId})`);
  });

  lines.push('');
  pages.forEach((page) => {
    const order = String(page.order).padStart(2, '0');
    const sectionId = `${order}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    lines.push(`## ${order}. ${page.title}`);
    lines.push(`<a id="${sectionId}"></a>`);
    lines.push(`- Ruta: ${page.path}`);
    lines.push('- Descripción: (pendiente)');
    lines.push('- Pasos:');
    lines.push('  1. (pendiente)');
    lines.push('  2. (pendiente)');
    lines.push('  3. (pendiente)');
    lines.push('  4. (pendiente)');
    lines.push('  5. (pendiente)');
    lines.push('- Imagen:');
    lines.push('  (captura pendiente)');
    lines.push('');
  });

  return lines.join('\n');
};

const getManualMarkdown = async () => {
  const mdExists = fs.existsSync(MD_PATH);

  if (!mdExists) {
    console.log('Generating manual.md (first time)');
    const markdown = await buildManualFromPages();
    fs.writeFileSync(MD_PATH, markdown, 'utf-8');
    return markdown;
  }

  console.log('Using existing manual.md');
  return fs.readFileSync(MD_PATH, 'utf-8');
};

const markdownToHtml = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const htmlLines = [];
  let inSteps = false;
  let isFirstSection = true;

  const closeSteps = () => {
    if (inSteps) {
      htmlLines.push('</ol>');
      inSteps = false;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      closeSteps();
      if (!isFirstSection) {
        htmlLines.push('<hr class="section-break">');
      }
      const classes = ['section-heading'];
      if (isFirstSection) {
        classes.push('first-section');
        isFirstSection = false;
      }
      htmlLines.push(`<h2 class="${classes.join(' ')}">${trimmed.slice(3)}</h2>`);
      return;
    }

    if (trimmed.startsWith('# ')) {
      closeSteps();
      htmlLines.push(`<h1>${trimmed.slice(2)}</h1>`);
      return;
    }

    if (/^<a id=".+"><\/a>$/.test(trimmed)) {
      closeSteps();
      htmlLines.push(trimmed);
      return;
    }

    if (trimmed.startsWith('- Ruta:')) {
      closeSteps();
      htmlLines.push(`<p><b>Ruta:</b> ${trimmed.replace(/^- Ruta:\s*/, '')}</p>`);
      return;
    }

    if (trimmed.startsWith('- Descripción:')) {
      closeSteps();
      htmlLines.push(`<p><b>Descripción:</b> ${trimmed.replace(/^- Descripción:\s*/, '')}</p>`);
      return;
    }

    if (trimmed.startsWith('- Pasos:')) {
      closeSteps();
      htmlLines.push('<p><b>Pasos:</b></p>');
      htmlLines.push('<ol>');
      inSteps = true;
      return;
    }

    if (inSteps && /^\d+\.\s+/.test(trimmed)) {
      htmlLines.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`);
      return;
    }

    if (trimmed.startsWith('- Imagen:')) {
      closeSteps();
      htmlLines.push('<p><b>Imagen:</b></p>');
      return;
    }

    const imageMatch = trimmed.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (imageMatch) {
      closeSteps();
      htmlLines.push(
        `<img src="${imageMatch[1]}" style="max-width:100%;height:auto;border:1px solid #eee;border-radius:8px;">`,
      );
      return;
    }

    if (/^\(captura pendiente\)$/i.test(trimmed)) {
      closeSteps();
      htmlLines.push('<p class="pending">(captura pendiente)</p>');
      return;
    }

    const tocMatch = trimmed.match(/^- \[(.+?)\]\((.+?)\)/);
    if (tocMatch) {
      closeSteps();
      htmlLines.push(`<p><a href="${tocMatch[2]}">${tocMatch[1]}</a></p>`);
      return;
    }

    if (trimmed === '') {
      closeSteps();
      return;
    }

    closeSteps();
    htmlLines.push(`<p>${trimmed}</p>`);
  });

  closeSteps();
  return htmlLines.join('\n');
};

const buildHtmlDocument = (bodyContent) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Manual de Usuario</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #1a1a1a; }
    main { padding: 15mm; }
    h1 { text-align: center; margin-bottom: 12mm; }
    h2.section-heading { margin-top: 14mm; margin-bottom: 6mm; font-size: 20px; }
    h2.section-heading:not(.first-section) { page-break-before: always; }
    p { line-height: 1.45; margin: 4px 0; }
    ol { padding-left: 18px; margin: 6px 0 10px 0; }
    hr.section-break { border: 0; border-top: 1px solid #ddd; margin: 12mm 0 10mm 0; }
    img { display: block; margin: 8px 0 10px 0; }
    .pending { font-style: italic; color: #888; }
  </style>
</head>
<body>
  <main>
    ${bodyContent}
  </main>
</body>
</html>`;
const saveFile = async (filePath, content) => {
  await fsPromises.writeFile(filePath, content, 'utf-8');
  console.log(`OK: ${basename(filePath)}`);
};

const generatePdf = async () => {
  const engine = await loadChromium();
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = pathToFileURL(HTML_PATH).href;
  await page.goto(fileUrl);
  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
  });
  await browser.close();
  console.log(`OK: ${basename(PDF_PATH)}`);
};

const generatePlaceholderPdf = async () => {
  const placeholder = `%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<< /Type /Catalog /Pages 3 0 R >>endobj\n3 0 obj<< /Type /Pages /Kids [4 0 R] /Count 1 >>endobj\n4 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>endobj\n5 0 obj<< /Length 80 >>stream\nBT /F1 12 Tf 72 720 Td (Ejecuta build.manual.mjs con Playwright instalado para generar el PDF definitivo) Tj ET\nendstream endobj\n6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 7\n0000000000 65535 f \n0000000010 00000 n \n0000000043 00000 n \n0000000102 00000 n \n0000000175 00000 n \n0000000373 00000 n \n0000000503 00000 n \ntrailer<< /Size 7 /Root 2 0 R >>\nstartxref\n592\n%%EOF`;
  await fsPromises.writeFile(PDF_PATH, placeholder, 'utf-8');
  console.warn(`WARN: ${basename(PDF_PATH)} generado como placeholder (sin Playwright).`);
};

const run = async () => {
  const markdown = await getManualMarkdown();
  const html = buildHtmlDocument(markdownToHtml(markdown));
  await saveFile(HTML_PATH, html);

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
