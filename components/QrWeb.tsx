'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Logo } from './Logo';
import { Hoja } from './Hoja';

const URL_WEB = 'https://www.espaciopranoa.com/';

/** Genera una imagen PNG con la tarjeta de marca (Logo Pranoa + QR + dominio) lista para descargar o compartir */
async function generarImagenTarjetaQr(qrDataUrl: string): Promise<string> {
  const w = 900;
  const h = 1160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrDataUrl;

  // Fondo crema suave + tarjeta blanca centrada
  ctx.fillStyle = '#F6EFE4';
  ctx.fillRect(0, 0, w, h);

  const pad = 48;
  const r = 40;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r);
  ctx.fill();

  const cargarImg = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  try {
    const logo = await cargarImg('/marca/logo-marron.png');
    const logoH = 120;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, (w - logoW) / 2, 95, logoW, logoH);
  } catch {
    ctx.fillStyle = '#3C2525';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRANOA', w / 2, 165);
  }

  const qrImg = await cargarImg(qrDataUrl);
  const qrSize = 620;
  ctx.drawImage(qrImg, (w - qrSize) / 2, 250, qrSize, qrSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#3C2525';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('Escanea y entra a Pranoa', w / 2, 940);

  ctx.fillStyle = '#756757';
  ctx.font = '28px sans-serif';
  ctx.fillText('Carta digital · Delivery · Reservas', w / 2, 990);

  ctx.fillStyle = '#65663B';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('www.espaciopranoa.com', w / 2, 1052);

  return canvas.toDataURL('image/png');
}

export function TarjetaQrWeb({ compacta = false }: { compacta?: boolean }) {
  const [qrUrl, setQrUrl] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(URL_WEB, {
      margin: 1,
      width: 640,
      errorCorrectionLevel: 'M',
      color: { dark: '#3C2525', light: '#FFFFFF' },
    }).then(setQrUrl);
  }, []);

  const avisar = (m: string) => {
    setMensaje(m);
    setTimeout(() => setMensaje(''), 3500);
  };

  async function descargar() {
    if (!qrUrl) return;
    setOcupado(true);
    try {
      const png = await generarImagenTarjetaQr(qrUrl);
      const a = document.createElement('a');
      a.href = png;
      a.download = 'qr-espaciopranoa.png';
      a.click();
      avisar('QR descargado.');
    } finally {
      setOcupado(false);
    }
  }

  async function compartir() {
    if (!qrUrl) return;
    setOcupado(true);
    try {
      const png = await generarImagenTarjetaQr(qrUrl);
      const blob = await (await fetch(png)).blob();
      const archivo = new File([blob], 'qr-espaciopranoa.png', { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.share) {
        if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
          await navigator.share({
            title: 'Pranoa · un refugio seguro',
            text: 'Escanea este QR o entra a nuestra carta digital, delivery y reservas:',
            url: URL_WEB,
            files: [archivo],
          });
          return;
        }
        await navigator.share({
          title: 'Pranoa · un refugio seguro',
          text: 'Visita la carta digital, delivery y reservas de Pranoa:',
          url: URL_WEB,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(URL_WEB);
        avisar('Enlace copiado: www.espaciopranoa.com');
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        try {
          await navigator.clipboard?.writeText(URL_WEB);
          avisar('Enlace copiado: www.espaciopranoa.com');
        } catch {
          avisar('No se pudo compartir en este navegador.');
        }
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={`flex flex-col items-center text-center ${compacta ? '' : 'tarjeta print:break-inside-avoid print:shadow-none print:ring-1'}`}>
      <Logo className="scale-90" />
      {qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrUrl} alt="QR de www.espaciopranoa.com" className="mt-2 w-full max-w-[210px] rounded-xl" />
      ) : (
        <div className="mt-2 h-[210px] w-[210px] animate-pulse rounded-xl bg-crema" />
      )}
      <p className="mt-2 text-lg font-bold text-ciruela">Pranoa · App Web</p>
      <p className="text-xs text-taupe">Carta digital · Delivery · Reservas</p>
      <p className="mt-0.5 text-xs font-semibold text-oliva">www.espaciopranoa.com</p>

      <div className="mt-4 flex w-full max-w-xs gap-2 print:hidden">
        <button type="button" disabled={!qrUrl || ocupado} onClick={descargar} className="btn-primario flex-1 py-2.5 text-sm">
          ⬇ Descargar QR
        </button>
        <button type="button" disabled={!qrUrl || ocupado} onClick={compartir} className="btn-naranja flex-1 py-2.5 text-sm">
          ↗ Compartir
        </button>
      </div>
      {mensaje && <p className="mt-2 text-xs font-medium text-oliva print:hidden">{mensaje}</p>}
    </div>
  );
}

/** Botón público para abrir el QR de la PWA desde el inicio */
export function BotonQrWeb() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className="btn-secundario">
        Compartir QR
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="QR de Pranoa">
        <TarjetaQrWeb compacta />
      </Hoja>
    </>
  );
}
