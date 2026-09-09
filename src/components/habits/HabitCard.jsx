import HabitRow from './HabitRow.jsx'

/*
 * Today and the Habits workspace share one interaction contract. HabitRow
 * owns the existing reorder / swipe / rename behaviours; this named facade
 * lets screen composition speak in the V3 card vocabulary without creating a
 * second persistence or completion path.
 */
export default function HabitCard(props) {
  return <HabitRow {...props} />
}
