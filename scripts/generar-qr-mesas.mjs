// Genera las hojas de QR de las mesas para imprimir, apuntando SIEMPRE al dominio oficial.
// Uso: npm run qr   (lee las mesas activas de Supabase con las claves de .env.local)
// Salida: qr-impresion/qr-mesas.html (+ PDF si hay Edge/Chrome) y un PNG por mesa.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import QRCode from 'qrcode';

const DOMINIO = (process.env.QR_DOMINIO || 'https://www.espaciopranoa.com').replace(/\/$/, '');
const raiz = resolve(import.meta.dirname, '..');
const salida = resolve(raiz, 'qr-impresion');

// --- variables de .env.local ---
const env = Object.fromEntries(
  readFileSync(resolve(raiz, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const clave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');

const r = await fetch(`${url}/rest/v1/mesas?select=id,nombre,numero,ambiente,capacidad,token&activa=eq.true`, {
  headers: { apikey: clave, Authorization: `Bearer ${clave}` },
});
if (!r.ok) throw new Error(`Supabase respondió ${r.status}: ${await r.text()}`);
const mesas = (await r.json()).sort((a, b) =>
  String(a.nombre ?? a.numero).localeCompare(String(b.nombre ?? b.numero), 'es', { numeric: true }),
);
if (!mesas.length) throw new Error('No hay mesas activas');

mkdirSync(resolve(salida, 'png'), { recursive: true });
const logo = `data:image/png;base64,${readFileSync(resolve(raiz, 'public/marca/logo-marron.png')).toString('base64')}`;
const opciones = { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: '#3C2525', light: '#FFFFFF' } };

const tarjetas = [];
for (const m of mesas) {
  const nombre = m.nombre || String(m.numero);
  const enlace = `${DOMINIO}/mesa/${m.token}`;
  await QRCode.toFile(resolve(salida, 'png', `mesa-${nombre}.png`), enlace, opciones);
  const dataUrl = await QRCode.toDataURL(enlace, opciones);
  tarjetas.push(`
    <div class="tarjeta">
      <img class="logo" src="${logo}" alt="Pranoa" />
      <img class="qr" src="${dataUrl}" alt="QR Mesa ${nombre}" />
      <p class="mesa">Mesa ${nombre}</p>
      <p class="texto">Escanea para ver la carta, pedir y llamar al mesonero</p>
      <p class="url">${DOMINIO.replace('https://', '')}</p>
    </div>`);
}

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><title>QR de mesas · Pranoa</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Poppins, 'Segoe UI', Arial, sans-serif; color: #3C2525; }
  .hoja { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .tarjeta { border: 1px dashed #A89C92; border-radius: 4mm; padding: 5mm 4mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .logo { height: 13mm; }
  .qr { width: 100%; max-width: 52mm; display: block; margin: 2mm auto; }
  .mesa { font-size: 20pt; font-weight: 700; margin: 1mm 0 0; }
  .texto { font-size: 8pt; margin: 1mm 0 0; color: #756757; }
  .url { font-size: 7pt; margin: 1mm 0 0; color: #65663B; font-weight: 600; }
</style></head>
<body><div class="hoja">${tarjetas.join('')}</div></body></html>`;

const archivoHtml = resolve(salida, 'qr-mesas.html');
writeFileSync(archivoHtml, html, 'utf8');
console.log(`OK: ${mesas.length} QR → ${DOMINIO}/mesa/...`);

// --- PDF con Edge o Chrome en modo headless (si están instalados) ---
const navegadores = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const nav = navegadores.find((n) => existsSync(n));
if (nav) {
  const pdf = resolve(salida, 'qr-mesas.pdf');
  execFileSync(nav, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file:///${archivoHtml.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  console.log(`PDF: ${pdf}`);
}
