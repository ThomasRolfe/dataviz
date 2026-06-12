import type { Theme } from '@/scene/ThemeColors'
import styles from '@/styles/ThemeToggle.module.css'

interface Props {
  theme: Theme
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      className={styles.toggle}
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}
