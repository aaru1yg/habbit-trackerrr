import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'framer-motion'

export default function AnimatedNumber({ value, className, suffix = '', prefix = '', decimals = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { damping: 30, stiffness: 140 })

  useEffect(() => {
    if (inView) motionVal.set(value)
  }, [inView, value, motionVal])

  useEffect(() => {
    const unsub = spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = `${prefix}${latest.toFixed(decimals)}${suffix}`
    })
    return unsub
  }, [spring, prefix, suffix, decimals])

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>
}
