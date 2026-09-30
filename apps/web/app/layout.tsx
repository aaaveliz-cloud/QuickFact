import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuickFact | Facturación electrónica',
  description: 'Facturación electrónica para empresas de Ecuador.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
