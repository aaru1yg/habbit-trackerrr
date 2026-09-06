/* Cloud sync orchestration.
 *
 * Truthfulness contract (the "no fake cloud" rule):
 *  - status is only SYNCED after a real Postgres round-trip resolved.
 *  - lastSyncedAt is the server's updated_at, never a local clock guess.
 *  - with no account, or no build-time config, status stays LOCAL.
 *
 * Migration prompt contract:
 *  - the prompt appears only when a genuine choice is required: this device
 *    and the account BOTH hold data, the two documents actually differ, and
 *    this device has never resolved that choice for this account.
 *  - once resolved, the decision is remembered (per account, on this device)
 *    and honoured on later sign-ins, so the dialog never nags.
 *  - identical documents are already reconciled — no prompt, no write.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useAuth } from './AuthProvider.jsx'
import {  cloudConfigured } from './supabase.js'
import { pull, push, SYNC } from './syncEngine.js'
import { friendlyError } from './errors.js'
import { mergeDocs, summarise, hasData } from './merge.js'
import { readMigrationChoice, writeMigrationChoice, canonicalJson } from './migrationState.js'

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
  // Canonical form of the doc as the server last held it. When local state
  // matches it there is nothing to send — skip the write entirely.
  const serverCanonical = useRef(null)

  /* ---- reset to a truthful local state whenever the user goes away ---- */
  useEffect(() => {
    if (!cloudConfigured || !user) {
      ready.current = false
      revision.current = 0
      serverCanonical.current = null
      setStatus(SYNC.LOCAL)
      setLastSyncedAt(null)
      setError(null)
      setMigration(null)
    }
  }, [user])

  /* ---- apply a migration choice (shared by prompt + remembered choice) ----
   * Returns true on success; on failure the error state is set for the UI. */
  const applyChoice = useCallback(async (choice, cloudDoc, pulledUpdatedAt) => {
    const localDoc = stateRef.current
    const next = choice === 'merge' ? mergeDocs(localDoc, cloudDoc)
      : choice === 'local' ? localDoc
      : cloudDoc // 'cloud'
    const nextC = canonicalJson(next)
    const cloudC = canonicalJson(cloudDoc)

    setStatus(SYNC.SYNCING)
    try {
      if (nextC !== cloudC) {
        const res = await push(user.id, next, revision.current + 1)
        revision.current = res.revision
        setLastSyncedAt(res.updatedAt)
        serverCanonical.current = nextC
      } else {
        // The cloud already holds exactly this document — no write needed.
        serverCanonical.current = cloudC
        if (pulledUpdatedAt) setLastSyncedAt(pulledUpdatedAt)
      }
      if (nextC !== canonicalJson(localDoc)) {
        dispatch({ type: 'IMPORT_DATA', data: next })
      }
      setStatus(SYNC.SYNCED)
      setError(null)
      ready.current = true
      return true
    } catch (e) {
      setError(friendlyError(e))
      setStatus(navigator.onLine === false ? SYNC.OFFLINE : SYNC.ERROR)
      return false
    }
  }, [user, dispatch])

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

        // Both sides hold data → never silently overwrite. Ask the user —
        // but only when there is something to decide.
        if (cloudDoc && hasData(cloudDoc) && hasData(localDoc)) {
          const localC = canonicalJson(localDoc)
          const cloudC = canonicalJson(cloudDoc)

          if (localC === cloudC) {
            // Documents are identical: already reconciled (e.g. this device
            // adopted the cloud, or a prior sync converged). Nothing to
            // combine, nothing to overwrite, nothing to ask.
            serverCanonical.current = cloudC
            setLastSyncedAt(updatedAt)
            setStatus(SYNC.SYNCED)
            ready.current = true
            return
          }

          const remembered = readMigrationChoice(user.id)
          if (remembered) {
            // This device already chose how to combine its data with this
            // account. Honour that standing decision instead of nagging.
            await applyChoice(remembered, cloudDoc, updatedAt)
            return
          }

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
          serverCanonical.current = canonicalJson(cloudDoc)
          setLastSyncedAt(updatedAt)
          setStatus(SYNC.SYNCED)
          ready.current = true
          return
        }

        // Cloud empty → seed it from whatever this device has.
        const res = await push(user.id, localDoc, revision.current + 1)
        if (!alive) return
        revision.current = res.revision
        serverCanonical.current = canonicalJson(localDoc)
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
  }, [user, dispatch, applyChoice])

  /* ---- resolve the migration prompt ---- */
  const resolveMigration = useCallback(async (choice) => {
    const m = migration
    if (!m || !user) return
    if (choice === 'cancel') { // stay signed in but do not sync
      setMigration(null)
      setStatus(SYNC.ERROR)
      setError('Sync paused — choose how to combine your data to turn it back on.')
      return
    }

    setMigration(null)
    const ok = await applyChoice(choice, m.cloudDoc)
    // Remember the decision only once it actually took effect, so a failed
    // push leaves the choice to be made again rather than silently skipped.
    if (ok) writeMigrationChoice(user.id, choice)
  }, [migration, user, applyChoice])

  /* ---- debounced push on every local change ---- */
  useEffect(() => {
    if (!cloudConfigured || !user || !ready.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (navigator.onLine === false) {
        setStatus(SYNC.OFFLINE)
        return
      }
      const docC = canonicalJson(stateRef.current)
      if (serverCanonical.current && docC === serverCanonical.current) {
        // Local state matches what the server already holds — no write.
        setStatus(SYNC.SYNCED)
        return
      }
      setStatus(SYNC.SYNCING)
      try {
        const res = await push(user.id, stateRef.current, revision.current + 1)
        revision.current = res.revision
        setLastSyncedAt(res.updatedAt)
        serverCanonical.current = docC
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
      serverCanonical.current = canonicalJson(stateRef.current)
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
