import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/**
 * Toast system with optional action (Undo). One visible at a time,
 * auto-dismisses, and pauses the timer when an action is used.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(0)

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  const show = useCallback((message, opts = {}) => {
    clearTimeout(timerRef.current)
    const id = Date.now()
    setToast({ id, message, ...opts })
    timerRef.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), opts.duration || 4500)
  }, [])

  const value = { show, dismiss }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite">
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                className="toast"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <span style={{ flex: 1 }}>{toast.message}</span>
                {toast.actionLabel && (
                  <button
                    className="toast-action"
                    onClick={() => {
                      toast.onAction?.()
                      dismiss()
                    }}
                  >
                    {toast.actionLabel}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
