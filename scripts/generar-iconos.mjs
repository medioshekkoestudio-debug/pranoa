// Genera los íconos de la app y el isotipo de la web a partir del favicon oficial
// (public/marca/favicon-original.png: hoja blanca sobre cuadro oliva). Correr con `npm run iconos`.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OLIVA = { r: 0x65, g: 0x66, b: 0x3b, alpha: 1 };
const ORIGEN = 'public/marca/favicon-original.png';
mkdirSync('public/iconos', { recursive: true });

// 1) Separar la hoja blanca: el brillo de cada píxel se vuelve su transparencia.
const { data, info } = await sharp(ORIGEN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const hoja = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < info.width * info.height; i++) {
  const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
  const luz = 0.299 * r + 0.587 * g + 0.114 * b;
  const alfa = Math.max(0, Math.min(1, (luz - 110) / 130)) * (a / 255);
  hoja.set([255, 255, 255, Math.round(alfa * 255)], i * 4);
}
const hojaPng = await sharp(hoja, { raw: { width: info.width, height: info.height, channels: 4 } }).png().trim().toBuffer();
await sharp(hojaPng).toFile('public/marca/isotipo.png');
console.log('listo marca/isotipo.png');

// 2) Íconos: hoja centrada sobre fondo oliva cuadrado (el sistema redondea las esquinas).
async function icono(nombre, tam, proporcion) {
  const lado = Math.round(tam * proporcion);
  const dibujo = await sharp(hojaPng).resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: tam, height: tam, channels: 4, background: OLIVA } })
    .composite([{ input: dibujo, gravity: 'center' }]).png().toFile(`public/iconos/${nombre}`);
  console.log('listo', nombre);
}
await icono('icono-192.png', 192, 0.74);
await icono('icono-512.png', 512, 0.74);
await icono('icono-maskable-512.png', 512, 0.58);
await icono('apple-touch-icon.png', 180, 0.72);

// 3) Favicon de la pestaña: el original tal cual (cuadro redondeado).
for (const t of [32, 64]) {
  await sharp(ORIGEN).resize(t, t).png().toFile(`public/iconos/favicon-${t}.png`);
  console.log(`listo favicon-${t}.png`);
}
