# FlowViz — Flow Authoring Guide for LLMs

This document is the authoritative reference for generating valid FlowViz flow
definition JSON files. Read it fully before producing any JSON. The schema is
strict — invalid field names or values will silently break the visualisation.

---

## 1. What FlowViz renders

FlowViz produces an animated isometric 3D diagram. The viewer steps forward and
backward through a sequence of states. At each step:

- A subset of **components** (boxes, cylinders, etc.) are highlighted; others dim.
- A subset of **connections** (pipes between components) illuminate.
- An optional **packet** (a glowing shape) travels along one connection.
- Optional **annotation cards** appear with leader lines pointing to specific components.
- The camera may pan and zoom to focus on a specific component.

The goal is to tell a clear story about how data moves through a system — one
meaningful event per step.

---

## 2. Top-level structure

```json
{
  "meta":        { "title": "...", "description": "..." },
  "layout":      { "grid": { "cols": 10, "rows": 6 } },
  "zones":       [...],
  "components":  [...],
  "connections": [...],
  "steps":       [...]
}
```

Every field is required. `zones` may be an empty array if zones are not needed.

---

## 3. `meta`

```json
{
  "title":       "OAuth 2.0 PKCE Flow",
  "description": "How a browser-based app obtains an access token without a client secret."
}
```

`title` is shown in the step HUD. `description` is optional context.

---

## 4. `layout`

```json
{ "grid": { "cols": 12, "rows": 6 } }
```

The grid defines the coordinate space. All positions are integer (col, row) values.
`cols` controls width (left-to-right), `rows` controls depth (top-to-bottom in
screen space).

**Sizing guidance:**
- Default cell size is 3.0 world units. The camera auto-frames the full grid.
- Use enough cols for the flow to spread horizontally. 8–14 is typical.
- Use enough rows to separate parallel tracks. 4–8 is typical.
- Leave empty cells — crowding is worse than padding.

---

## 5. `zones`

Zones are semi-transparent coloured regions on the ground plane that group
related components. They have a label that appears in the top corner of the zone.

```json
{
  "id":     "z_browser",
  "label":  "Browser",
  "color":  "#4a9edd",
  "bounds": { "col": 0, "row": 1, "width": 3, "height": 4 }
}
```

| Field    | Type   | Notes |
|----------|--------|-------|
| `id`     | string | Unique. Referenced nowhere else — for your own bookkeeping only. |
| `label`  | string | Short (1–3 words). Shown as a rotated overlay label inside the zone. |
| `color`  | string | Hex colour. Used for fill, border, and label. |
| `bounds` | object | `col`/`row` = top-left corner. `width`/`height` in grid cells. |

**Zone sizing rule:** bounds should enclose all member components with at least
one cell of padding on each side. This prevents the zone border from touching
component meshes.

---

## 6. `components`

Each component maps to a 3D mesh in the scene.

```json
{
  "id":       "auth_server",
  "label":    "Auth Server",
  "type":     "service",
  "position": { "col": 5, "row": 2 },
  "size":     { "w": 2, "h": 1 },
  "meta": {
    "description": "Issues authorization codes and access tokens.",
    "file":        "services/auth/src/server.ts",
    "line":        1,
    "notes":       "Uses RS256 for token signing."
  }
}
```

### 6.1 Component types

| `type`     | Geometry     | Visual height | Use for |
|------------|--------------|---------------|---------|
| `client`   | Box          | Short (0.8)   | Browser, mobile app, CLI tool, external consumer |
| `service`  | Box          | Medium (1.2)  | Backend API, microservice, HTTP server |
| `database` | Cylinder     | Tall (1.6)    | Any persistent store: SQL, NoSQL, cache, object storage |
| `queue`    | Flat box     | Very flat (0.6) | Message broker, topic, event bus, FIFO queue |
| `function` | Octahedron   | Minimal (0.5) | Serverless function, Lambda, background job, cron |
| `external` | Box          | Standard (1.0)| Third-party system outside your control |

### 6.2 `position`

`col` and `row` are the top-left corner of the component's footprint.

`elevation` (optional, default 0) raises the component on the Y axis. Rarely
needed — only use it for components that are conceptually "above" others (e.g. an
API gateway hovering over backend services in an architectural diagram).

### 6.3 `size`

Optional. `w` is width in grid cells (along the col axis). `h` is depth in grid
cells (along the row axis). Both default to 1.

Use `size.w > 1` for components that are architecturally central, handle many
connections, or need visual prominence. `{ "w": 2, "h": 1 }` is a common choice
for services with multiple inbound connections.

### 6.4 `meta`

All fields optional. Shown in the hover tooltip when the user hovers the component.

- `description` — one sentence explaining what the component does.
- `file` — source file path relative to the repo root.
- `line` — line number in that file (entry point or primary handler).
- `notes` — additional context, constraints, or gotchas.

---

## 7. `connections`

Each connection is rendered as a pipe (tube geometry) between two components.

```json
{
  "id":    "c_code_exchange",
  "from":  "browser",
  "to":    "auth_server",
  "label": "POST /token",
  "route": "auto"
}
```

| Field   | Notes |
|---------|-------|
| `id`    | Unique. Referenced in steps (`active_connections`) and packets (`connection`). |
| `from`  | Component id. |
| `to`    | Component id. |
| `label` | Optional. Names the operation (e.g. `"POST /api/events"`, `"INSERT INTO orders"`). |
| `route` | `"auto"` for automatic L-shape routing, or an array of `{ "col": n, "row": n }` waypoints. |

**Routing guidance:**
- Always start with `"auto"`. The engine routes via the midpoint between source
  and destination to avoid most crossings.
- Add explicit waypoints only when the auto route visually crosses through an
  unrelated component. Waypoints are intermediate grid positions the pipe must
  pass through.
- Model each direction of data transfer as a separate connection. If A calls B
  and B responds to A, use two connections: `a_to_b` and `b_to_a`.

---

## 8. `steps`

Steps are the animation sequence. The engine presents them one at a time.

### 8.1 Step 0: the overview (required)

**Always include a step with id `0` as the first step.** It should have no
highlights, no annotations, no packet, and no camera focus. This is the resting
state — the viewer sees the full architecture before anything happens.

```json
{
  "id":          0,
  "title":       "System Overview",
  "description": "Brief description of the system before any events occur.",
  "highlight":   [],
  "active_connections": [],
  "camera":      { "focus": null }
}
```

### 8.2 Full step schema

```json
{
  "id":                 2,
  "name":               "Auth redirect",
  "title":              "Browser requests authorisation",
  "description":        "The app constructs the authorisation URL and redirects the user.",
  "highlight":          ["browser", "auth_server"],
  "active_connections": ["c_auth_redirect"],
  "camera":             { "focus": "browser", "zoom": 1.4 },
  "annotations": [
    {
      "type":   "callout",
      "target": "browser",
      "text":   "window.location.href = authUrl"
    }
  ],
  "popouts": [],
  "packet": {
    "connection": "c_auth_redirect",
    "shape":      "envelope",
    "data": {
      "response_type": "code",
      "client_id":     "app_123",
      "code_challenge": "S256..."
    }
  }
}
```

### 8.3 `name` — sidebar label (optional)

`name` is the short label shown in the **step navigation sidebar** on the right side of the screen. Users click it to jump directly to that step.

- **Optional.** If omitted the sidebar falls back to `title`.
- **Keep it short** — 2–4 words at most. The sidebar column is narrow (≈220 px).
  Long names wrap and make the list harder to scan.
- `title` should still be a complete, descriptive sentence shown in the HUD.
  `name` is the abbreviated version for quick navigation.

| Field   | Where shown          | Ideal length     | Example |
|---------|----------------------|------------------|---------|
| `title` | Step HUD (top-left)  | Full sentence    | `"App generates PKCE params and redirects"` |
| `name`  | Sidebar step list    | 2–4 words        | `"PKCE & redirect"` |

**Good `name` values:**
```
"Overview"          ← step 0
"User action"       ← first trigger
"Send to Collector" ← data in flight
"Validate & batch"  ← transformation step
"Publish to Kafka"  ← next hop
"Data at rest"      ← final state
```

**Anti-patterns to avoid:**
- Repeating the full title: `"User clicks Sign in with Google"` — too long.
- Generic labels: `"Step 1"`, `"Next"` — meaningless out of context.
- Omitting `name` when `title` is long — the sidebar will show the full title,
  which wraps and looks cluttered.

### 8.4 `highlight`

Array of component ids. Highlighted components appear at full brightness.
All other components dim to 25% opacity.

- Include all components that are **actively involved** in this step.
- If the step is a pure data-in-flight moment (packet traveling), highlight
  the source and destination of that transfer.
- If the step is a transformation inside one component, highlight only that component.
- Empty array = all components at full brightness (use for overview step only).

### 8.5 `active_connections`

Array of connection ids. Active pipes illuminate with a brighter colour.

- Include only the connection(s) carrying data in this step.
- Should match the packet's `connection` when a packet is present.
- An empty array is valid (e.g. a transformation step with no data transfer).

### 8.6 `camera`

Optional. Controls camera position for this step.

```json
{ "focus": "component_id", "zoom": 1.4 }
```

- `focus: null` — returns to the full-scene overview.
- `focus: "id"` — pans to centre on that component.
- `zoom` — multiplier on the default frustum. `1.0` = overview size. `1.5` = 50%
  closer. `2.0` = twice as close. Keep between `1.2` and `2.5`.
- Omitting `camera` entirely is equivalent to `{ "focus": null }`.

**When to zoom:** focus + zoom on a component when the step is about an internal
process (transformation, validation, decision). Return to overview (`focus: null`)
for data-in-flight steps where the packet's journey across the scene is the story.

### 8.7 `annotations`

Array of annotation cards. Each card floats near its target component with a
dashed leader line. Multiple annotations fan out automatically to avoid overlap.

```json
{
  "type":   "callout",
  "target": "browser",
  "text":   "analytics.track('button_click', { id: 'cta' })"
}
```

| `type`      | When to use | Visual style |
|-------------|-------------|--------------|
| `callout`   | An event, trigger, or action occurring at the component. User interactions, inbound requests, system events. | White text, blue left border |
| `transform` | Code-level processing inside the component: validation, enrichment, encryption, format conversion. | Monospace font, cyan left border |

**Annotation text guidelines:**
- For `callout`: write as the actual code or event that fires, not a prose
  description. `"user.signIn({ provider: 'google' })"` not `"User signs in"`.
- For `transform`: write as a function call chain or arrow expression.
  `"validate() → enrich() → produce()"` not `"The data is validated and enriched"`.
- Keep text under ~80 characters so it fits the card without wrapping excessively.
- Use at most 2–3 annotations per step. More than that creates visual noise.

### 8.8 `popouts`

Array of data popout panels. Each shows a structured key-value payload anchored
to a component. **Currently not rendered in the UI — reserve for future use.**

```json
{
  "title":  "Event payload",
  "anchor": "browser",
  "data": {
    "event":     "button_click",
    "userId":    "u_9f3a",
    "timestamp": 1718000000000
  }
}
```

Include popouts for completeness in the JSON even if they are not yet displayed.
They will be rendered in a future release.

### 8.9 `packet`

A glowing shape that travels along a connection pipe. Stays at the destination
after arrival until the next step. The user can hover it to inspect the payload.

```json
{
  "connection": "c1",
  "shape":      "document",
  "data": {
    "event":     "button_click",
    "userId":    "u_9f3a",
    "timestamp": 1718000000000
  }
}
```

Use `null` (or omit the field) for steps with no data-in-flight.

**Packet shape vocabulary:**

| `shape`    | Geometry  | Semantic meaning |
|------------|-----------|-----------------|
| `sphere`   | Sphere    | Generic event, message, or notification |
| `document` | Flat box  | JSON body, HTTP request/response, structured record |
| `token`    | Flat disk | Auth token, JWT, session key, API key |
| `blob`     | Squashed sphere | Binary data, file content, image |
| `envelope` | Wide flat box | HTTP redirect, wrapped response, message envelope |

**Choosing a shape:** match the semantic type of the data, not the transport.
A JWT sent over HTTP is a `token`, not a `document`. A JSON event payload sent
over a message queue is a `document`, not an `envelope`. An HTTP 302 redirect is
an `envelope`.

**`data` field:** include the actual representative payload structure. Keys and
values are shown verbatim in the hover tooltip. Use realistic values, not
placeholders like `"<user_id>"`. Real data makes the diagram more instructive.

---

## 9. Layout heuristics

### 9.1 Grid orientation

Orient data flow **left to right** (increasing col). The viewer reads the diagram
like a flowchart. Source systems go in low cols, destination systems in high cols.

### 9.2 Branching

Use **rows** for parallel paths. If a request can succeed or fail, put the success
path on one row and the error path on a different row.

### 9.3 Grouping by trust/deployment boundary

Put components that belong to the same service boundary, deployment unit, or
trust zone in the same zone. A zone should contain 1–4 components. More than
that is a sign the zone is too broad.

### 9.4 Spacing

Leave at least one empty cell of gap between zone boundaries. Components placed
at the very edge of a zone will visually clip the zone border.

### 9.5 Connection crossings

Auto-routing produces L-shaped paths. Crossings are inevitable when flows
branch back leftward. To reduce crossings:
- Route "return" connections (responses) above or below the "request" connections.
- Use `size.h > 1` on components that need space for multiple ports.
- Add waypoints only as a last resort.

### 9.6 Grid size formula

A reliable starting formula:

```
cols = max_parallel_components_in_flow * 2 + 2
rows = max_parallel_tracks + 2
```

For a simple linear pipeline with 4 components: `cols = 10, rows = 4`.
For a flow with a 3-way fan-out: `cols = 10, rows = 6`.

---

## 10. Step sequencing patterns

### Pattern 1: Linear pipeline

Each step covers exactly one hop in the data flow.

```
Step 0: Overview (all components, no highlights)
Step 1: Source fires (highlight source, callout annotation)
Step 2: Data travels to next component (highlight both, packet)
Step 3: Processing at receiver (highlight receiver, transform annotation)
Step 4: Data travels onward (highlight both, packet)
...
Step N: Final state (highlight destination, camera zoom)
```

### Pattern 2: Request-response

```
Step 0: Overview
Step 1: Client sends request (highlight client + server, packet: document)
Step 2: Server processes (highlight server, transform annotation)
Step 3: Server responds (highlight server + client, packet: envelope, reverse connection)
Step 4: Client handles response (highlight client, callout annotation)
```

### Pattern 3: Fan-out

```
Step 0: Overview
Step 1: Event fires at source
Step 2: Source publishes to queue (packet: sphere/envelope)
Step 3: Multiple consumers receive (highlight queue + all consumers, multiple active_connections)
Step 4: Each consumer processes independently (separate steps per consumer)
```

---

## 11. Common mistakes to avoid

1. **Missing overview step.** Always include step id=0 with empty `highlight` and
   `active_connections`. The viewer is disoriented if the first thing they see is
   already in mid-action.

2. **Overhighlighting.** Only highlight components that are *directly* involved in
   this step. Highlighting 5 out of 6 components defeats the purpose of dimming.

3. **Packet without active_connection.** If you include a `packet`, its `connection`
   should also appear in `active_connections`. Otherwise the pipe stays dark while
   the packet travels it.

4. **Prose in annotation text.** Annotations are not tooltips — they describe
   *what is happening in code* at this moment. Write code, not prose.

5. **Zone bounds that are too tight.** If `bounds.col + bounds.width` exactly
   equals a component's right edge col, there is no padding and it looks clipped.
   Always add at least 1 cell of padding.

6. **Steps with no visual change.** Every step must change at least one of:
   highlight, active_connections, camera, annotations, or packet. A step that
   changes nothing confuses the viewer.

7. **Too many steps.** Aim for 5–10 steps per flow. More than 12 is hard to
   follow. If the flow has more meaningful events, split it into multiple flows.

8. **Reusing connection ids for return paths.** A connection has a fixed `from`
   and `to`. For a response traveling the reverse direction, define a separate
   connection with `from` and `to` swapped.

---

## 12. Worked example — Telemetry Pipeline

A minimal but complete example illustrating all features.

```json
{
  "meta": {
    "title": "Telemetry Pipeline",
    "description": "How a button click becomes a row in ClickHouse"
  },
  "layout": { "grid": { "cols": 10, "rows": 6 } },
  "zones": [
    {
      "id": "z_client",
      "label": "Browser",
      "color": "#4a9edd",
      "bounds": { "col": 0, "row": 1, "width": 2, "height": 4 }
    },
    {
      "id": "z_ingest",
      "label": "Ingest Layer",
      "color": "#5dbe8a",
      "bounds": { "col": 3, "row": 0, "width": 4, "height": 6 }
    },
    {
      "id": "z_storage",
      "label": "Storage Layer",
      "color": "#e8a838",
      "bounds": { "col": 8, "row": 1, "width": 2, "height": 4 }
    }
  ],
  "components": [
    {
      "id": "browser", "label": "Browser Client", "type": "client",
      "position": { "col": 1, "row": 3 },
      "meta": { "description": "React SPA. Fires analytics events on user interaction." }
    },
    {
      "id": "collector", "label": "Collector API", "type": "service",
      "position": { "col": 4, "row": 2 }, "size": { "w": 2, "h": 1 },
      "meta": { "description": "Node.js service. Validates, batches, and forwards events." }
    },
    {
      "id": "kafka", "label": "Kafka Topic", "type": "queue",
      "position": { "col": 4, "row": 4 }, "size": { "w": 2, "h": 1 },
      "meta": { "description": "telemetry-events topic. Partitioned by userId." }
    },
    {
      "id": "clickhouse", "label": "ClickHouse", "type": "database",
      "position": { "col": 9, "row": 3 },
      "meta": { "description": "Columnar store for event analytics." }
    }
  ],
  "connections": [
    { "id": "c1", "from": "browser",   "to": "collector",  "label": "POST /events", "route": "auto" },
    { "id": "c2", "from": "collector", "to": "kafka",      "label": "produce()",    "route": "auto" },
    { "id": "c3", "from": "kafka",     "to": "clickhouse", "label": "consumer",     "route": "auto" }
  ],
  "steps": [
    {
      "id": 0, "name": "Overview",
      "title": "Telemetry Pipeline Overview",
      "description": "A button click in the browser travels through a collector API and Kafka topic before landing in ClickHouse.",
      "highlight": [], "active_connections": [],
      "camera": { "focus": null }
    },
    {
      "id": 1, "name": "User action",
      "title": "User action fires event",
      "description": "A button click triggers analytics.track() in the browser.",
      "highlight": ["browser"], "active_connections": [],
      "camera": { "focus": "browser", "zoom": 1.5 },
      "annotations": [
        { "type": "callout", "target": "browser", "text": "analytics.track('button_click', { id: 'cta' })" }
      ],
      "popouts": [], "packet": null
    },
    {
      "id": 2, "name": "Send to Collector",
      "title": "Event sent to Collector",
      "description": "SDK serializes the event and POSTs it to the collector endpoint.",
      "highlight": ["browser", "collector"], "active_connections": ["c1"],
      "camera": { "focus": null },
      "annotations": [], "popouts": [],
      "packet": { "connection": "c1", "shape": "document", "data": { "event": "button_click", "userId": "u_9f3a", "timestamp": 1718000000000 } }
    },
    {
      "id": 3, "name": "Validate & batch",
      "title": "Collector validates and batches",
      "description": "Collector checks schema, attaches server-side metadata, then produces to Kafka.",
      "highlight": ["collector"], "active_connections": [],
      "camera": { "focus": "collector", "zoom": 1.3 },
      "annotations": [
        { "type": "transform", "target": "collector", "text": "validate() → enrich({ ip, serverTs }) → produce()" }
      ],
      "popouts": [], "packet": null
    },
    {
      "id": 4, "name": "Publish to Kafka",
      "title": "Event published to Kafka",
      "description": "Enriched event produced to the telemetry-events topic, keyed by userId.",
      "highlight": ["collector", "kafka"], "active_connections": ["c2"],
      "camera": { "focus": null },
      "annotations": [], "popouts": [],
      "packet": { "connection": "c2", "shape": "envelope", "data": { "topic": "telemetry-events", "partition": 3, "key": "u_9f3a" } }
    },
    {
      "id": 5, "name": "Write to ClickHouse",
      "title": "Consumer writes to ClickHouse",
      "description": "A Kafka consumer reads the event and inserts it into ClickHouse.",
      "highlight": ["kafka", "clickhouse"], "active_connections": ["c3"],
      "camera": { "focus": null },
      "annotations": [], "popouts": [],
      "packet": { "connection": "c3", "shape": "document", "data": { "event": "button_click", "userId": "u_9f3a" } }
    },
    {
      "id": 6, "name": "Data at rest",
      "title": "Data at rest",
      "description": "Event is now queryable in ClickHouse. End of the pipeline.",
      "highlight": ["clickhouse"], "active_connections": [],
      "camera": { "focus": "clickhouse", "zoom": 1.3 },
      "annotations": [
        { "type": "callout", "target": "clickhouse", "text": "SELECT count() FROM events WHERE event = 'button_click'" }
      ],
      "popouts": [], "packet": null
    }
  ]
}
```

---

## 13. Validation checklist

Before returning a flow JSON, verify each of these:

- [ ] Step `id: 0` exists with `highlight: []`, `active_connections: []`, `camera: { "focus": null }`
- [ ] Every `connection.from` and `connection.to` references an existing component `id`
- [ ] Every `step.highlight` entry references an existing component `id`
- [ ] Every `step.active_connections` entry references an existing connection `id`
- [ ] Every `step.packet.connection` references an existing connection `id`
- [ ] Every `annotation.target` references an existing component `id`
- [ ] Every `popout.anchor` references an existing component `id`
- [ ] Zone `bounds` enclose their member components with at least 1 cell padding
- [ ] Each component's `position.col + size.w` does not exceed `layout.grid.cols`
- [ ] Each component's `position.row + size.h` does not exceed `layout.grid.rows`
- [ ] No two components occupy overlapping grid cells
- [ ] Steps with a `packet` also have the packet's `connection` in `active_connections`
- [ ] Data flows left-to-right (increasing col) in the general case
- [ ] `packet.data` contains realistic representative values, not placeholders

---

## 14. Version note

This guide reflects FlowViz capabilities as of the current build. Features marked
**"not yet rendered"** are accepted by the schema but produce no visual output in
the current version. Do not omit them — they will activate in future releases
without requiring schema changes.

| Feature | Status |
|---------|--------|
| Component meshes (all types) | ✅ Rendered |
| Connection pipes | ✅ Rendered |
| Zone fills + labels | ✅ Rendered |
| Step highlight / dim transitions | ✅ Rendered |
| Packet animation + hover tooltip | ✅ Rendered |
| Annotation cards with leader lines | ✅ Rendered (`callout`, `transform`) |
| Camera pan + zoom per step | ✅ Rendered |
| Scroll-wheel zoom | ✅ Interactive |
| Component hover tooltip | ✅ Interactive |
| Packet hover payload | ✅ Interactive |
| Step sidebar with jump-to navigation | ✅ Interactive |
| `step.name` sidebar label | ✅ Rendered (falls back to `title`) |
| Popout panels | 🔲 Schema accepted, not yet rendered |
| Connection labels | 🔲 Schema accepted, not yet rendered |
| Elevation (`position.elevation`) | 🔲 Schema accepted, not yet rendered |
