import { useEffect, useRef } from 'react'
import type { Step } from '@/types/schema'
import type { Theme } from '@/scene/ThemeColors'
import styles from '@/styles/StepSidebar.module.css'

interface Props {
  steps: Step[]
  currentIndex: number
  theme: Theme
  editMode: boolean
  onGoTo: (index: number) => void
  onThemeToggle: () => void
  onEditModeToggle: () => void
}

export function StepSidebar({ steps, currentIndex, theme, editMode, onGoTo, onThemeToggle, onEditModeToggle }: Props) {
  const activeRef = useRef<HTMLDivElement | null>(null)

  // Keep the active step visible when it changes programmatically
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIndex])

  return (
    <nav className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Steps</span>
        <button
          className={`${styles.editBtn}${editMode ? ` ${styles.editBtnActive}` : ''}`}
          onClick={onEditModeToggle}
        >
          {editMode ? 'Done' : 'Edit layout'}
        </button>
        <button className={styles.themeBtn} onClick={onThemeToggle}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      <div className={styles.list}>
        {steps.map((step, i) => (
          <div
            key={step.id}
            ref={i === currentIndex ? activeRef : null}
            className={`${styles.item}${i === currentIndex ? ` ${styles.active}` : ''}`}
            onClick={() => onGoTo(i)}
          >
            <span className={styles.stepNum}>{i}</span>
            <span className={styles.stepName}>{step.name ?? step.title}</span>
          </div>
        ))}
      </div>
    </nav>
  )
}
