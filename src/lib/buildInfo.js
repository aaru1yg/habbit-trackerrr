/* Build identity baked in by vite.config (define: __BUILD_ID__/__BUILD_TIME__).
   typeof-guarded so unit tests — which run through vitest.config, not the
   app vite config — keep working without any setup. */
export const BUILD_ID = typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__
export const BUILD_TIME = typeof __BUILD_TIME__ === 'undefined' ? 'dev' : __BUILD_TIME__
