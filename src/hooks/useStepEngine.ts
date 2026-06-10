import { useState, useEffect } from 'react'
import type { StepEngine, StepState } from '@/engine/stepEngine'

export function useStepEngine(engine: StepEngine | null): StepState | null {
  const [state, setState] = useState<StepState | null>(
    () => engine?.getState() ?? null
  )

  useEffect(() => {
    if (!engine) return
    setState(engine.getState())
    return engine.subscribe(setState)
  }, [engine])

  return state
}
