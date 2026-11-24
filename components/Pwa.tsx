'use client';
import { useEffect, useState } from 'react';
import { alCambiar, esIos, iniciarPwa, instalar, puedeInstalar, yaInstalada } from '@/lib/pwa';

let iniciada = false;

/** Se monta una vez en el layout raíz para no perder el evento de instalación */
export function IniciarPwa() {
  useEffect(() => {
    if (!iniciada) { iniciada = true; iniciarPwa(); }
  }, []);
  return null;
}

/** Botón «Descargar la app». Se oculta si ya está instalada. */
export function BotonDescargar({ className = '' }: { className?: string }) {
  const [, refrescar] = useState(0);
  const [ayudaIos, setAyudaIos] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); return alCambiar(() => refrescar((n) => n + 1)); }, []);
  if (!montado || yaInstalada()) return null;
  if (!puedeInstalar() && !esIos()) return null;

  return (
    <>
      <button
        type="button"
        className={className || 'btn-secundario'}
        onClick={() => (esIos() ? setAyudaIos(true) : instalar())}
      >
        Descargar la app
      </button>
      {ayudaIos && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setAyudaIos(false)}>
          <div className="w-full rounded-t-3xl bg-white p-6 pb-10 text-ciruela" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold">Descarga Pranoa en tu iPhone</p>
            <p className="mt-2 text-sm">
              Toca <b>Compartir</b> (el cuadrito con la flecha) y luego <b>«Añadir a pantalla de inicio»</b>.
            </p>
            <button className="btn-primario mt-5 w-full" onClick={() => setAyudaIos(false)}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}
