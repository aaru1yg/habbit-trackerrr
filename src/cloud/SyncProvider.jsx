/* ============================================================
   SYNC — orchestration around the engine.

   Contract:
     - The app works identically with no account. Sync is a
       backup and a second device, not a precondition.
     - Status is only SYNCED after a real round-trip resolved, and
       `lastSyncedAt` is always the server's timestamp.
     - A write that lost a race is re-read and merged, never
       overwritten. Losing someone's evening of edits because two
       tabs were open is not an acceptable failure mode.
     - The "how should we combine these?" prompt appears only when
       a genuine choice exists: both sides hold data, the two
       documents actually differ, and this device has not already
       answered for this account.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useActions } from '../core/store.jsx'
import { migrate } from '../core/schema.js'
import { useAuth } from './AuthProvider.jsx'
import { cloudConfigured } from './config.js'
import { pull, push, clearCloud, SYNC } from './syncEngine.js'
import { friendlyError } from './errors.js'
import { mergeDocs, summarise, hasData, docKey } from './merge.js'
import { readMigrationChoice, writeMigrationChoice } from './migrationState.js'

const SyncContext = createContext(null)
export const useSync = () => useContext(SyncContext)

/* Long enough that typing a note is one write, short enough that closing the
   laptop straight after checking off a habit still catches it. */
const DEBOUNCE_MS = 1200

/** Put a document from the wire through the same gate as one from disk. */
const adopt = (doc) => migrate(doc)

/**
 * Record that this device and this account are now reconciled.
 *
 * The prompt asks a question only worth asking once: "your device and your
 * account each hold data that the other does not — what should happen?" Once
 * the two are in agreement, by any route (the account was seeded from here,
 * this device adopted the account, or they already matched), that question is
 * answered for good. Later divergence is just a device that was offline for a
 * while, and merging it is lossless.
 *
 * Without this, every reload carrying an unsynced edit looked like a fresh
 * first encounter and raised the dialog again, over the whole app.
 */
const remember = (userId) => {
  if (!readMigrationChoice(userId)) writeMigrationChoice(userId, 'merge')
}

export default function SyncProvider({ children }) {
  const state = useStore()
  const { hydrate } = useActions()
  const auth = useAuth()
  const user = auth?.user ?? null

  const [status, setStatus] = useState(SYNC.LOCAL)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [error, setError] = useState(null)
  const [migration, setMigration] = useState(null)

  const revision = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state
  // Suppresses the auto-push while we are still establishing what is true.
  const ready = useRef(false)
  const timer = useRef(null)
  // Canonical form of the document as the server last confirmed it. When the
  // local state matches, there is nothing to send and we skip the write.
  const serverKey = useRef(null)
  const inFlight = useRef(false)

  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false
  const fail = useCallback((e) => {
    setError(friendlyError(e))
    setStatus(online() ? SYNC.ERROR : SYNC.OFFLINE)
  }, [])

  /* ---- signed out: say so, and mean it ---- */
  useEffect(() => {
    if (cloudConfigured && user) return
    ready.current = false
    revision.current = 0
    serverKey.current = null
    setStatus(SYNC.LOCAL)
    setLastSyncedAt(null)
    setError(null)
    setMigration(null)
  }, [user])

  /* ---- write, re-merging if we lost a race ----
     Returns true when the server confirmed the write. */
  const commit = useCallback(async (doc) => {
    if (!user) return false
    let outgoing = doc
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await push(user.id, outgoing, revision.current)
      if (!res.conflict) {
        revision.current = res.revision
        setLastSyncedAt(res.updatedAt)
        serverKey.current = docKey(outgoing)
        // A merge during retry means the local document changed too.
        if (outgoing !== doc) hydrate(adopt(outgoing))
        return true
      }
      // Someone else wrote first. Take their version, fold ours into it,
      // and try again rather than discarding either side.
      const remote = await pull(user.id)
      revision.current = remote.revision
      outgoing = remote.doc ? mergeDocs(outgoing, remote.doc) : outgoing
    }
    throw new Error('Could not save to the cloud after several attempts. Your data is safe on this device.')
  }, [user, hydrate])

  /* ---- apply a first-sign-in choice (prompted or remembered) ---- */
  const applyChoice = useCallback(async (choice, cloudDoc, pulledUpdatedAt) => {
    const localDoc = stateRef.current
    const next = choice === 'merge' ? mergeDocs(localDoc, cloudDoc)
      : choice === 'local' ? localDoc
      : cloudDoc

    setStatus(SYNC.SYNCING)
    try {
      if (docKey(next) === docKey(cloudDoc)) {
        // The cloud already holds exactly this. No write needed.
        serverKey.current = docKey(cloudDoc)
        if (pulledUpdatedAt) setLastSyncedAt(pulledUpdatedAt)
      } else {
        await commit(next)
      }
      if (docKey(next) !== docKey(localDoc)) hydrate(adopt(next))
      setStatus(SYNC.SYNCED)
      setError(null)
      ready.current = true
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }, [commit, hydrate, fail])

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

        if (cloudDoc && hasData(cloudDoc) && hasData(localDoc)) {
          if (docKey(localDoc) === docKey(cloudDoc)) {
            // Already reconciled. Nothing to combine, nothing to ask.
            serverKey.current = docKey(cloudDoc)
            setLastSyncedAt(updatedAt)
            setStatus(SYNC.SYNCED)
            ready.current = true
            remember(user.id)
            return
          }
          const remembered = readMigrationChoice(user.id)
          if (remembered) {
            await applyChoice(remembered, cloudDoc, updatedAt)
            return
          }
          // Genuinely the first encounter between this device's data and
          // this account's data. Only now is there a question to ask.
          setMigration({ local: summarise(localDoc), cloud: summarise(cloudDoc), cloudDoc })
          setStatus(SYNC.SYNCING)
          return
        }

        if (cloudDoc && hasData(cloudDoc)) {
          // The account is the only side with anything. Adopt it.
          hydrate(adopt(cloudDoc))
          serverKey.current = docKey(cloudDoc)
          setLastSyncedAt(updatedAt)
          setStatus(SYNC.SYNCED)
          ready.current = true
          remember(user.id)
          return
        }

        // The account is empty: seed it from this device.
        await commit(localDoc)
        if (!alive) return
        setStatus(SYNC.SYNCED)
        ready.current = true
        remember(user.id)
      } catch (e) {
        if (alive) fail(e)
      }
    })()

    return () => { alive = false }
  }, [user, hydrate, applyChoice, commit, fail])

  /* ---- resolve the prompt ---- */
  const resolveMigration = useCallback(async (choice) => {
    const m = migration
    if (!m || !user) return
    if (choice === 'cancel') {
      setMigration(null)
      setStatus(SYNC.ERROR)
      setError('Sync is paused until you choose how to combine your data.')
      return
    }
    setMigration(null)
    const ok = await applyChoice(choice, m.cloudDoc)
    // Remember only once it actually took effect, so a failed write leaves
    // the choice to be made again rather than silently skipped.
    if (ok) writeMigrationChoice(user.id, choice)
  }, [migration, user, applyChoice])

  /* ---- debounced push on local change ---- */
  useEffect(() => {
    if (!cloudConfigured || !user || !ready.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (!online()) { setStatus(SYNC.OFFLINE); return }
      if (inFlight.current) return
      const key = docKey(stateRef.current)
      if (serverKey.current && key === serverKey.current) { setStatus(SYNC.SYNCED); return }
      inFlight.current = true
      setStatus(SYNC.SYNCING)
      try {
        await commit(stateRef.current)
        setStatus(SYNC.SYNCED)
        setError(null)
      } catch (e) {
        fail(e)
      } finally {
        inFlight.current = false
      }
    }, DEBOUNCE_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [state, user, commit, fail])

  /* ---- pick up another device's changes ----
     Without this, two devices only converge when one of them writes. A pull
     on focus and on reconnect is cheap and makes "same account, two
     machines" behave the way people expect. */
  const refresh = useCallback(async () => {
    if (!cloudConfigured || !user || !ready.current || inFlight.current) return
    if (!online()) { setStatus(SYNC.OFFLINE); return }
    inFlight.current = true
    try {
      const { doc: cloudDoc, revision: rev, updatedAt } = await pull(user.id)
      revision.current = rev
      if (!cloudDoc) return
      const localDoc = stateRef.current
      const cloudK = docKey(cloudDoc)
      if (cloudK === docKey(localDoc)) {
        serverKey.current = cloudK
        setLastSyncedAt(updatedAt)
        setStatus(SYNC.SYNCED)
        return
      }
      if (serverKey.current === docKey(localDoc)) {
        // No unsynced local edits, so the cloud is simply newer. Take it.
        hydrate(adopt(cloudDoc))
        serverKey.current = cloudK
        setLastSyncedAt(updatedAt)
        setStatus(SYNC.SYNCED)
        return
      }
      // Both sides moved. Fold them together and write the result back.
      const merged = mergeDocs(localDoc, cloudDoc)
      hydrate(adopt(merged))
      serverKey.current = null // force the debounced push to send it
      setStatus(SYNC.SYNCING)
    } catch (e) {
      fail(e)
    } finally {
      inFlight.current = false
    }
  }, [user, hydrate, fail])

  useEffect(() => {
    if (!cloudConfigured || !user) return
    // visibilitychange is fired at the document, not the window. Listening on
    // the wrong target meant returning to the tab never re-read the account.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    // Switching between two windows of the same browser does not change
    // visibility, so focus is a second, distinct trigger.
    const onFocus = () => refresh()
    const onOnline = () => refresh()
    const onOffline = () => setStatus(SYNC.OFFLINE)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [user, refresh])

  /** Manual "sync now", and the retry path after an error. */
  const syncNow = useCallback(async () => {
    if (!cloudConfigured || !user) return
    setStatus(SYNC.SYNCING)
    try {
      await commit(stateRef.current)
      setStatus(SYNC.SYNCED)
      setError(null)
      ready.current = true
    } catch (e) {
      fail(e)
    }
  }, [user, commit, fail])

  /** Stop syncing and remove the cloud copy, keeping this device's data. */
  const forgetCloud = useCallback(async () => {
    if (!cloudConfigured || !user) return { error: null }
    try {
      await clearCloud(user.id)
      revision.current = 0
      serverKey.current = null
      ready.current = false
      return {}
    } catch (e) {
      return { error: friendlyError(e) }
    }
  }, [user])

  const value = useMemo(() => ({
    configured: cloudConfigured,
    status, lastSyncedAt, error, migration,
    resolveMigration, syncNow, refresh, forgetCloud,
  }), [status, lastSyncedAt, error, migration, resolveMigration, syncNow, refresh, forgetCloud])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
