# FlowViz

An animated isometric 3D data-flow diagram tool. Describe a system architecture in a JSON file and step through an animated explanation of how data moves through it — complete with glowing glass tubes, flowing packets, camera focus, and annotation cards.

**FlowViz is designed to be driven by LLMs.** The authoring guide (`flow-authoring-guide.md`) is written as a structured reference that a language model can read once and immediately use to produce a valid, well-laid-out diagram JSON. Give an LLM the guide and a description of your system — AWS stack, microservices, event-driven pipeline, hexagonal architecture, etc. — and it will generate a ready-to-render flow in one pass.

## What it does

- Renders components (services, databases, clients, queues, serverless functions) as 3D meshes on an isometric grid
- Connects them with glass tube pipes that illuminate when active
- Animates data packets travelling through the pipes, with optional arrival styles (success / error / warning)
- Steps through a narrative sequence: each step can highlight components, activate connections, fire a packet, zoom the camera, or show annotation callouts
- Supports zone groupings (with optional nesting and dashed outlines) to visually bound logical boundaries like cloud regions or bounded contexts
- Chevron stream animation for genuine continuous data flows (Kafka, video, telemetry)

## Authoring flows with an LLM

Flows are plain JSON files in `public/flows/`. Drop a new `.json` file there and pass its path as the `?flow=` query parameter.

**[`flow-authoring-guide.md`](./flow-authoring-guide.md)** is the single reference an LLM needs. It covers the full JSON schema, layout rules, zone gap requirements, packet/stream usage, annotation types, and camera controls — with enough examples that a model can produce a correct diagram without iteration. Attach it to a prompt like:

> "Read flow-authoring-guide.md, then create a FlowViz JSON for [your system description]."

**Example flows:**

| File | Description |
|------|-------------|
| `public/flows/aws-web-app.json` | AWS stack: ALB → Nginx → PHP/Node → RDS + Elasticsearch |
| `public/flows/hexagonal-architecture.json` | Three bounded contexts with shared EventBridge event bus |
| `public/flows/appsync-realtime.json` | Serverless movie voting app with AppSync real-time subscriptions |

## Screenshots

### Overview — isometric grid with zones and glass tube pipes
<img width="1936" height="1255" alt="image" src="https://github.com/user-attachments/assets/e24c30c9-24e9-4ac7-9849-063b53eb8a34" />


## Development

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:5173`. The default flow loads automatically; append `?flow=flows/aws-web-app.json` to load a specific file.
