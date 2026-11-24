// Genera los íconos de la app a partir del isotipo provisional.
// Cuando llegue el logo oficial: guardar public/marca/isotipo.svg (blanco) y volver a correr `npm run iconos`.
import sharp from 'sharp';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';

const OLIVA = '#65663B';
const salida = 'public/iconos';
mkdirSync(salida, { recursive: true });

const isotipoProvisional = (color) => `
  <g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 72 C29 46 37 19 62 12 C81 7 92 20 84 37 C75 57 58 66 38 72 Z" stroke-width="9"/>
    <path d="M43 65 L73 22" stroke-width="3.2"/><path d="M50 55 L50 38" stroke-width="3"/>
    <path d="M57 45 L72 42" stroke-width="3"/><path d="M64 35 L63 25" stroke-width="3"/>
    <path d="M38 72 C40 82 42 90 47 100" stroke-width="9"/><path d="M21 77 C29 72 38 71 52 67" stroke-width="7"/>
  </g>`;

const oficial = existsSync('public/marca/isotipo.svg') ? readFileSync('public/marca/isotipo.svg', 'utf8') : null;

function svg(tam, margen) {
  const interior = tam - margen * 2;
  const dibujo = oficial
    ? `<image href="data:image/svg+xml;base64,${Buffer.from(oficial).toString('base64')}" x="${margen}" y="${margen}" width="${interior}" height="${interior}"/>`
    : `<g transform="translate(${margen + interior * 0.04} ${margen}) scale(${interior / 110})">${isotipoProvisional('#FFFFFF')}</g>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}"><rect width="100%" height="100%" fill="${OLIVA}"/>${dibujo}</svg>`);
}

const lista = [
  ['icono-192.png', 192, 30],
  ['icono-512.png', 512, 80],
  ['icono-maskable-512.png', 512, 120],
  ['apple-touch-icon.png', 180, 28],
];
for (const [nombre, tam, margen] of lista) {
  await sharp(svg(tam, margen)).png().toFile(`${salida}/${nombre}`);
  console.log('listo', nombre);
}
