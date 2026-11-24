'use client';
import { useEffect } from 'react';

/** Panel que sube desde abajo (estilo app). En pantallas grandes queda centrado. */
export function Hoja({ abierta, onCerrar, titulo, children }: {
  abierta: boolean; onCerrar: () => void; titulo: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 text-ciruela sm:max-w-lg sm:rounded-3xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="h-9 w-9 rounded-full bg-crema text-xl" aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
