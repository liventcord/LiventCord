/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

interface ImportMetaEnv {
  VITE_GOOGLE_CLIENT_ID: string;
  VITE_BACKEND_URL: string;
  DEV?: boolean;
}
