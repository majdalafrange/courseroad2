/// <reference types="vite/client" />

interface ViteTypeOptions {
  // disallows unknown keys
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_URL: string
  readonly VITE_FIREROAD_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
  