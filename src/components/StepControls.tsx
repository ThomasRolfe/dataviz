import { useStepEngine } from '@/hooks/useStepEngine'
import type { StepEngine } from '@/engine/stepEngine'
import styles from '@/styles/StepControls.module.css'

export function StepControls({ engine }: { engine: StepEngine }) {
  const state = useStepEngine(engine)
  if (!state) return null

  return (
    <div className={styles.controls}>
      <button onClick={() => engine.prev()} disabled={state.currentIndex === 0}>
        ← Back
      </button>
      <button onClick={() => engine.toggle()}>
        {state.isPlaying ? 'Pause' : 'Play'}
      </button>
      <button onClick={() => engine.next()} disabled={state.currentIndex === state.totalSteps - 1}>
        Forward →
      </button>
      <span className={styles.counter}>
        {state.currentIndex + 1} / {state.totalSteps}
      </span>
    </div>
  )
}
