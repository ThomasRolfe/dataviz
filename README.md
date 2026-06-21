# FlowViz

An animated isometric 3D data-flow diagram tool. Define a system architecture in a JSON file and step through an animated explanation of how data moves through it — complete with glowing glass tubes, flowing packets, camera focus, and annotation cards.

## What it does

- Renders components (services, databases, clients, queues, serverless functions) as 3D meshes on an isometric grid
- Connects them with glass tube pipes that illuminate when active
- Animates data packets travelling through the pipes, with optional arrival styles (success / error / warning)
- Steps through a narrative sequence: each step can highlight components, activate connections, fire a packet, zoom the camera, or show annotation callouts
- Supports zone groupings (with optional nesting and dashed outlines) to visually bound logical boundaries like cloud regions or bounded contexts
- Chevron stream animation for genuine continuous data flows (Kafka, video, telemetry)

## Authoring flows

Flows are plain JSON files in `public/flows/`. Drop a new `.json` file there and pass its path as the `?flow=` query parameter.

**Authoring reference:** [`flow-authoring-guide.md`](./flow-authoring-guide.md) — full schema documentation optimised for LLM-assisted authoring.

**Example flows:**

| File | Description |
|------|-------------|
| `public/flows/aws-web-app.json` | AWS stack: ALB → Nginx → PHP/Node → RDS + Elasticsearch |
| `public/flows/hexagonal-architecture.json` | Three bounded contexts with shared EventBridge event bus |
| `public/flows/appsync-realtime.json` | Serverless movie voting app with AppSync real-time subscriptions |

## Screenshots

### Overview — isometric grid with zones and glass tube pipes
<!-- screenshot -->

### Packet in transit through a connection
<!-- screenshot -->

### Step with annotation callout and camera zoom
<!-- screenshot -->

### Chevron stream animation on active connections
<!-- screenshot -->

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The default flow loads automatically; append `?flow=flows/aws-web-app.json` to load a specific file.
