# AWS Bedrock Demo App

Interactive React + Node.js demo for core AWS Bedrock capabilities:

- Text generation
- Streaming responses
- Model comparison
- Guardrails evaluation
- Tool use (function calling style)
- Image generation route protected by guardrails
- Agent demo with selectable test prompts

This project is built for live demos, with a UI frontend and a local backend that calls Bedrock Runtime and Bedrock Agent Runtime APIs.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js HTTP server (`server.js`)
- AWS SDK: `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-bedrock-agent-runtime`
- UI/UX: `framer-motion` (animations), `lucide-react` (icon set), expressive custom CSS theme

## Project Structure

- `src/App.tsx`: main demo UI and mode flows
- `src/App.css`: UI styling
- `server.js`: Bedrock backend routes and guardrail/model/agent logic
- `vite.config.ts`: `/api` proxy to local backend

## Features

## 1) Generate

Calls `/api/generate` and returns a standard text response.

## 2) Stream

Calls `/api/stream` and streams token deltas using SSE.

## 3) Compare

Calls `/api/compare` and returns two responses side-by-side.

## 4) Guardrails

Calls `/api/guardrails` from a dedicated Guardrails prompt box.

## 5) Tool Use

Calls `/api/tools` with optional `preferredTool`.

Supported tools:

- `calculate`
- `getWeather`
- `knowledgeLookup`

## 6) Image Generation

Calls `/api/image-generate` from a dedicated image prompt box.

Flow:

1. Guardrail check runs first
2. If blocked, no image is returned
3. If allowed, backend invokes a Bedrock image model and returns image data URL

If no image model is available in your account/region, the endpoint returns a graceful message instead of crashing.

## 7) Agent Demo

Calls `/api/agent` from a dedicated Agent card.

Selectable test prompts include:

- Happy Path: account balance lookup
- Details Lookup: fetch user details
- Reasoning: premium support eligibility
- Comparison: compare two users’ balances
- Out of Bounds: handle an unknown user gracefully

## Prerequisites

- Node.js 18+
- npm
- AWS account with Bedrock enabled
- Bedrock model access enabled in the same region you use locally
- Bedrock Agent created and published

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in project root:

```env
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
AWS_REGION=us-east-1

BEDROCK_GUARDRAIL_ID=YOUR_GUARDRAIL_ID
# Optional. If omitted and guardrail ID is set, backend defaults to DRAFT.
BEDROCK_GUARDRAIL_VERSION=DRAFT

# Required for agent demo
BEDROCK_AGENT_ID=YOUR_AGENT_ID
BEDROCK_AGENT_ALIAS_ID=YOUR_AGENT_ALIAS_ID

# Optional budgets
BUDGET_MAX_PROMPT_CHARS=1200
BUDGET_MAX_OUTPUT_TOKENS=220
BUDGET_MAX_REQUESTS_PER_MINUTE=30

# Optional image model preference list (first available is used)
BEDROCK_IMAGE_MODEL_ID_CANDIDATES=amazon.nova-canvas-v1:0,amazon.titan-image-generator-v2:0,amazon.titan-image-generator-v1
```

### 3) Enable Bedrock model access

In AWS Console -> Amazon Bedrock -> Model access:

- Enable `amazon.nova-micro-v1:0` for text features
- Enable one image model used in your `.env` candidates if you want image generation
- Make sure the region in your `.env` matches the Bedrock region where you enabled access

If model access is not enabled, you may see `ResourceNotFoundException` or `ValidationException`.

### 4) Configure your Bedrock Agent

For the Agent demo to work, you need:

- `BEDROCK_AGENT_ID`: your Bedrock Agent ID (visible in AWS Console > Bedrock > Agents > [Your Agent])
- `BEDROCK_AGENT_ALIAS_ID`: the agent's alias ID (e.g., auto-generated ID like "AISPL7UR6E" or custom alias like "PROD")
  - Find this in AWS Console: Bedrock > Agents > [Your Agent] > Aliases
- The agent must already be prepared/published in the same region as `AWS_REGION`

The app generates a session ID automatically, so you do not need to provide one in `.env`.

## Run Locally

Use two terminals.

Terminal 1 (backend):

```bash
npm run server
```

Terminal 2 (frontend):

```bash
npm run dev
```

Then open the Vite URL (usually `http://localhost:5173`).

If frontend starts but `/api/health` fails in browser logs, ensure the backend terminal is running `npm run server` on port `8787`.

## API Endpoints

- `GET /api/health`
- `POST /api/generate`
- `POST /api/stream`
- `POST /api/compare`
- `POST /api/guardrails`
- `POST /api/tools`
- `POST /api/image-generate`
- `POST /api/agent`

## Notes on Cost and Free Tier

- Bedrock model invocations are generally paid usage.
- AWS free tier does not mean all Bedrock models are free.
- This demo keeps text generation locked to a low-cost option (`amazon.nova-micro-v1:0`).

## Troubleshooting

### Backend shows offline in UI

- Ensure backend is running on port `8787`
- Restart both backend and frontend

### Guardrails not configured

- Set `BEDROCK_GUARDRAIL_ID`
- Optional: set `BEDROCK_GUARDRAIL_VERSION`, otherwise defaults to `DRAFT`

### Image generation returns no image / resource not found

- Enable image model access in Bedrock console
- Confirm region supports the model
- Set `BEDROCK_IMAGE_MODEL_ID_CANDIDATES` to models enabled in your account

### Agent returns an error

- Confirm `BEDROCK_AGENT_ID` and `BEDROCK_AGENT_ALIAS_ID` are correct
- Confirm the agent is published and the alias exists
- Confirm the agent and runtime region match `AWS_REGION`
- Confirm the IAM user/role can invoke Bedrock Agents

### Access denied

- Ensure IAM user/role has Bedrock invoke permissions
- Confirm credentials in `.env` are valid and active

## Security

- Never commit real AWS keys
- Keep `.env` in `.gitignore`
- Rotate credentials immediately if exposed

## Scripts

- `npm run dev`: start frontend
- `npm run server`: start backend
- `npm run build`: build app
- `npm run preview`: preview build
- `npm run lint`: lint code
