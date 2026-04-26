# AWS Bedrock Demo App

Interactive React + Node.js demo for core AWS Bedrock capabilities:

- Text generation
- Streaming responses
- Model comparison
- Guardrails evaluation
- Tool use (function calling style)
- Image generation route protected by guardrails

This project is built for live demos, with a UI frontend and a local backend that calls Bedrock Runtime APIs.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js HTTP server (`server.js`)
- AWS SDK: `@aws-sdk/client-bedrock-runtime`

## Project Structure

- `src/App.tsx`: main demo UI and mode flows
- `src/App.css`: UI styling
- `server.js`: Bedrock backend routes and guardrail/model logic
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

## 6) Image Generation (Guardrail-protected route)

Calls `/api/image-generate` from a dedicated image prompt box.

Flow:

1. Guardrail check runs first
2. If blocked, no image is returned
3. If allowed, backend invokes a Bedrock image model and returns image data URL

If no image model is available in your account/region, endpoint returns a graceful message (no crash).

## Prerequisites

- Node.js 18+
- npm
- AWS account with Bedrock enabled
- Bedrock model access enabled in the same region you use locally

## Setup

## 1) Install dependencies

Run:

npm install

## 2) Configure environment variables

Create a `.env` file in project root:

AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
AWS_REGION=us-east-1

BEDROCK_GUARDRAIL_ID=YOUR_GUARDRAIL_ID

# Optional. If omitted and guardrail ID is set, backend defaults to DRAFT.

BEDROCK_GUARDRAIL_VERSION=DRAFT

# Optional budgets

BUDGET_MAX_PROMPT_CHARS=1200
BUDGET_MAX_OUTPUT_TOKENS=220
BUDGET_MAX_REQUESTS_PER_MINUTE=30

# Optional image model preference list (first available is used)

BEDROCK_IMAGE_MODEL_ID_CANDIDATES=amazon.nova-canvas-v1:0,amazon.titan-image-generator-v2:0,amazon.titan-image-generator-v1

## 3) Enable Bedrock model access

In AWS Console -> Amazon Bedrock -> Model access:

- Enable `amazon.nova-micro-v1:0` (text features)
- Enable one image model used in your `.env` candidates

If model access is not enabled, you may see `ResourceNotFoundException` or `ValidationException`.

## Run Locally

Use two terminals.

Terminal 1 (backend):

npm run server

Terminal 2 (frontend):

npm run dev

Then open the Vite URL (usually `http://localhost:5173`).

## API Endpoints

- `GET /api/health`
- `POST /api/generate`
- `POST /api/stream`
- `POST /api/compare`
- `POST /api/guardrails`
- `POST /api/tools`
- `POST /api/image-generate`

## Notes on Cost and Free Tier

- Bedrock model invocations are generally paid usage.
- AWS free tier does not mean all Bedrock models are free.
- This demo keeps text model locked to a low-cost option (`amazon.nova-micro-v1:0`).

## Troubleshooting

## Backend shows offline in UI

- Ensure backend is running on port `8787`
- Restart both backend and frontend

## Guardrails not configured

- Set `BEDROCK_GUARDRAIL_ID`
- Optional: set `BEDROCK_GUARDRAIL_VERSION`, otherwise defaults to `DRAFT`

## Image generation returns no image / resource not found

- Enable image model access in Bedrock console
- Confirm region supports the model
- Set `BEDROCK_IMAGE_MODEL_ID_CANDIDATES` to models enabled in your account

## Access denied

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
