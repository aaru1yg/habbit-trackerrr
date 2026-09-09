/* ============================================================
   FIELDS — the one form system (V5).

   Every entity form composes these: label + hint + error treatment,
   validation wiring and the save/cancel/destructive footer are shared,
   so a Habit form and a Project form feel like one product.
   Inputs reuse the proven .field class; this file owns structure,
   labeling and the states around it.
   ============================================================ */
import { useId, useState } from 'react'
import { ACCENT_PRESETS, isHex } from '../../lib/accent.js'
import { IconCheck, IconSearch, IconX } from '../../lib/icons.jsx'

/* ---------------- Field shell ---------------- */

export function Field({ id, label, hint = null, error = null, optional = false, children }) {
  const hintId = hint ? `${id}-hint` : null
  const errId = error ? `${id}-error` : null
  const described = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`vfield${error ? ' has-error' : ''}`}>
      <label className="vfield-label" htmlFor={id}>
        {label}
        {optional && <span className="vfield-opt">(optional)</span>}
      </label>
      {typeof children === 'function' ? children({ id, described, invalid: !!error }) : children}
      {hint && !error && <p id={hintId} className="vfield-hint">{hint}</p>}
      {error && <p id={errId} className="vfield-error" role="alert">{error}</p>}
    </div>
  )
}

const describedProps = ({ id, described, invalid }) => ({
  id,
  'aria-describedby': described,
  'aria-invalid': invalid || undefined,
})

/* ---------------- Inputs ---------------- */

export function TextInput({ id: givenId, ...rest }) {
  const auto = useId()
  const id = givenId || `vti-${auto.replace(/:/g, '')}`
  return <input id={id} className="field" {...rest} />
}

export function TextArea({ id: givenId, rows = 3, ...rest }) {
  const auto = useId()
  const id = givenId || `vta-${auto.replace(/:/g, '')}`
  return <textarea id={id} className="field textarea" rows={rows} {...rest} />
}

export function SelectInput({ id: givenId, options, ...rest }) {
  const auto = useId()
  const id = givenId || `vse-${auto.replace(/:/g, '')}`
  return (
    <select id={id} className="field" {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function DateInput(props) {
  return <TextInput type="date" {...props} />
}

export function TimeInput(props) {
  return <TextInput type="time" {...props} />
}

export function NumberInput(props) {
  return <TextInput type="number" inputMode="decimal" {...props} />
}

/* ---------------- Toggle (switch) ---------------- */

export function Toggle({ label, checked, onChange, hint = null, id: givenId }) {
  const auto = useId()
  const id = givenId || `vsw-${auto.replace(/:/g, '')}`
  return (
    <div className="vswitch-row">
      <button
        type="button" id={id} role="switch" aria-checked={checked}
        className={`vswitch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="vswitch-knob" aria-hidden="true" />
      </button>
      <label className="vswitch-label" htmlFor={id} onClick={(e) => { e.preventDefault(); onChange(!checked) }}>
        {label}
        {hint && <span className="vswitch-hint">{hint}</span>}
      </label>
    </div>
  )
}

/* ---------------- SearchField ---------------- */

export function SearchField({ label, value, onChange, placeholder = 'Search' }) {
  const auto = useId()
  const id = `vse-${auto.replace(/:/g, '')}`
  return (
    <div className="vsearch">
      <IconSearch size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input
        id={id} className="field" type="search" value={value}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="vsearch-clear" aria-label="Clear search" onClick={() => onChange('')}>
          <IconX size={14} />
        </button>
      )}
    </div>
  )
}

/* ---------------- ColorField (tokenized accent picker) ---------------- */

export function ColorField({ id: givenId, value, onChange, allowAuto = true }) {
  const auto = useId()
  const id = givenId || `vco-${auto.replace(/:/g, '')}`
  const [custom, setCustom] = useState(isHex(value) && !ACCENT_PRESETS.some((p) => p.base === value) ? value : '#8b6bff')
  const isCustom = isHex(value) && !ACCENT_PRESETS.some((p) => p.base === value)

  return (
    <div className="vcolor" role="radiogroup" aria-label="Accent color" id={id}>
      {allowAuto && (
        <button
          type="button" role="radio" aria-checked={!value}
          className={`vcolor-swatch auto${!value ? ' active' : ''}`}
          onClick={() => onChange(null)}
          aria-label="Auto (theme accent)"
        >
          {!value && <IconCheck size={14} aria-hidden="true" />}
        </button>
      )}
      {ACCENT_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button" role="radio" aria-checked={value === p.base}
          className={`vcolor-swatch${value === p.base ? ' active' : ''}`}
          style={{ '--sw': p.base }}
          onClick={() => onChange(p.base)}
          aria-label={`${p.id} accent`}
        >
          {value === p.base && <IconCheck size={14} aria-hidden="true" />}
        </button>
      ))}
      <label className={`vcolor-custom${isCustom ? ' active' : ''}`}>
        <input
          type="color" value={isCustom ? value : custom} aria-label="Custom accent color"
          onChange={(e) => { setCustom(e.target.value); onChange(e.target.value) }}
        />
        <span aria-hidden="true">+</span>
      </label>
    </div>
  )
}

/* ---------------- Form footer (one pattern for save/cancel/destroy) ---------------- */

export function FormFooter({ saving = false, saveLabel = 'Save', onCancel, onDelete = null, deleteLabel = 'Delete' }) {
  return (
    <div className="vform-foot">
      {onDelete && (
        <button type="button" className="vbtn" data-variant="danger" data-size="md" onClick={onDelete}>
          {deleteLabel}
        </button>
      )}
      <span className="vform-spacer" aria-hidden="true" />
      {onCancel && (
        <button type="button" className="vbtn" data-variant="ghost" data-size="md" onClick={onCancel}>
          Cancel
        </button>
      )}
      <button type="submit" className="vbtn" data-variant="primary" data-size="md" disabled={saving} aria-busy={saving || undefined}>
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  )
}

export { describedProps }
