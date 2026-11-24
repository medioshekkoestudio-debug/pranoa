// Isotipo provisional dibujado a partir del manual de marca (hoja que forma la «P»).
// Cuando llegue el archivo vectorial oficial, reemplazar <Isotipo> por <img src="/marca/isotipo.svg">.

export function Isotipo({ className = 'h-10 w-10', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 110" className={className} aria-hidden="true" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <path d="M38 72 C29 46 37 19 62 12 C81 7 92 20 84 37 C75 57 58 66 38 72 Z" strokeWidth="9" />
      <path d="M43 65 L73 22" strokeWidth="3.2" />
      <path d="M50 55 L50 38" strokeWidth="3" />
      <path d="M57 45 L72 42" strokeWidth="3" />
      <path d="M64 35 L63 25" strokeWidth="3" />
      <path d="M38 72 C40 82 42 90 47 100" strokeWidth="9" />
      <path d="M21 77 C29 72 38 71 52 67" strokeWidth="7" />
    </svg>
  );
}

export function Logo({
  className = '',
  color = '#3C2525',
  lema = false,
  horizontal = true,
}: { className?: string; color?: string; lema?: boolean; horizontal?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${horizontal ? 'flex-row' : 'flex-col'} ${className}`} style={{ color }}>
      <Isotipo className={horizontal ? 'h-9 w-9' : 'h-16 w-16'} />
      <span className="flex flex-col leading-none">
        <span className="font-extrabold lowercase tracking-wide" style={{ fontSize: horizontal ? '1.6rem' : '2.4rem' }}>
          pranoa
        </span>
        {lema && <span className="mt-0.5 text-[0.62rem] font-semibold tracking-[0.18em] opacity-80">un refugio seguro</span>}
      </span>
    </span>
  );
}
