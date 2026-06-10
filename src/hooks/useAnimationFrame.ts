import { useEffect, useRef } from 'react'

export function useAnimationFrame(callback: () => void, deps: unknown[]): void {
  const savedCallback = useRef(callback)
  const rafRef        = useRef<number>()

  useEffect(() => { savedCallback.current = callback }, [callback])

  useEffect(() => {
    const loop = () => {
      savedCallback.current()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
