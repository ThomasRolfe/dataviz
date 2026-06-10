import { useState, useEffect, useRef } from 'react'
import { CanvasContainer } from '@/components/CanvasContainer'
import { StepControls } from '@/components/StepControls'
import { StepHUD } from '@/components/StepHUD'
import { validateFlow } from '@/engine/parseFlow'
import { StepEngine } from '@/engine/stepEngine'
import { useStepEngine } from '@/hooks/useStepEngine'
import type { SceneManager } from '@/scene/SceneManager'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import type { FlowDefinition } from '@/types/schema'
import styles from '@/styles/App.module.css'
import '@/styles/global.css'

async function loadFlow(name: string): Promise<FlowDefinition> {
  const res = await fetch(`/flows/${name}.json`)
  if (!res.ok) throw new Error(`Failed to load flow: ${res.status}`)
  const raw = await res.json()
  return validateFlow(raw)
}

function App() {
  const [engine, setEngine] = useState<StepEngine | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const stepState           = useStepEngine(engine)
  const sceneRef            = useRef<SceneManager | null>(null)
  const bridgeRef           = useRef<OverlayBridge | null>(null)

  useEffect(() => {
    loadFlow('example')
      .then(def => setEngine(new StepEngine(def.steps)))
      .catch(err => setError(String(err)))
  }, [])

  if (error) {
    return (
      <div style={{ color: '#ff6b6b', padding: '2rem', fontFamily: 'monospace' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <CanvasContainer
        onSceneReady={(sm, bridge) => {
          sceneRef.current  = sm
          bridgeRef.current = bridge
        }}
      />
      {engine && stepState && (
        <>
          <StepHUD engine={engine} />
          <StepControls engine={engine} />
        </>
      )}
    </div>
  )
}

export default App
