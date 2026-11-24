// Isotipo oficial (hoja que forma la «P»). Se pinta con el color del texto usando la hoja como máscara,
// así sirve en oliva, crema o naranja. Se regenera con `npm run iconos` desde public/marca/favicon-original.png.

export function Isotipo({ className = 'h-10 w-10', color = 'currentColor' }: { className?: string; color?: string }) {
  const mascara = 'url(/marca/isotipo.png) center / contain no-repeat';
  return <span aria-hidden="true" className={`inline-block ${className}`} style={{ backgroundColor: color, WebkitMask: mascara, mask: mascara }} />;
}

// Logo oficial completo (hoja + «pranoa» + «un refugio seguro»). Se pinta en cualquier color de marca
// usando public/marca/logo-blanco.png como máscara. Las versiones a color están en public/marca/.
export function Logo({
  className = '',
  color = '#65663B',
  grande = false,
}: { className?: string; color?: string; grande?: boolean }) {
  const mascara = 'url(/marca/logo-blanco.png) center / contain no-repeat';
  return (
    <span role="img" aria-label="Pranoa, un refugio seguro"
      className={`inline-block aspect-[600/273] ${grande ? 'h-24' : 'h-11'} ${className}`}
      style={{ backgroundColor: color, WebkitMask: mascara, mask: mascara }} />
  );
}
