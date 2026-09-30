import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const apiOrigin = process.env.API_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : undefined);
    if (!apiOrigin) return [];
    let api: URL;
    try { api = new URL(apiOrigin); } catch { throw new Error('API_URL debe ser un origen HTTP válido.'); }
    if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password
      || api.pathname !== '/' || api.search || api.hash
      || process.env.NODE_ENV === 'production' && api.protocol !== 'https:') {
      throw new Error('API_URL debe ser un origen HTTPS sin credenciales, ruta ni parámetros en producción.');
    }
    return [
      { source: '/api/auth/:path*', destination: `${api.origin}/auth/:path*` },
      { source: '/api/companies/:path*', destination: `${api.origin}/companies/:path*` },
      { source: '/api/ready', destination: `${api.origin}/ready` },
    ];
  },
};
export default config;
