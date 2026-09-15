import { Text, IconButton } from '../primitives/index.js'
import { IconSearch, IconSparkle } from '../../lib/icons.jsx'

/**
 * ShellTopBar — restrained global top bar.
 * Desktop: page title (left) + Omni trigger (right, quiet).
 * Mobile: page title (left) + Search / Omni icons (right).
 */
export default function ShellTopBar({ title, onSearch, onOmni, isMobile }) {
  return (
    <header className="app-topbar" role="banner">
      <div className="app-topbar__title">
        {/* During the shell → screen migration, legacy screens still render
            their own <h1 className="screen-title">. We render the top-bar
            label as a span so we don't double up document headings. When
            screens are rebuilt to use PageContainer natively this becomes
            a real <h1>. */}
        <Text level="label" as="span" className="app-topbar__heading">{title}</Text>
      </div>
      <div className="app-topbar__actions">
        {isMobile ? (
          <>
            <IconButton label="Search" icon={<IconSearch size={18} />} onClick={onSearch} />
            <IconButton label="Open Omni" icon={<IconSparkle size={18} />} onClick={onOmni} />
          </>
        ) : (
          <button
            type="button"
            className="app-topbar__omni"
            onClick={onOmni}
            aria-label="Open Omni (search, create, commands)"
          >
            <IconSparkle size={15} aria-hidden="true" />
            <span>Omni</span>
            <kbd aria-hidden="true">⌘K</kbd>
          </button>
        )}
      </div>
    </header>
  )
}
