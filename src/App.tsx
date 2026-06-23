import { useState, useEffect, useRef, useCallback } from 'react'
import { CanvasContainer } from '@/components/CanvasContainer'
import { StepControls } from '@/components/StepControls'
import { StepHUD } from '@/components/StepHUD'
import { AnnotationOverlay } from '@/components/AnnotationOverlay'
import { HoverTooltip } from '@/components/HoverTooltip'
import { ZoneTooltip } from '@/components/ZoneTooltip'
import { PipeLabels } from '@/components/PipeLabels'
import { PacketTooltip } from '@/components/PacketTooltip'
import { StepSidebar } from '@/components/StepSidebar'
import { ExportButton } from '@/components/ExportButton'
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
  const [graph, setGraph] = useState<InternalGraph | null>(null)
  const [engine, setEngine] = useState<StepEngine | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bridge, setBridge] = useState<OverlayBridge | null>(null)
  const [scene, setScene] = useState<FlowScene | null>(null)
  const [theme, setTheme] = useState<Theme>('light')
  const [editMode, setEditMode] = useState(false)
  const [arrivedTargets, setArrivedTargets] = useState<Set<string>>(new Set())
  const [pipeLabelData, setPipeLabelData] = useState<
    Array<{ id: string; label: string; midpoint: Vector3 }>
  >([])

  const stepState = useStepEngine(engine)
  const { hoveredId, setHoveredId } = useHover()
  const sceneRef = useRef<FlowScene | null>(null)
  const engineRef = useRef<StepEngine | null>(null)

  useEffect(() => {
    loadFlow('php-fpm-otel')
      .then((def) => {
        const g = buildGraph(def)
        setGraph(g)
        const eng = new StepEngine(def.steps)
        engineRef.current = eng
        setEngine(eng)
        setSteps(def.steps)
      })
      .catch((err) => setError(String(err)))
  }, [])

  // Wire step engine to scene on each step change
  useEffect(() => {
    if (!engine) return
    return engine.subscribe((state) => {
      const packetDefs = [
        ...(state.step.packet ? [state.step.packet] : []),
        ...(state.step.packets ?? []),
      ]
      // If no packets this step, show annotations immediately
      if (packetDefs.length === 0) {
        setArrivedTargets(
          new Set(state.step.annotations?.map((a) => a.target) ?? []),
        )
      } else {
        setArrivedTargets(new Set())
      }
      sceneRef.current?.applyStep(state.step, null, 800)
    })
  }, [engine])

  // Keep the HTML data-theme attribute in sync with React state
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const handleThemeToggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    sceneRef.current?.setTheme(next)
  }, [theme])

  const handleEditModeToggle = useCallback(() => {
    const next = !editMode
    setEditMode(next)
    sceneRef.current?.setEditMode(next)
  }, [editMode])

  const handleGoTo = useCallback((index: number) => {
    engineRef.current?.goTo(index)
  }, [])

  if (error) {
    return (
      <div
        style={{ color: '#ff6b6b', padding: '2rem', fontFamily: 'monospace' }}
      >
        Error: {error}
      </div>
    )
  }

  if (!graph) {
    return (
      <div
        style={{ color: '#e0e0e0', padding: '2rem', fontFamily: 'monospace' }}
      >
        Loading…
      </div>
    )
  }

  return (
    <div className={`${styles.app}${editMode ? ` ${styles.editing}` : ''}`}>
      <CanvasContainer
        graph={graph}
        onSceneReady={(s, b) => {
          sceneRef.current = s
          setScene(s)
          setBridge(b)
          s.setTheme(theme)
          s.setHoverCallback(setHoveredId)
          s.setPacketArrivalCallback((targetId) => {
            setArrivedTargets((prev) => new Set([...prev, targetId]))
          })
          setPipeLabelData(s.getConnectionLabelData())
          const eng = engineRef.current
          if (eng) {
            s.applyStep(eng.getState().step, null, 0)
          }
        }}
      />

      {steps.length > 0 && stepState && (
        <StepSidebar
          steps={steps}
          currentIndex={stepState.currentIndex}
          theme={theme}
          editMode={editMode}
          onGoTo={handleGoTo}
          onThemeToggle={handleThemeToggle}
          onEditModeToggle={handleEditModeToggle}
        />
      )}

      {/* Persistent pipe protocol labels */}
      {bridge && pipeLabelData.length > 0 && (
        <PipeLabels pipes={pipeLabelData} bridge={bridge} />
      )}

      {/* Per-step annotations — deferred until the packet arrives at the target */}
      {bridge &&
        (() => {
          const visible =
            stepState?.step.annotations?.filter((a) =>
              arrivedTargets.has(a.target),
            ) ?? []
          return visible.length > 0 ? (
            <AnnotationOverlay
              annotations={visible}
              graph={graph}
              bridge={bridge}
            />
          ) : null
        })()}

      {hoveredId?.startsWith('__packet__') && sceneRef.current && bridge && (
        <PacketTooltip
          scene={sceneRef.current}
          bridge={bridge}
          hoveredId={hoveredId}
        />
      )}
      {hoveredId &&
        !hoveredId.startsWith('__packet__') &&
        !hoveredId.startsWith('__zone__') &&
        bridge && (
          <HoverTooltip hoveredId={hoveredId} graph={graph} bridge={bridge} />
        )}
      {hoveredId?.startsWith('__zone__') && sceneRef.current && bridge && (
        <ZoneTooltip
          zoneId={hoveredId.slice('__zone__'.length)}
          graph={graph}
          scene={sceneRef.current}
          bridge={bridge}
        />
      )}

      {engine && stepState && (
        <>
          <StepHUD engine={engine} />
          <StepControls engine={engine} />
        </>
      )}

      <ExportButton scene={scene} engine={engine} />
    </div>
  )
}

export default App
