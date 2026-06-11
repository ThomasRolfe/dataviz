import { useState } from 'react'

export function useHover(): {
  hoveredId:    string | null
  setHoveredId: (id: string | null) => void
} {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  return { hoveredId, setHoveredId }
}
