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

  // Variable para que el codigo sepa si esta corriendo bajo Tauri.
  env: {
    NEXT_PUBLIC_TAURI: "true",
  },

  // Permite importar ficheros con sufijo `?raw` como STRING:
  //
  //   import sqlInit from "./drizzle/0000_init.sql?raw";
  //
  // Esto se usa para bundlear las migraciones SQL dentro de la app y
  // aplicarlas en runtime con el plugin SQL de Tauri.
  //
  // En el modo dev/build con Turbopack, esto va en la seccion turbopack.
  // Webpack (fallback) usa la regla asset/source.
  webpack: (config) => {
    config.module.rules.push({
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },

  turbopack: {
    rules: {
      "*.sql": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
