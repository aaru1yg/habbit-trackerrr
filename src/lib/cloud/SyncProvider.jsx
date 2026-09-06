/* Cloud sync orchestration.
 *
 * Truthfulness contract (the "no fake cloud" rule):
 *  - status is only SYNCED after a real Postgres round-trip resolved.
 *  - lastSyncedAt is the server's updated_at, never a local clock guess.
 *  - with no account, or no build-time config, status stays LOCAL.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useAuth } from './AuthProvider.jsx'
import { supabase, cloudConfigured } from './supabase.js'
import { pull, push, SYNC } from './syncEngine.js'
import { friendlyError } from './errors.js'
import { mergeDocs, summarise, hasData } from './merge.js'

const SyncContext = createContext(null)
export const useSync = () => useContext(SyncContext)

const DEBOUNCE_MS = 1200

export default function SyncProvider({ children }) {
  const { state, dispatch } = useStore()
  const auth = useAuth()
  const user = auth?.user ?? null

  const [status, setStatus] = useState(SYNC.LOCAL)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [error, setError] = useState(null)
  // Migration choice prompt: { local, cloud } summaries, or null.
  const [migration, setMigration] = useState(null)

  const revision = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state
  // Suppress the auto-push while we are still deciding what the truth is.
  const ready = useRef(false)
  const timer = useRef(null)

  /* ---- reset to a truthful local state whenever the user goes away ---- */
  useEffect(() => {
    if (!cloudConfigured || !user) {
      ready.current = false
      revision.current = 0
      setStatus(SYNC.LOCAL)
      setLastSyncedAt(null)
      setError(null)
      setMigration(null)
    }
  }, [user])

  /* ---- first pull after sign-in ---- */
  useEffect(() => {
    if (!cloudConfigured || !user) return
    let alive = true
    ready.current = false
    setStatus(SYNC.SYNCING)
    setError(null)

    ;(async () => {
      try {
        const { doc: cloudDoc, revision: rev, updatedAt } = await pull(user.id)
        if (!alive) return
        revision.current = rev
        const localDoc = stateRef.current

        // Both sides hold data → never silently overwrite. Ask the user.
        if (cloudDoc && hasData(cloudDoc) && hasData(localDoc)) {
          setMigration({
            local: summarise(localDoc),
            cloud: summarise(cloudDoc),
            cloudDoc,
          })
          setStatus(SYNC.SYNCING)
          return
        }

        if (cloudDoc && hasData(cloudDoc)) {
          // Cloud is the only source of truth → adopt it.
          dispatch({ type: 'IMPORT_DATA', data: cloudDoc })
          setLastSyncedAt(updatedAt)
          setStatus(SYNC.SYNCED)
          ready.current = true
          return
        }

        // Cloud empty → seed it from whatever this device has.
        const res = await push(user.id, localDoc, revision.current + 1)
        if (!alive) return
        revision.current = res.revision
        setLastSyncedAt(res.updatedAt)
        setStatus(SYNC.SYNCED)
        ready.current = true
      } catch (e) {
        if (!alive) return
        setError(friendlyError(e))
        setStatus(navigator.onLine === false ? SYNC.OFFLINE : SYNC.ERROR)
      }
    })()

    return () => { alive = false }
  }, [user, dispatch])

  /* ---- resolve the migration prompt ---- */
  const resolveMigration = useCallback(async (choice) => {
    const m = migration
    if (!m || !user) return
    const localDoc = stateRef.current
    let next
    if (choice === 'merge') next = mergeDocs(localDoc, m.cloudDoc)
    else if (choice === 'local') next = localDoc
    else if (choice === 'cloud') next = m.cloudDoc
    else { // cancel — stay signed in but do not sync
      setMigration(null)
      setStatus(SYNC.ERROR)
      setError('Sync paused — choose how to combine your data to turn it back on.')
      return
    }

    setMigration(null)
    setStatus(SYNC.SYNCING)
    try {
      if (choice !== 'cloud') {
        const res = await push(user.id, next, revision.current + 1)
        revision.current = res.revision
        setLastSyncedAt(res.updatedAt)
      }
      if (choice !== 'local') dispatch({ type: 'IMPORT_DATA', data: next })
      setStatus(SYNC.SYNCED)
      setError(null)
      ready.current = true
    } catch (e) {
      setError(friendlyError(e))
      setStatus(navigator.onLine === false ? SYNC.OFFLINE : SYNC.ERROR)
    }
  }, [migration, user, dispatch])

  /* ---- debounced push on every local change ---- */
  useEffect(() => {
    if (!cloudConfigured || !user || !ready.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (navigator.onLine === false) {
        setStatus(SYNC.OFFLINE)
        return
      }
      setStatus(SYNC.SYNCING)
      try {
        const res = await push(user.id, stateRef.current, revision.current + 1)
        revision.current = res.revision
        setLastSyncedAt(res.updatedAt)
        setStatus(SYNC.SYNCED)
        setError(null)
      } catch (e) {
        setError(friendlyError(e))
        setStatus(navigator.onLine === false ? SYNC.OFFLINE : SYNC.ERROR)
      }
    }, DEBOUNCE_MS)
    return () => timer.current && clearTimeout(timer.current)
  }, [state, user])

  /* ---- react to connectivity ---- */
  useEffect(() => {
    const off = () => { if (user && cloudConfigured) setStatus(SYNC.OFFLINE) }
    window.addEventListener('offline', off)
    return () => window.removeEventListener('offline', off)
  }, [user])

  /** Manual "sync now" — also the retry path after an error. */
  const syncNow = useCallback(async () => {
    if (!cloudConfigured || !user) return
    setStatus(SYNC.SYNCING)
    try {
      const res = await push(user.id, stateRef.current, revision.current + 1)
      revision.current = res.revision
      setLastSyncedAt(res.updatedAt)
      setStatus(SYNC.SYNCED)
      setError(null)
      ready.current = true
    } catch (e) {
      setError(friendlyError(e))
      setStatus(navigator.onLine === false ? SYNC.OFFLINE : SYNC.ERROR)
    }
  }, [user])

  const value = useMemo(() => ({
    configured: cloudConfigured,
    status, lastSyncedAt, error, migration,
    resolveMigration, syncNow,
  }), [status, lastSyncedAt, error, migration, resolveMigration, syncNow])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
