/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the admin API, without a trailing slash — for example
   * `https://adwa-admin-api.onrender.com`. Left unset the console runs on
   * fixtures in demo mode; see src/api/config.ts.
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
