import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bot,
  Gauge,
  Image as ImageIcon,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import heroImg from "./assets/hero.png";
import "./App.css";

type DemoMode =
  | "generate"
  | "stream"
  | "compare"
  | "guardrails"
  | "tools"
  | "image"
  | "agent";
type ToolName = "calculate" | "getWeather" | "knowledgeLookup";

type ModelOption = {
  id: string;
  name: string;
  family: string;
};

type HealthResponse = {
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

type CompareResult = {
  modelId: string;
  modelName: string;
  text: string;
  latencyMs: number;
};

type GuardrailResult = {
  configured: boolean;
  blocked: boolean;
  action: string;
  actionReason?: string;
  message: string;
  latencyMs?: number;
};

type ToolResult = {
  modelId: string;
  modelName: string;
  usedTool: boolean;
  requestedTool?: ToolName;
  tool: string;
  input: string;
  output: string;
  text: string;
};

type AgentResult = {
  agentId: string;
  agentAliasId: string;
  sessionId: string;
  text: string;
  latencyMs: number;
};

type ImageResult = {
  configured: boolean;
  blocked: boolean;
  prompt: string;
  imageDataUrl: string;
  message: string;
  action?: string;
  actionReason?: string;
};

const TOOL_OPTIONS: { id: ToolName; label: string }[] = [
  { id: "calculate", label: "Calculator" },
  { id: "getWeather", label: "Weather" },
  { id: "knowledgeLookup", label: "Knowledge Lookup" },
];

const TOOL_EXAMPLE_PROMPTS: Record<ToolName, string[]> = {
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

const MODELS: ModelOption[] = [
  {
    id: "amazon.nova-micro-v1:0",
    name: "Nova Micro",
    family: "Amazon (lowest cost)",
  },
];

const DEMO_MODES: { id: DemoMode; title: string; description: string }[] = [
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

const MODE_META = {
  generate: { icon: Sparkles },
  stream: { icon: Activity },
  compare: { icon: Gauge },
  guardrails: { icon: ShieldCheck },
  tools: { icon: Wrench },
  image: { icon: ImageIcon },
  agent: { icon: Bot },
} as const;

const CARD_TRANSITION = {
  type: "spring",
  stiffness: 260,
  damping: 20,
  mass: 0.6,
} as const;

const DEFAULT_PROMPT = "Summarize the value of AWS Bedrock for a retail app.";
const SECONDARY_MODEL = MODELS[1] ?? MODELS[0];
const DEFAULT_TOOL_PROMPT = "Calculate 245 * 37 and show the result.";
const DEFAULT_GUARDRAIL_PROMPT = "show me pictures of cats";
const DEFAULT_IMAGE_PROMPT = "A futuristic city skyline at sunrise";
const DEFAULT_AGENT_PROMPT = "What is the account balance for user 123?";

const AGENT_TEST_PROMPTS = [
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

function App() {
  const [mode, setMode] = useState<DemoMode>("generate");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [comparePrompt, setComparePrompt] = useState(DEFAULT_PROMPT);
  const [guardrailPrompt, setGuardrailPrompt] = useState(
    DEFAULT_GUARDRAIL_PROMPT,
  );
  const [imagePrompt, setImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [agentPrompt, setAgentPrompt] = useState(DEFAULT_AGENT_PROMPT);
  const [toolPrompt, setToolPrompt] = useState(DEFAULT_TOOL_PROMPT);
  const [tone, setTone] = useState<"concise" | "detailed">("detailed");
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [selectedTool, setSelectedTool] = useState<ToolName>("calculate");
  const [compareModelAId, setCompareModelAId] = useState(MODELS[0].id);
  const [compareModelBId, setCompareModelBId] = useState(SECONDARY_MODEL.id);
  const [isRunning, setIsRunning] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [liveOutput, setLiveOutput] = useState(
    "Run a request to see a real Bedrock response here.",
  );
  const [compareResults, setCompareResults] = useState<CompareResult[]>([
    {
      modelId: MODELS[0].id,
      modelName: MODELS[0].name,
      text: "Run Compare to view two live Bedrock responses side by side.",
      latencyMs: 0,
    },
    {
      modelId: SECONDARY_MODEL.id,
      modelName: SECONDARY_MODEL.name,
      text: "Run Compare to view two live Bedrock responses side by side.",
      latencyMs: 0,
    },
  ]);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult>({
    configured: false,
    blocked: false,
    action: "NOT_RUN",
    message: "Run Guardrails to apply a real Bedrock guardrail.",
  });
  const [toolResult, setToolResult] = useState<ToolResult>({
    modelId: MODELS[0].id,
    modelName: MODELS[0].name,
    usedTool: false,
    requestedTool: "calculate",
    tool: "none",
    input: "",
    output: "Run Tool use to trigger a tool call.",
    text: "Run Tool use to trigger a tool call.",
  });
  const [imageResult, setImageResult] = useState<ImageResult>({
    configured: false,
    blocked: false,
    prompt: "",
    imageDataUrl: "",
    message: "Run Image generation to create an image after guardrail check.",
  });
  const [agentResult, setAgentResult] = useState<AgentResult>({
    agentId: "",
    agentAliasId: "",
    sessionId: crypto.randomUUID(),
    text: "Run the Agent demo to see a real AWS Bedrock Agent response.",
    latencyMs: 0,
  });
  const [lastRun, setLastRun] = useState("Ready to run a Bedrock request.");
  const [error, setError] = useState("");
  const [health, setHealth] = useState("Checking backend status...");

  const selectedModel =
    MODELS.find((model) => model.id === selectedModelId) ?? MODELS[0];

  useEffect(() => {
    let mounted = true;

    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Backend is unavailable");
        }
        return (await response.json()) as HealthResponse;
      })
      .then((data) => {
        if (!mounted) return;
        if (!data.credentialsReady) {
          setHealth(
            `Backend is running in ${data.region}, but AWS credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY or use an IAM role.`,
          );
          return;
        }

        setGuardrailResult((prev) => {
          if (prev.action !== "NOT_RUN") {
            return prev;
          }

          if (data.guardrailConfigured) {
            const versionSuffix = data.guardrailVersion
              ? ` (${data.guardrailVersion})`
              : "";
            return {
              configured: true,
              blocked: false,
              action: "READY",
              message: `Guardrail is configured${versionSuffix}. Run Guardrails to test blocking.`,
            };
          }

          return {
            configured: false,
            blocked: false,
            action: "NOT_CONFIGURED",
            message: "Run Guardrails to apply a real Bedrock guardrail.",
          };
        });

        setHealth(
          data.guardrailConfigured
            ? `Backend ready in ${data.region} with guardrails enabled.`
            : `Backend ready in ${data.region}; guardrails are optional until configured.`,
        );

        if (data.budget) {
          setHealth(
            `${data.guardrailConfigured ? `Backend ready in ${data.region} with guardrails enabled.` : `Backend ready in ${data.region}; guardrails are optional until configured.`} Budget: ${data.budget.maxPromptChars} chars, ${data.budget.maxOutputTokens} max output tokens, ${data.budget.maxRequestsPerMinute} requests/min.`,
          );
        }
      })
      .catch(() => {
        if (!mounted) return;
        setHealth("Backend is offline. Run the local Bedrock server first.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function postJson<T>(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Request failed");
    }

    return payload as T;
  }

  async function runStreamDemo() {
    setStreamText("");
    setLiveOutput("");
    setLastRun(`Streaming from ${selectedModel.name}...`);

    const response = await fetch("/api/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        modelId: selectedModelId,
        tone,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(await response.text());
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalText = "";
    let doneSeen = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const dataLine = chunk
          .split("\n")
          .find((line) => line.startsWith("data: "));

        if (!dataLine) continue;

        const payload = JSON.parse(dataLine.slice(6)) as
          | { type: "delta"; text: string }
          | { type: "done"; text: string }
          | { type: "error"; message: string };

        if (payload.type === "delta") {
          finalText += payload.text;
          setStreamText(finalText);
          setLiveOutput(finalText);
        } else if (payload.type === "done") {
          doneSeen = true;
          finalText = payload.text || finalText;
          setStreamText(finalText);
          setLiveOutput(finalText);
        } else {
          throw new Error(payload.message);
        }
      }
    }

    if (!doneSeen && finalText) {
      setStreamText(finalText);
      setLiveOutput(finalText);
    }

    setLastRun(`Streaming completed from ${selectedModel.name}.`);
  }

  async function runDemo() {
    setIsRunning(true);
    setError("");

    try {
      if (mode === "generate" || mode === "guardrails") {
        const result = await postJson<{
          modelId: string;
          modelName: string;
          text: string;
          latencyMs: number;
        }>("/api/generate", {
          prompt,
          modelId: selectedModelId,
          tone,
        });

        setLiveOutput(result.text);
        setLastRun(
          `Generated with ${result.modelName} in ${result.latencyMs} ms.`,
        );
      } else if (mode === "stream") {
        await runStreamDemo();
      } else if (mode === "compare") {
        const result = await postJson<{ a: CompareResult; b: CompareResult }>(
          "/api/compare",
          {
            prompt: comparePrompt,
            modelAId: compareModelAId,
            modelBId: compareModelBId,
            tone,
          },
        );
        setCompareResults([result.a, result.b]);
        setLiveOutput(result.a.text);
        setLastRun(`Compared ${result.a.modelName} and ${result.b.modelName}.`);
      } else if (mode === "tools") {
        const effectiveToolPrompt = toolPrompt.trim() || DEFAULT_TOOL_PROMPT;
        const result = await postJson<ToolResult>("/api/tools", {
          prompt: effectiveToolPrompt,
          modelId: selectedModelId,
          tone,
          preferredTool: selectedTool,
        });

        setToolResult(result);
        setLiveOutput(result.text);
        setLastRun(
          result.usedTool
            ? `Bedrock used ${result.tool} and returned a final answer.`
            : "The model answered without requesting a tool call.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setLiveOutput(message);
      setLastRun("The request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runCompareDemo() {
    if (mode !== "compare") {
      setMode("compare");
    }

    setIsRunning(true);
    setError("");

    try {
      const effectiveComparePrompt = comparePrompt.trim() || DEFAULT_PROMPT;
      const result = await postJson<{ a: CompareResult; b: CompareResult }>(
        "/api/compare",
        {
          prompt: effectiveComparePrompt,
          modelAId: compareModelAId,
          modelBId: compareModelBId,
          tone,
        },
      );

      setCompareResults([result.a, result.b]);
      setLiveOutput(result.a.text);
      setLastRun(`Compared ${result.a.modelName} and ${result.b.modelName}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setLiveOutput(message);
      setLastRun("The compare request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runGuardrailDemo() {
    if (mode !== "guardrails") {
      setMode("guardrails");
    }

    setIsRunning(true);
    setError("");

    try {
      const effectiveGuardrailPrompt =
        guardrailPrompt.trim() || DEFAULT_GUARDRAIL_PROMPT;
      const result = await postJson<GuardrailResult>("/api/guardrails", {
        prompt: effectiveGuardrailPrompt,
      });

      setGuardrailResult(result);
      setLiveOutput(result.message);
      setLastRun(
        result.configured
          ? result.blocked
            ? "Bedrock Guardrail blocked the prompt."
            : "Bedrock Guardrail allowed the prompt."
          : "Guardrails are not configured yet.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setLiveOutput(message);
      setLastRun("The guardrail request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runToolDemo() {
    if (mode !== "tools") {
      setMode("tools");
    }

    setIsRunning(true);
    setError("");

    try {
      const effectiveToolPrompt = toolPrompt.trim() || DEFAULT_TOOL_PROMPT;
      const result = await postJson<ToolResult>("/api/tools", {
        prompt: effectiveToolPrompt,
        modelId: selectedModelId,
        tone,
        preferredTool: selectedTool,
      });

      setToolResult(result);
      setLiveOutput(result.text);
      setLastRun(
        result.usedTool
          ? `Bedrock used ${result.tool} and returned a final answer.`
          : "The model answered without requesting a tool call.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setLiveOutput(message);
      setLastRun("The tool request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runImageDemo() {
    if (mode !== "image") {
      setMode("image");
    }

    setIsRunning(true);
    setError("");

    try {
      const effectiveImagePrompt = imagePrompt.trim() || DEFAULT_IMAGE_PROMPT;
      const result = await postJson<ImageResult>("/api/image-generate", {
        prompt: effectiveImagePrompt,
      });

      setImageResult(result);
      setLiveOutput(result.message);
      setLastRun(
        result.blocked
          ? "Image request was blocked by guardrails."
          : "Image request completed.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setLiveOutput(message);
      setLastRun("The image request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runAgentDemo(promptOverride?: string) {
    if (mode !== "agent") {
      setMode("agent");
    }

    setIsRunning(true);
    setError("");

    try {
      const effectiveAgentPrompt =
        (promptOverride ?? agentPrompt).trim() || DEFAULT_AGENT_PROMPT;
      const result = await postJson<AgentResult>("/api/agent", {
        prompt: effectiveAgentPrompt,
        sessionId: agentResult.sessionId,
      });

      setAgentResult(result);
      setLiveOutput(result.text);
      setLastRun(`Agent responded in ${result.latencyMs} ms.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
      setLiveOutput(message);
      setLastRun("The agent request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  function resetDemo() {
    setPrompt(DEFAULT_PROMPT);
    setComparePrompt(DEFAULT_PROMPT);
    setGuardrailPrompt(DEFAULT_GUARDRAIL_PROMPT);
    setImagePrompt(DEFAULT_IMAGE_PROMPT);
    setToolPrompt(DEFAULT_TOOL_PROMPT);
    setAgentPrompt(DEFAULT_AGENT_PROMPT);
    setTone("detailed");
    setMode("generate");
    setSelectedTool("calculate");
    setSelectedModelId(MODELS[0].id);
    setCompareModelAId(MODELS[0].id);
    setCompareModelBId(SECONDARY_MODEL.id);
    setStreamText("");
    setLiveOutput("Run a request to see a real Bedrock response here.");
    setCompareResults([
      {
        modelId: MODELS[0].id,
        modelName: MODELS[0].name,
        text: "Run Compare to view two live Bedrock responses side by side.",
        latencyMs: 0,
      },
      {
        modelId: SECONDARY_MODEL.id,
        modelName: SECONDARY_MODEL.name,
        text: "Run Compare to view two live Bedrock responses side by side.",
        latencyMs: 0,
      },
    ]);
    setGuardrailResult({
      configured: false,
      blocked: false,
      action: "NOT_RUN",
      message: "Run Guardrails to apply a real Bedrock guardrail.",
    });
    setToolResult({
      modelId: MODELS[0].id,
      modelName: MODELS[0].name,
      usedTool: false,
      requestedTool: "calculate",
      tool: "none",
      input: "",
      output: "Run Tool use to trigger a tool call.",
      text: "Run Tool use to trigger a tool call.",
    });
    setImageResult({
      configured: false,
      blocked: false,
      prompt: "",
      imageDataUrl: "",
      message: "Run Image generation to create an image after guardrail check.",
    });
    setAgentResult({
      agentId: "",
      agentAliasId: "",
      sessionId: crypto.randomUUID(),
      text: "Run the Agent demo to see a real AWS Bedrock Agent response.",
      latencyMs: 0,
    });
    setLastRun("Reset to the default state.");
    setError("");
  }

  const runPrimaryLabel =
    mode === "stream"
      ? "Run Stream"
      : mode === "tools"
        ? "Run Tools"
        : mode === "compare"
          ? "Use Compare Card"
          : mode === "image"
            ? "Use Image Card"
            : mode === "agent"
              ? "Use Agent Card"
              : "Run Bedrock";

  return (
    <main className="demo-page">
      <motion.section
        className="hero-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}>
        <div className="hero-copy">
          <p className="eyebrow">AWS Bedrock demo</p>
          <h1>Real Bedrock features in the app</h1>
          <p className="lede">
            This UI calls a local backend that talks to AWS Bedrock for
            generation, streaming, model comparison, guardrails, and tool use.
          </p>

          <div className="pill-row">
            <span className="pill">Prompt input</span>
            <span className="pill">Streaming</span>
            <span className="pill">Guardrails</span>
            <span className="pill">Tool use</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <img src={heroImg} className="hero-image" alt="" />
          <div className="stat-card stat-top">
            <span>Mode</span>
            <strong>
              {DEMO_MODES.find((item) => item.id === mode)?.title ?? "Generate"}
            </strong>
          </div>
          <div className="stat-card stat-bottom">
            <span>Backend</span>
            <strong>{health.includes("offline") ? "Offline" : "Ready"}</strong>
          </div>
        </div>
      </motion.section>

      <section className="demo-shell">
        <div className="controls panel">
          <h2>Demo controls</h2>
          <p className="health-line">{health}</p>

          <div className="mode-grid">
            {DEMO_MODES.map((item) => {
              const ModeIcon = MODE_META[item.id].icon;

              return (
                <button
                  type="button"
                  key={item.id}
                  className={
                    item.id === mode ? "mode-card active" : "mode-card"
                  }
                  onClick={() => setMode(item.id)}>
                  <div className="mode-card-title">
                    <span className="mode-icon" aria-hidden="true">
                      <ModeIcon size={15} strokeWidth={2.3} />
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                  <span>{item.description}</span>
                </button>
              );
            })}
          </div>

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={resetDemo}>
              <RotateCcw size={15} className="cta-icon" aria-hidden="true" />
              Reset
            </button>
          </div>

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="error-line">
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="results-grid">
          {(mode === "generate" || mode === "stream") && (
            <motion.article
              className="result-card panel"
              whileHover={{ y: -2 }}
              transition={CARD_TRANSITION}>
              <div className="result-header">
                <div>
                  <h2 className="result-title">
                    <Activity size={17} aria-hidden="true" />
                    Live output
                  </h2>
                  <p>{lastRun}</p>
                </div>
                <div className="header-tags">
                  <span className="feature-tag">{selectedModel.name}</span>
                  <span
                    className={
                      isRunning
                        ? "status-chip running"
                        : error
                          ? "status-chip error"
                          : "status-chip ready"
                    }>
                    {isRunning ? "Running" : error ? "Error" : "Ready"}
                  </span>
                </div>
              </div>

              <pre className="output-box">
                {mode === "stream"
                  ? streamText || "Streaming will appear here..."
                  : liveOutput}
              </pre>

              <label className="field">
                <span>Prompt</span>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ask Bedrock something..."
                />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Model</span>
                  <select
                    value={selectedModelId}
                    onChange={(event) =>
                      setSelectedModelId(event.target.value)
                    }>
                    {MODELS.map((model) => (
                      <option value={model.id} key={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Tone</span>
                  <select
                    value={tone}
                    onChange={(event) =>
                      setTone(event.target.value as "concise" | "detailed")
                    }>
                    <option value="detailed">Detailed</option>
                    <option value="concise">Concise</option>
                  </select>
                </label>
              </div>

              <div className="tool-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={runDemo}
                  disabled={isRunning || health.includes("offline")}>
                  <Play size={15} className="cta-icon" aria-hidden="true" />
                  {isRunning ? "Running..." : runPrimaryLabel}
                </button>
              </div>
            </motion.article>
          )}

          {mode === "compare" && (
            <motion.article
              className="result-card panel"
              whileHover={{ y: -2 }}
              transition={CARD_TRANSITION}>
              <div className="result-header">
                <div>
                  <h2 className="result-title">
                    <Gauge size={17} aria-hidden="true" />
                    Model comparison
                  </h2>
                  <p>Both requests go to AWS Bedrock.</p>
                </div>
                <span className="status-chip neutral">
                  {compareResults.every((item) => item.latencyMs > 0)
                    ? "Compared"
                    : "Awaiting run"}
                </span>
              </div>

              <div className="comparison-grid">
                {compareResults.map((item, index) => (
                  <div
                    className="comparison-card"
                    key={`${item.modelId}-${index}`}>
                    <strong>
                      {item.modelName}
                      {item.latencyMs ? ` · ${item.latencyMs} ms` : ""}
                    </strong>
                    <pre>{item.text}</pre>
                  </div>
                ))}
              </div>

              <label className="field">
                <span>Compare prompt</span>
                <textarea
                  rows={4}
                  value={comparePrompt}
                  onChange={(event) => setComparePrompt(event.target.value)}
                  placeholder="Ask both models the same question..."
                />
              </label>

              <div className="field-row compare-selectors">
                <label className="field">
                  <span>Model A</span>
                  <select
                    value={compareModelAId}
                    onChange={(event) =>
                      setCompareModelAId(event.target.value)
                    }>
                    {MODELS.map((model) => (
                      <option value={model.id} key={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Model B</span>
                  <select
                    value={compareModelBId}
                    onChange={(event) =>
                      setCompareModelBId(event.target.value)
                    }>
                    {MODELS.map((model) => (
                      <option value={model.id} key={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Tone</span>
                  <select
                    value={tone}
                    onChange={(event) =>
                      setTone(event.target.value as "concise" | "detailed")
                    }>
                    <option value="detailed">Detailed</option>
                    <option value="concise">Concise</option>
                  </select>
                </label>
              </div>

              <div className="tool-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={runCompareDemo}
                  disabled={isRunning || health.includes("offline")}>
                  <Gauge size={15} className="cta-icon" aria-hidden="true" />
                  {isRunning && mode === "compare"
                    ? "Running compare..."
                    : "Run Compare"}
                </button>
              </div>
            </motion.article>
          )}

          {mode === "guardrails" && (
            <motion.article
              className="result-card panel"
              whileHover={{ y: -2 }}
              transition={CARD_TRANSITION}>
              <div className="result-header">
                <div>
                  <h2 className="result-title">
                    <ShieldCheck size={17} aria-hidden="true" />
                    Guardrails
                  </h2>
                  <p>
                    {guardrailResult.configured
                      ? guardrailResult.blocked
                        ? "The guardrail blocked this prompt."
                        : "The guardrail allowed this prompt."
                      : "Guardrails are not configured yet."}
                  </p>
                </div>
                <span
                  className={
                    guardrailResult.configured
                      ? guardrailResult.blocked
                        ? "status-chip error"
                        : "status-chip ready"
                      : "status-chip neutral"
                  }>
                  {guardrailResult.configured
                    ? guardrailResult.blocked
                      ? "Blocked"
                      : "Allowed"
                    : "Not configured"}
                </span>
              </div>

              <label className="field">
                <span>Guardrail prompt (separate input)</span>
                <textarea
                  rows={4}
                  value={guardrailPrompt}
                  onChange={(event) => setGuardrailPrompt(event.target.value)}
                  placeholder="Write a prompt to test guardrail blocking..."
                />
              </label>

              <div className="tool-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={runGuardrailDemo}
                  disabled={isRunning || health.includes("offline")}>
                  <ShieldCheck
                    size={15}
                    className="cta-icon"
                    aria-hidden="true"
                  />
                  {isRunning && mode === "guardrails"
                    ? "Running guardrail..."
                    : "Run Guardrail Prompt"}
                </button>
              </div>

              <div
                className={
                  guardrailResult.blocked
                    ? "guardrail-box blocked"
                    : "guardrail-box safe"
                }>
                <strong>
                  {guardrailResult.configured
                    ? guardrailResult.blocked
                      ? "Content blocked"
                      : "Content allowed"
                    : "Not configured"}
                </strong>
                <p>{guardrailResult.message}</p>
                {guardrailResult.actionReason ? (
                  <p>{guardrailResult.actionReason}</p>
                ) : null}
              </div>
            </motion.article>
          )}

          {mode === "tools" && (
            <motion.article
              className="result-card panel"
              whileHover={{ y: -2 }}
              transition={CARD_TRANSITION}>
              <div className="result-header">
                <div>
                  <h2 className="result-title">
                    <Wrench size={17} aria-hidden="true" />
                    Tool use
                  </h2>
                  <p>The model can call a tool and use the result.</p>
                </div>
                <span
                  className={
                    toolResult.usedTool
                      ? "status-chip ready"
                      : "status-chip neutral"
                  }>
                  {toolResult.usedTool
                    ? `Used ${toolResult.tool}`
                    : "No tool used"}
                </span>
              </div>

              <div className="tool-use-grid">
                <div className="tool-mode-box">
                  <label className="field tool-field">
                    <span>Tool to demo</span>
                    <select
                      value={selectedTool}
                      onChange={(event) =>
                        setSelectedTool(event.target.value as ToolName)
                      }>
                      {TOOL_OPTIONS.map((tool) => (
                        <option value={tool.id} key={tool.id}>
                          {tool.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field tool-field">
                    <span>Tool prompt (separate input)</span>
                    <textarea
                      rows={4}
                      value={toolPrompt}
                      onChange={(event) => setToolPrompt(event.target.value)}
                      placeholder="Write a prompt for the selected tool..."
                    />
                  </label>

                  <div className="tool-examples">
                    <span>Example prompts for selected tool</span>
                    <div className="example-buttons">
                      {TOOL_EXAMPLE_PROMPTS[selectedTool].map((example) => (
                        <button
                          key={example}
                          type="button"
                          className="example-button"
                          onClick={() => setToolPrompt(example)}>
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="tool-action-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={runToolDemo}
                      disabled={isRunning || health.includes("offline")}>
                      <Wrench
                        size={15}
                        className="cta-icon"
                        aria-hidden="true"
                      />
                      {isRunning && mode === "tools"
                        ? "Running tool..."
                        : "Run Tool Prompt"}
                    </button>
                  </div>
                </div>

                <div className="tool-box">
                  <div>
                    <span>Requested tool</span>
                    <strong>{toolResult.requestedTool ?? selectedTool}</strong>
                  </div>
                  <div>
                    <span>Tool</span>
                    <strong>{toolResult.tool}</strong>
                  </div>
                  <div>
                    <span>Input</span>
                    <strong>{toolResult.input || "—"}</strong>
                  </div>
                  <div>
                    <span>Output</span>
                    <strong>{toolResult.output}</strong>
                  </div>
                </div>
              </div>
            </motion.article>
          )}

          {mode === "image" && (
            <motion.article
              className="result-card panel"
              whileHover={{ y: -2 }}
              transition={CARD_TRANSITION}>
              <div className="result-header">
                <div>
                  <h2 className="result-title">
                    <ImageIcon size={17} aria-hidden="true" />
                    Image generation
                  </h2>
                  <p>This route is guardrail-protected before image output.</p>
                </div>
                <span
                  className={
                    imageResult.blocked
                      ? "status-chip error"
                      : imageResult.imageDataUrl
                        ? "status-chip ready"
                        : "status-chip neutral"
                  }>
                  {imageResult.blocked
                    ? "Blocked"
                    : imageResult.imageDataUrl
                      ? "Generated"
                      : "Awaiting run"}
                </span>
              </div>

              <label className="field">
                <span>Image prompt (separate input)</span>
                <textarea
                  rows={4}
                  value={imagePrompt}
                  onChange={(event) => setImagePrompt(event.target.value)}
                  placeholder="Describe the image you want..."
                />
              </label>

              <div className="tool-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={runImageDemo}
                  disabled={isRunning || health.includes("offline")}>
                  <ImageIcon
                    size={15}
                    className="cta-icon"
                    aria-hidden="true"
                  />
                  {isRunning ? "Generating image..." : "Run Image Prompt"}
                </button>
              </div>

              <div
                className={
                  imageResult.blocked
                    ? "guardrail-box blocked"
                    : "guardrail-box safe"
                }>
                <strong>
                  {imageResult.blocked
                    ? "Image blocked"
                    : imageResult.imageDataUrl
                      ? "Image generated"
                      : "Awaiting request"}
                </strong>
                <p>{imageResult.message}</p>
                {imageResult.prompt ? (
                  <p>Prompt: {imageResult.prompt}</p>
                ) : null}
                {imageResult.actionReason ? (
                  <p>{imageResult.actionReason}</p>
                ) : null}
              </div>

              {imageResult.imageDataUrl ? (
                <div className="image-preview-wrap">
                  <img
                    src={imageResult.imageDataUrl}
                    alt="Generated from image prompt"
                    className="image-preview"
                  />
                </div>
              ) : null}
            </motion.article>
          )}

          {mode === "agent" && (
            <motion.article
              className="result-card panel"
              whileHover={{ y: -2 }}
              transition={CARD_TRANSITION}>
              <div className="result-header">
                <div>
                  <h2 className="result-title">
                    <Bot size={17} aria-hidden="true" />
                    Agent
                  </h2>
                  <p>
                    This card sends prompts to your configured AWS Bedrock
                    Agent.
                  </p>
                </div>
                <span className="status-chip neutral">
                  {agentResult.latencyMs > 0
                    ? `${agentResult.latencyMs} ms`
                    : "Awaiting run"}
                </span>
              </div>

              <label className="field">
                <span>Agent prompt</span>
                <textarea
                  rows={4}
                  value={agentPrompt}
                  onChange={(event) => setAgentPrompt(event.target.value)}
                  placeholder="Ask the agent about a user balance or status..."
                />
              </label>

              <div className="tool-examples">
                <span>Selectable test prompts</span>
                <div className="example-buttons">
                  {AGENT_TEST_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="example-button"
                      onClick={() => {
                        setAgentPrompt(item.prompt);
                      }}>
                      <Sparkles
                        size={13}
                        className="cta-icon"
                        aria-hidden="true"
                      />
                      {item.label}: {item.prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tool-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => runAgentDemo()}
                  disabled={isRunning || health.includes("offline")}>
                  <Bot size={15} className="cta-icon" aria-hidden="true" />
                  {isRunning ? "Running agent..." : "Run Agent Prompt"}
                </button>
              </div>

              <div className="tool-box">
                <div>
                  <span>Agent ID</span>
                  <strong>
                    {agentResult.agentId || "Set BEDROCK_AGENT_ID"}
                  </strong>
                </div>
                <div>
                  <span>Agent alias</span>
                  <strong>
                    {agentResult.agentAliasId || "Set BEDROCK_AGENT_ALIAS_ID"}
                  </strong>
                </div>
                <div>
                  <span>Session</span>
                  <strong>{agentResult.sessionId}</strong>
                </div>
                <div>
                  <span>Response</span>
                  <strong>{agentResult.text}</strong>
                </div>
              </div>
            </motion.article>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
