/// <reference types="vite/client" />

/** package.json `version`, injected by the `define` in vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  // RevenueCat public SDK keys, injected at build time. Set once the real
  // stores are connected in RevenueCat (Task 6). Absent = purchases disabled,
  // app falls back to free/legacy evaluation.
  readonly VITE_RC_IOS_KEY?: string;
  readonly VITE_RC_ANDROID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
