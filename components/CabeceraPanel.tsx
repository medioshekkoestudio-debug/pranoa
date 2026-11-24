import { Isotipo } from './Logo';

/** Título de cada sección del panel */
export function CabeceraPanel({ titulo, children, oscuro = false }: { titulo: string; children?: React.ReactNode; oscuro?: boolean }) {
  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur print:hidden ${oscuro ? 'border-white/10 bg-ciruela-oscuro/95' : 'border-ciruela/10 bg-crema/95'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Isotipo className={`h-8 w-8 shrink-0 ${oscuro ? 'text-naranja' : 'text-oliva'}`} />
        <h1 className="flex-1 truncate text-xl font-bold">{titulo}</h1>
        {children}
      </div>
    </header>
  );
}
