/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri sirve el frontend como ficheros estaticos, no como app Next con servidor.
  // 'export' genera HTML/JS/CSS estatico en /out al hacer `next build`.
  output: "export",
  // Tauri abre los ficheros desde el sistema de archivos, no desde un servidor HTTP,
  // asi que las rutas necesitan llevar trailing slash para que Next encuentre los index.html.
  trailingSlash: true,
  // Las imagenes optimizadas de Next requieren servidor; en export las dejamos crudas.
  images: { unoptimized: true },
  // Variable para que el codigo sepa si esta corriendo bajo Tauri (la fija el package.json
  // o, en su defecto, la inyectamos en runtime).
  env: {
    NEXT_PUBLIC_TAURI: "true",
  },
};

export default nextConfig;
