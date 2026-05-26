// Declaracion para que TypeScript acepte imports tipo:
//   import sql from './migration.sql?raw';
//
// El sufijo `?raw` lo soporta Webpack/Turbopack en tiempo de build:
// inserta el contenido del fichero como string en el bundle.

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare module "*.sql" {
  const content: string;
  export default content;
}
