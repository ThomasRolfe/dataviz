import { useState, useEffect, useRef, useCallback } from 'react'
import { CanvasContainer } from '@/components/CanvasContainer'
import { StepControls } from '@/components/StepControls'
import { StepHUD } from '@/components/StepHUD'
import { AnnotationOverlay } from '@/components/AnnotationOverlay'
import { HoverTooltip } from '@/components/HoverTooltip'
import { ZoneLabels } from '@/components/ZoneLabels'
import { PipeLabels } from '@/components/PipeLabels'
import { PacketTooltip } from '@/components/PacketTooltip'
import { StepSidebar } from '@/components/StepSidebar'
import { buildGraph } from '@/engine/parseFlow'
import { StepEngine } from '@/engine/stepEngine'
import { useStepEngine } from '@/hooks/useStepEngine'
import { useHover } from '@/hooks/useHover'
import type { FlowScene } from '@/scene/FlowScene'
import type { OverlayBridge } from '@/scene/OverlayBridge'
import type { Theme } from '@/scene/ThemeColors'
import type { Step } from '@/types/schema'
import type { InternalGraph } from '@/types/internal'
import type { FlowDefinition } from '@/types/schema'
import type { Vector3 } from 'three'
import styles from '@/styles/App.module.css'
import '@/styles/global.css'

async function loadFlow(name: string): Promise<FlowDefinition> {
  const res = await fetch(`/flows/${name}.json`)
  if (!res.ok) throw new Error(`Failed to load flow: ${res.status}`)
  return res.json() as Promise<FlowDefinition>
}

function App() {
  const [graph, setGraph]   = useState<InternalGraph | null>(null)
  const [engine, setEngine] = useState<StepEngine | null>(null)
  const [steps, setSteps]   = useState<Step[]>([])
  const [error, setError]   = useState<string | null>(null)
  const [bridge, setBridge] = useState<OverlayBridge | null>(null)
  const [theme, setTheme]   = useState<Theme>('light')
  const [zoneLabelData, setZoneLabelData] = useState<
    Array<{ label: string; position: Vector3; color: string }>
  >([])
  const [pipeLabelData, setPipeLabelData] = useState<
    Array<{ id: string; label: string; midpoint: Vector3 }>
  >([])

  const stepState                   = useStepEngine(engine)
  const { hoveredId, setHoveredId } = useHover()
  const sceneRef                    = useRef<FlowScene | null>(null)
  const engineRef                   = useRef<StepEngine | null>(null)

  useEffect(() => {
    loadFlow('example')
      .then(def => {
        const g = buildGraph(def)
        setGraph(g)
        const eng = new StepEngine(def.steps)
        engineRef.current = eng
        setEngine(eng)
        setSteps(def.steps)
      })
      .catch(err => setError(String(err)))
  }, [])

  // Wire step engine to scene on each step change
  useEffect(() => {
    if (!engine) return
    return engine.subscribe(state => {
      sceneRef.current?.applyStep(state.step, null, 800)
    })
  }, [engine])

  const handleThemeToggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    sceneRef.current?.setTheme(next)
  }, [theme])

  const handleGoTo = useCallback((index: number) => {
    engineRef.current?.goTo(index)
  }, [])

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
        Loading…
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <CanvasContainer
        graph={graph}
        onSceneReady={(scene, b) => {
          sceneRef.current = scene
          setBridge(b)
          scene.setHoverCallback(setHoveredId)
          setZoneLabelData(scene.getZoneLabelData())
          setPipeLabelData(scene.getConnectionLabelData())
          const eng = engineRef.current
          if (eng) {
            scene.applyStep(eng.getState().step, null, 0)
          }
        }}
      />

      {steps.length > 0 && stepState && (
        <StepSidebar
          steps={steps}
          currentIndex={stepState.currentIndex}
          theme={theme}
          onGoTo={handleGoTo}
          onThemeToggle={handleThemeToggle}
        />
      )}

      {/* Persistent zone labels */}
      {bridge && zoneLabelData.length > 0 && (
        <ZoneLabels zones={zoneLabelData} bridge={bridge} />
      )}

      {/* Persistent pipe protocol labels */}
      {bridge && pipeLabelData.length > 0 && (
        <PipeLabels pipes={pipeLabelData} bridge={bridge} />
      )}

      {/* Per-step annotations with leader lines */}
      {stepState?.step.annotations && stepState.step.annotations.length > 0 && bridge && (
        <AnnotationOverlay
          annotations={stepState.step.annotations}
          graph={graph}
          bridge={bridge}
        />
      )}

      {hoveredId === '__packet__' && sceneRef.current && bridge && (
        <PacketTooltip
          scene={sceneRef.current}
          bridge={bridge}
        />
      )}
      {hoveredId && hoveredId !== '__packet__' && bridge && (
        <HoverTooltip
          hoveredId={hoveredId}
          graph={graph}
          bridge={bridge}
        />
      )}

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
