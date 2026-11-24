// Isotipo oficial (hoja que forma la «P»). Se pinta con el color del texto usando la hoja como máscara,
// así sirve en oliva, crema o naranja. Se regenera con `npm run iconos` desde public/marca/favicon-original.png.

export function Isotipo({ className = 'h-10 w-10', color = 'currentColor' }: { className?: string; color?: string }) {
  const mascara = 'url(/marca/isotipo.png) center / contain no-repeat';
  return <span aria-hidden="true" className={`inline-block ${className}`} style={{ backgroundColor: color, WebkitMask: mascara, mask: mascara }} />;
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
