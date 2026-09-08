/* Compatibility alias. Search now opens the same Omni Panel rather than a
   second search product. */
import CommandCenter from './CommandCenter.jsx'

export default function SearchPalette({ open, onClose }) {
  return <CommandCenter open={open} onClose={onClose} initialMode="search" />
}
