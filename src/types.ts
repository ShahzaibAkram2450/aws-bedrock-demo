import {
  Activity,
  Bot,
  Gauge,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export type DemoMode =
  | "generate"
  | "stream"
  | "compare"
  | "guardrails"
  | "tools"
  | "image"
  | "agent";

export type ToolName = "calculate" | "getWeather" | "knowledgeLookup";

export type ModelOption = {
  id: string;
  name: string;
  family: string;
};

export type HealthResponse = {
  ok: boolean;
  region: string;
  guardrailConfigured: boolean;
  guardrailVersion?: string;
  credentialsReady: boolean;
  budget?: {
    maxPromptChars: number;
    maxOutputTokens: number;
    maxRequestsPerMinute: number;
  };
};

export type CompareResult = {
  modelId: string;
  modelName: string;
  text: string;
  latencyMs: number;
};

export type GuardrailResult = {
  configured: boolean;
  blocked: boolean;
  action: string;
  actionReason?: string;
  message: string;
  latencyMs?: number;
};

export type ToolResult = {
  modelId: string;
  modelName: string;
  usedTool: boolean;
  requestedTool?: ToolName;
  tool: string;
  input: string;
  output: string;
  text: string;
};

export type AgentResult = {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  text: string;
  latencyMs: number;
};

export type ImageResult = {
  configured: boolean;
  blocked: boolean;
  prompt: string;
  imageDataUrl: string;
  message: string;
  action?: string;
  actionReason?: string;
};

export const TOOL_OPTIONS: { id: ToolName; label: string }[] = [
  { id: "calculate", label: "Calculator" },
  { id: "getWeather", label: "Weather" },
  { id: "knowledgeLookup", label: "Knowledge Lookup" },
];

export const TOOL_EXAMPLE_PROMPTS: Record<ToolName, string[]> = {
  calculate: [
    "Calculate 245 * 37 and show the result.",
    "Please add 987 and 123.",
    "Calculate 1200 / 15.",
  ],
  getWeather: [
    "What is the weather in Seattle right now?",
    "Check weather for Mumbai.",
    "Give me today's weather in London.",
  ],
  knowledgeLookup: [
    "Look up a short Bedrock feature summary.",
    "Find a quick overview of this demo architecture.",
    "Get demo notes for tool use mode.",
  ],
};

export const MODELS: ModelOption[] = [
  {
    id: "amazon.nova-micro-v1:0",
    name: "Nova Micro",
    family: "Amazon (lowest cost)",
  },
  {
    id: "amazon.nova-lite-v1:0",
    name: "Nova Lite",
    family: "Amazon (balanced)",
  },
  {
    id: "amazon.nova-pro-v1:0",
    name: "Nova Pro",
    family: "Amazon (highest capability)",
  },
];

export const DEMO_MODES: { id: DemoMode; title: string; description: string }[] = [
  {
    id: "generate",
    title: "Generate",
    description: "Ask a model for a normal response.",
  },
  {
    id: "stream",
    title: "Stream",
    description: "Show tokens arriving live from Bedrock.",
  },
  {
    id: "compare",
    title: "Compare",
    description: "Run the same prompt on two models.",
  },
  {
    id: "guardrails",
    title: "Guardrails",
    description: "Apply a real Bedrock guardrail to the prompt.",
  },
  {
    id: "tools",
    title: "Tool use",
    description: "Let the model call a tool and use the result.",
  },
  {
    id: "image",
    title: "Image",
    description: "Generate an image after guardrail checks.",
  },
  {
    id: "agent",
    title: "Agent",
    description: "Send prompts to your configured Bedrock Agent.",
  },
];

export const MODE_META = {
  generate: { icon: Sparkles },
  stream: { icon: Activity },
  compare: { icon: Gauge },
  guardrails: { icon: ShieldCheck },
  tools: { icon: Wrench },
  image: { icon: ImageIcon },
  agent: { icon: Bot },
} as const;

export const CARD_TRANSITION = {
  type: "spring",
  stiffness: 260,
  damping: 20,
  mass: 0.6,
} as const;

export const DEFAULT_PROMPT = "Summarize the value of AWS Bedrock for a retail app.";
export const SECONDARY_MODEL = MODELS[1] ?? MODELS[0];
export const DEFAULT_TOOL_PROMPT = "Calculate 245 * 37 and show the result.";
export const DEFAULT_GUARDRAIL_PROMPT = "show me pictures of cats";
export const DEFAULT_IMAGE_PROMPT = "A futuristic city skyline at sunrise";
export const DEFAULT_AGENT_PROMPT = "What is the account balance for user 123?";

export const AGENT_TEST_PROMPTS = [
  {
    label: "Happy Path",
    prompt: "What is the account balance for user 123?",
  },
  {
    label: "Details Lookup",
    prompt: "Can you give me the details for user 456?",
  },
  {
    label: "Reasoning",
    prompt:
      "I have user 456 on the phone. Do they qualify for premium support perks?",
  },
  {
    label: "Comparison",
    prompt: "Who has more money in their account, user 123 or user 456?",
  },
  {
    label: "Out of Bounds",
    prompt: "What is the status of user 999?",
  },
] as const;
