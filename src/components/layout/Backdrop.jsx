/* One slow aurora mesh + fine noise. Fixed, behind everything, quiet. */
export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="aurora-blob a" />
      <div className="aurora-blob b" />
      <div className="aurora-blob c" />
    </div>
  )
}
