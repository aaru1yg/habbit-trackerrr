/* One slow aurora mesh + fine noise + distant planes. Fixed, behind
   everything, quiet. The .world-static twin is the CSS half of the V4
   environment: every device gets the depth composition; capable devices
   additionally get the WebGL WorldScene layered over it (WorldLayer). */
export default function Backdrop() {
  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className="aurora-blob a" />
        <div className="aurora-blob b" />
        <div className="aurora-blob c" />
      </div>
      <div className="world-static" aria-hidden="true">
        <i className="w1" />
        <i className="w2" />
        <i className="w3" />
      </div>
    </>
  )
}
