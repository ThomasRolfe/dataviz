import { useState, useEffect, useRef } from 'react'
import { CanvasContainer } from '@/components/CanvasContainer'
import { StepControls } from '@/components/StepControls'
import { StepHUD } from '@/components/StepHUD'
import { AnnotationOverlay } from '@/components/AnnotationOverlay'
import { PopoutPanel } from '@/components/PopoutPanel'
import { HoverTooltip } from '@/components/HoverTooltip'
import { buildGraph } from '@/engine/parseFlow'
import { StepEngine } from '@/engine/stepEngine'
import { useStepEngine } from '@/hooks/useStepEngine'
import { useHover } from '@/hooks/useHover'
import type { FlowScene } from '@/scene/FlowScene'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import type { InternalGraph } from '@/types/internal'
import type { FlowDefinition } from '@/types/schema'
import styles from '@/styles/App.module.css'
import '@/styles/global.css'

async function loadFlow(name: string): Promise<FlowDefinition> {
  const res = await fetch(`/flows/${name}.json`)
  if (!res.ok) throw new Error(`Failed to load flow: ${res.status}`)
  const raw = await res.json()
  // validateFlow is called inside buildGraph
  return raw as FlowDefinition
}

function App() {
  const [graph, setGraph]           = useState<InternalGraph | null>(null)
  const [engine, setEngine]         = useState<StepEngine | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const stepState                   = useStepEngine(engine)
  const { hoveredId, setHoveredId } = useHover()
  const sceneRef                    = useRef<FlowScene | null>(null)
  const bridgeRef                   = useRef<OverlayBridge | null>(null)

  useEffect(() => {
    loadFlow('example')
      .then(def => {
        const g = buildGraph(def)
        setGraph(g)
        setEngine(new StepEngine(def.steps))
      })
      .catch(err => setError(String(err)))
  }, [])

  // Wire step engine to scene
  useEffect(() => {
    if (!engine) return
    return engine.subscribe(state => {
      sceneRef.current?.applyStep(state.step, null, 800)
    })
  }, [engine])

  if (error) {
    return (
      <div style={{ color: '#ff6b6b', padding: '2rem', fontFamily: 'monospace' }}>
        Error: {error}
      </div>
    )
  }

  if (!graph) {
    return (
      <div style={{ color: '#e0e0e0', padding: '2rem', fontFamily: 'monospace' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <CanvasContainer
        graph={graph}
        onSceneReady={(scene, bridge) => {
          sceneRef.current  = scene
          bridgeRef.current = bridge
          scene.setHoverCallback(setHoveredId)
          // Apply step 0 immediately with no animation
          if (stepState) {
            scene.applyStep(stepState.step, null, 0)
          }
        }}
      />

      {/* Overlays */}
      {stepState?.step.annotations && stepState.step.annotations.length > 0 && bridgeRef.current && (
        <AnnotationOverlay
          annotations={stepState.step.annotations}
          graph={graph}
          bridge={bridgeRef.current}
        />
      )}
      {stepState?.step.popouts && stepState.step.popouts.length > 0 && bridgeRef.current && (
        <PopoutPanel
          popouts={stepState.step.popouts}
          graph={graph}
          bridge={bridgeRef.current}
        />
      )}
      {hoveredId && bridgeRef.current && (
        <HoverTooltip
          hoveredId={hoveredId}
          graph={graph}
          bridge={bridgeRef.current}
        />
      )}

      {/* UI chrome */}
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
