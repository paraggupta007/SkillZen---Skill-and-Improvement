/// <reference types="vite/client" />
// Vite's typed environment variables for the browser application.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
