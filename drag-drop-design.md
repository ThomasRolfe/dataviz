# Drag-and-Drop Component Repositioning — Design Document

Covers everything needed to let users manually reposition components in the
live diagram. Written after a full codebase investigation; references are to
the current source at the time of writing.

---

## 1. Feature goal

A user can switch into **edit mode**, click any component on the canvas, drag
it to a new position, and release to snap it to the nearest grid cell. Pipes
reconnect automatically. Optionally, the edited layout can be exported back
to JSON so the change persists.

---

## 2. Interaction model

### 2.1 Edit-mode toggle

The biggest design decision is distinguishing a component drag from a camera
pan — both start with pointer-down on the canvas. The cleanest solution is an
explicit **edit/view mode toggle** rather than a modifier key or intent
inference.

| Mode | Pointer-down on component | Pointer-down on canvas |
|------|--------------------------|------------------------|
| **View** (default) | hover highlight only | pan camera (current behaviour) |
| **Edit** | begin component drag | pan camera |

Add a toggle button to the `StepSidebar` or the top toolbar. While in edit
mode, show a visible indicator (e.g. a coloured badge on the sidebar, or a
dashed border around the canvas).

### 2.2 Drag vs. click threshold

On pointer-down in edit mode, wait for at least 4px of movement before
treating it as a drag. A sub-threshold release is a no-op (or could be used
for future selection/inspect behaviour). This prevents accidental moves on
taps.

---

## 3. Hit-testing

`HoverSystem.ts` already raycasts against all component `hitMesh` objects on
every pointer-move (lines 36–59). For drag start, repeat this cast on
`pointerDown` to identify the grabbed component. No new raycasting
infrastructure is needed.

During drag, project the pointer onto the **ground plane (y = 0)** each
frame:

```ts
// inside FlowScene.onPointerMove, edit-mode drag path
raycaster.setFromCamera(pointer, this.camera)
const t = -raycaster.ray.origin.y / raycaster.ray.direction.y
const worldPos = raycaster.ray.origin
  .clone()
  .add(raycaster.ray.direction.clone().multiplyScalar(t))
// worldPos.x, worldPos.z = pointer position on ground plane
```

The isometric camera always looks down at an angle, so `direction.y` is
always negative and the formula is stable.

---

## 4. Grid snapping

`layoutEngine.ts` provides `gridToWorld()` but no inverse. Add:

```ts
// layoutEngine.ts
export function worldToGrid(x: number, z: number): { col: number; row: number } {
  return {
    col: Math.round(x / CELL_SIZE),
    row: Math.round(z / CELL_SIZE),
  }
}
```

**During drag:** position the component mesh at the raw world-space pointer
position (smooth, unsnapped) for responsive feel.

**On pointer-up:** snap to the nearest grid cell via `worldToGrid()`, then
commit (update positions, rebuild pipes).

Clamping: optionally clamp `col` and `row` to `[0, grid.cols - component.w]`
and `[0, grid.rows - component.h]` to prevent dragging off the grid.

---

## 5. Component mesh update

`ComponentMesh` stores a `THREE.Group` (`this.group`) that parents all visual
sub-meshes and the hit mesh. Moving the group moves everything:

```ts
// FlowScene — during drag (unsnapped)
const cm = this.components.get(draggedId)
cm.group.position.set(worldX, cm.group.position.y, worldZ)

// FlowScene — on pointer-up (after snap)
const ic = this.graph.components.get(draggedId)
const snapped = gridToWorld(newCol, newRow)
ic.center.set(snapped.x, 0, snapped.z)
ic.topCenter.set(snapped.x, ic.meshSize.y, snapped.z)
cm.group.position.set(snapped.x, cm.group.position.y, snapped.z)
```

The hit mesh is a child of the group so it moves automatically. No changes
needed to `HoverSystem`.

---

## 6. Pipe rebuild — the hardest part

### 6.1 Current state

`ConnectionPipe.ts` bakes `TubeGeometry` once in its constructor from
pre-computed curve points. There is no update path. The curves are derived
from `InternalComponent.center` (computed in `parseFlow.ts` lines 135–136)
plus port spread offsets computed once (lines 47–127).

### 6.2 Required change

Add an `update(fromCenter, toCenter)` method to `ConnectionPipe`:

```ts
// ConnectionPipe.ts
update(fromCenter: THREE.Vector3, toCenter: THREE.Vector3): void {
  const startPt = fromCenter.clone().add(this.portOffset.start).setY(PIPE_HEIGHT)
  const endPt   = toCenter.clone().add(this.portOffset.end).setY(PIPE_HEIGHT)
  const curve   = buildCurve(startPt, endPt, this.waypoints)

  const oldGeo = this.mesh.geometry
  this.mesh.geometry = new THREE.TubeGeometry(
    curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_RADIUS_SEGS, false
  )
  oldGeo.dispose()

  this.curve    = curve
  this.midpoint = curve.getPointAt(0.5)
}
```

On component snap, find all connections involving the moved component and call
`update()` on each:

```ts
for (const [connId, ic] of this.graph.connections) {
  if (ic.fromId === draggedId || ic.toId === draggedId) {
    const from = this.graph.components.get(ic.fromId)!
    const to   = this.graph.components.get(ic.toId)!
    this.pipes.get(connId)?.update(from.center, to.center)
  }
}
```

### 6.3 Port offset recomputation

Port offsets fan-out connections that share an attachment face. They are
computed once in `parseFlow.ts` and stored per `ConnectionPipe`. After a
move, if a component gains or loses connections on a face (unlikely in
practice — connections don't change, only positions do), offsets would need
recomputing. **For Phase 1, skip this**: existing offsets remain valid
because the relative port positions are stable; only the absolute centre
changes.

If fan-out pipes look visually misaligned after a move, revisit in Phase 2.

### 6.4 Live drag pipe update (optional)

Rebuilding geometry every pointer-move frame is expensive if the component
has many connections. Two options:

- **Option A (simplest):** Only rebuild on snap (pointer-up). During drag,
  pipes stay in their old position. Add a dashed preview line from old to
  new port to indicate the pending reconnection.
- **Option B (live):** Rebuild on every move frame. Safe for ≤ 20 pipes;
  monitor frame time. Throttle to every 2nd or 3rd frame if needed.

Recommend Option A for Phase 1; upgrade to Option B only if the UX feels
unresponsive.

---

## 7. Persistence / JSON export

There is no write-back to JSON today. Two options:

### 7.1 Visual-only (Phase 1)

Moves affect the scene immediately but are not saved. Reloading the page
resets to the original JSON. Simplest to implement; acceptable for
exploratory layout editing.

### 7.2 Copy-to-clipboard (Phase 2)

Add a **"Copy flow JSON"** button (near the existing Export GIF button) that
serialises the current `InternalGraph` back to `FlowDefinition` format:

```ts
function graphToFlowDefinition(
  graph:   InternalGraph,
  original: FlowDefinition,
): FlowDefinition {
  const components = Array.from(graph.components.values()).map(ic => {
    const { col, row } = worldToGrid(ic.center.x, ic.center.z)
    return {
      ...original.components.find(c => c.id === ic.id)!,
      position: { col, row },
    }
  })
  return { ...original, components }
}
```

The user can paste the JSON into their flow file and commit. Zones, metadata,
steps, and connection routes remain unchanged — only `position` values update.

---

## 8. Collision detection (optional, Phase 2+)

On snap, check whether the new cell range overlaps any existing component's
footprint. If it does, either:
- Reject the drop (snap to the nearest free cell instead), or
- Highlight the overlap and allow it anyway (editor trusts the user)

Implementing this requires an AABB check over all component footprints. It
is not needed for Phase 1.

---

## 9. Visual feedback

| State | Visual |
|-------|--------|
| Edit mode active | Dashed border on canvas; "Edit" badge in sidebar |
| Hovering a draggable component | Cursor: `move` |
| Dragging | Component at semi-transparent (0.7 opacity) world position; dashed outline at snap target cell; pipes stay in old position (Option A) |
| Snap preview | Ghost box at target cell before pointer-up |
| Snap committed | Component moves to cell; pipes rebuild; brief scale-bounce animation |

---

## 10. Phased implementation plan

### Phase 1 — Core drag (estimated: 2–3 days)

1. **`worldToGrid()` in `layoutEngine.ts`** — S, no risk
2. **Edit-mode toggle UI** — S (button in sidebar, boolean state in App)
3. **Pointer-down component pick** — S (reuse HoverSystem raycaster)
4. **Ray–ground-plane intersection on pointer-move** — S (three lines of
   math)
5. **Live mesh position during drag (unsnapped)** — S
6. **Snap on pointer-up + update `InternalComponent.center`** — S
7. **`ConnectionPipe.update()` method** — M (geometry disposal, test for
   leaks)
8. **Rebuild pipes on snap** — S once `update()` exists

**End state:** user can drag components and pipes reconnect on release.
Moves are lost on reload.

### Phase 2 — Polish (estimated: 1–2 days)

9. **Port offset recomputation** (if fan-out pipes misalign) — M
10. **Live pipe rebuild during drag (Option B)** — M
11. **Copy-flow-JSON button** — S
12. **Collision detection / snap-to-nearest-free** — M
13. **Visual feedback polish** (ghost box, bounce, cursor) — S–M

### Phase 3 — Future

- Server-side persistence (requires backend, out of scope)
- Undo/redo stack
- Multi-select drag

---

## 11. Key risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `TubeGeometry` disposal leaks GPU memory | Medium | Profile with Chrome's WebGL inspector; call `dispose()` on both geometry and any replaced buffer attributes |
| Port offsets misalign after move | Low–Medium | Skip recomputation in Phase 1; if misaligned, add recompute in Phase 2 |
| Accidental drag in view mode | Low | Edit-mode toggle eliminates ambiguity |
| Drag feels laggy with many pipes | Low | Option A (rebuild on snap only) avoids per-frame geometry creation |

---

## 12. Files to change

| File | Change |
|------|--------|
| `src/engine/layoutEngine.ts` | Add `worldToGrid()` |
| `src/scene/ConnectionPipe.ts` | Add `update(fromCenter, toCenter)` method |
| `src/scene/FlowScene.ts` | Edit-mode flag; drag state machine in pointer handlers; `startDrag / moveDrag / endDrag` methods; pipe rebuild on snap |
| `src/components/StepSidebar.tsx` | Edit-mode toggle button |
| `src/App.tsx` | Pass edit-mode toggle callback down; wire up |
| `src/utils/flowSerializer.ts` | New file — `graphToFlowDefinition()` (Phase 2) |
| `src/components/ExportButton.tsx` | Add "Copy JSON" variant or separate component (Phase 2) |
