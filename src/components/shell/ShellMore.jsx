import Sheet from '../ui/Sheet.jsx'
import { Link } from '../../lib/router.jsx'
import { Text, Stack, Divider, Cluster } from '../primitives/index.js'
import { SECONDARY_GROUPS, SECONDARY_SHELL } from './nav.js'
import { IconSearch } from '../../lib/icons.jsx'

/**
 * ShellMore — mobile "More" bottom sheet.
 * Shows Omni/Search entry, secondary destinations grouped by pillar,
 * and the Settings / Goals shell items.
 */
export default function ShellMore({ open, onClose, onSearch, onOmni }) {
  return (
    <Sheet open={open} onClose={onClose} title="More" labelledBy="shell-more-title">
      <div className="shell-more">
        <Cluster gap="compact" className="shell-more__quick">
          <button type="button" className="shell-more__quick-btn" onClick={() => { onClose(); onOmni?.() }}>
            <span>Omni</span>
            <Text level="micro">Search · Create · Commands</Text>
          </button>
          <button type="button" className="shell-more__quick-btn" onClick={() => { onClose(); onSearch?.() }}>
            <IconSearch size={18} />
            <span>Search</span>
          </button>
        </Cluster>

        {SECONDARY_GROUPS.map((group) => (
          <div key={group.label} className="shell-more__group">
            <Text level="micro" className="shell-more__group-label">{group.label}</Text>
            <Stack gap="micro">
              {group.items.map(({ to, label, Icon }) => (
                <Link key={to} to={to} className="shell-more__link" onClick={onClose}>
                  <span className="shell-more__link-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span>{label}</span>
                </Link>
              ))}
            </Stack>
          </div>
        ))}

        <Divider />

        <Stack gap="micro">
          {SECONDARY_SHELL.map(({ id, to, label, Icon }) => (
            <Link key={id} to={to} className="shell-more__link" onClick={onClose}>
              <span className="shell-more__link-icon" aria-hidden="true"><Icon size={18} /></span>
              <span>{label}</span>
            </Link>
          ))}
        </Stack>
      </div>
    </Sheet>
  )
}
