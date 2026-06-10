import { useStepEngine } from '@/hooks/useStepEngine'
import type { StepEngine } from '@/engine/stepEngine'
import styles from '@/styles/StepHUD.module.css'

export function StepHUD({ engine }: { engine: StepEngine }) {
  const state = useStepEngine(engine)
  if (!state) return null

  return (
    <div className={styles.hud} key={state.currentIndex}>
      <h2 className={styles.title}>{state.step.title}</h2>
      {state.step.description && (
        <p className={styles.description}>{state.step.description}</p>
      )}
    </div>
  )
}
