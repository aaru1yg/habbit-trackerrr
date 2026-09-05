/* Build identity.
   BUILD_ID is baked in by vite.config (define: __BUILD_ID__) — the commit SHA,
   identical for every build of that commit, so JS bundles stay deterministic.
   BUILD_TIME is read back from <meta name="build-time"> at runtime (never
   inlined — a wall-clock timestamp would make every bundle unique).
   Both are guarded so unit tests (no vite define, no meta tag) see 'dev'. */
export const BUILD_ID = typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__

function readBuildTime() {
  try {
    if (typeof document === 'undefined') return 'dev'
    return document.querySelector('meta[name="build-time"]')?.content || 'dev'
  } catch {
    return 'dev'
  }
}
export const BUILD_TIME = readBuildTime()
