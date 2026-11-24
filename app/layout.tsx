import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import { IniciarPwa } from '@/components/Pwa';
import './globals.css';

const poppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], variable: '--font-poppins' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Pranoa · un refugio seguro', template: '%s · Pranoa' },
  description: 'Restaurante en Valencia, Carabobo. Carta digital, delivery y reservas.',
  applicationName: 'Pranoa',
  appleWebApp: { capable: true, title: 'Pranoa', statusBarStyle: 'default' },
  icons: { icon: '/iconos/icono-192.png', apple: '/iconos/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#65663B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={poppins.variable}>
      <body className="min-h-screen font-sans">
        <IniciarPwa />
        {children}
      </body>
    </html>
  );
}
