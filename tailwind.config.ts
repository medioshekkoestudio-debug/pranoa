import type { Config } from 'tailwindcss';

// Colores del manual de marca Pranoa (RGB oficiales)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oliva: { DEFAULT: '#65663B', claro: '#8A8B5C', oscuro: '#4C4D2C' }, // Pantone 7750 C
        naranja: { DEFAULT: '#DF8C37', claro: '#F0A85C', oscuro: '#C2722A' }, // Pantone 715 C
        taupe: { DEFAULT: '#756757', claro: '#A39684' }, // Pantone 7531 C
        ciruela: { DEFAULT: '#3C2525', claro: '#5A3A3A', oscuro: '#2A1919' }, // Pantone 7631 C
        crema: { DEFAULT: '#F6EFE4', oscuro: '#EADFCC' },
      },
      fontFamily: { sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
