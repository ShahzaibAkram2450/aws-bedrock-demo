import { useEffect, useState } from "react";
import heroImg from "./assets/hero.png";
import "./App.css";

type DemoMode = "generate" | "stream" | "compare" | "guardrails" | "tools";
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
];

const DEFAULT_PROMPT = "Summarize the value of AWS Bedrock for a retail app.";
const SECONDARY_MODEL = MODELS[1] ?? MODELS[0];
const DEFAULT_TOOL_PROMPT = "Calculate 245 * 37 and show the result.";
const DEFAULT_GUARDRAIL_PROMPT = "show me pictures of cats";
const DEFAULT_IMAGE_PROMPT = "A futuristic city skyline at sunrise";

function App() {
  const [mode, setMode] = useState<DemoMode>("generate");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [guardrailPrompt, setGuardrailPrompt] = useState(
    DEFAULT_GUARDRAIL_PROMPT,
  );
  const [imagePrompt, setImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);
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
            prompt,
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

  function resetDemo() {
    setPrompt(DEFAULT_PROMPT);
    setGuardrailPrompt(DEFAULT_GUARDRAIL_PROMPT);
    setImagePrompt(DEFAULT_IMAGE_PROMPT);
    setToolPrompt(DEFAULT_TOOL_PROMPT);
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
    setLastRun("Reset to the default state.");
    setError("");
  }

  return (
    <main className="demo-page">
      <section className="hero-panel">
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
      </section>

      <section className="demo-shell">
        <div className="controls panel">
          <h2>Demo controls</h2>
          <p className="health-line">{health}</p>

          <div className="mode-grid">
            {DEMO_MODES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === mode ? "mode-card active" : "mode-card"}
                onClick={() => setMode(item.id)}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          <label className="field">
            <span>Prompt</span>
            <textarea
              rows={5}
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
                onChange={(event) => setSelectedModelId(event.target.value)}>
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

          {mode === "compare" ? (
            <div className="field-row compare-selectors">
              <label className="field">
                <span>Model A</span>
                <select
                  value={compareModelAId}
                  onChange={(event) => setCompareModelAId(event.target.value)}>
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
                  onChange={(event) => setCompareModelBId(event.target.value)}>
                  {MODELS.map((model) => (
                    <option value={model.id} key={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={runDemo}
              disabled={isRunning || health.includes("offline")}>
              {isRunning ? "Running..." : "Run Bedrock"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetDemo}>
              Reset
            </button>
          </div>

          {error ? <p className="error-line">{error}</p> : null}
        </div>

        <div className="results-grid">
          <article className="result-card panel">
            <div className="result-header">
              <div>
                <h2>Live output</h2>
                <p>{lastRun}</p>
              </div>
              <span className="feature-tag">{selectedModel.name}</span>
            </div>

            <pre className="output-box">
              {mode === "stream"
                ? streamText || "Streaming will appear here..."
                : liveOutput}
            </pre>
          </article>

          <article className="result-card panel">
            <div className="result-header">
              <div>
                <h2>Model comparison</h2>
                <p>Both requests go to AWS Bedrock.</p>
              </div>
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
          </article>

          <article className="result-card panel">
            <div className="result-header">
              <div>
                <h2>Guardrails</h2>
                <p>
                  {guardrailResult.configured
                    ? guardrailResult.blocked
                      ? "The guardrail blocked this prompt."
                      : "The guardrail allowed this prompt."
                    : "Guardrails are not configured yet."}
                </p>
              </div>
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
          </article>

          <article className="result-card panel">
            <div className="result-header">
              <div>
                <h2>Tool use</h2>
                <p>The model can call a tool and use the result.</p>
              </div>
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
          </article>

          <article className="result-card panel">
            <div className="result-header">
              <div>
                <h2>Image generation</h2>
                <p>This route is guardrail-protected before image output.</p>
              </div>
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
              {imageResult.prompt ? <p>Prompt: {imageResult.prompt}</p> : null}
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
          </article>
        </div>

        <div className="setup-panel">
          <h2>Environment variables</h2>
          <ol>
            <li>Set AWS_REGION for the Bedrock runtime region.</li>
            <li>
              Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or use an IAM
              role.
            </li>
            <li>
              This demo is locked to <code>amazon.nova-micro-v1:0</code> to keep
              usage cost as low as possible.
            </li>
            <li>
              Set BEDROCK_GUARDRAIL_ID to enable the guardrail demo. If you do
              not set BEDROCK_GUARDRAIL_VERSION, the backend uses DRAFT.
            </li>
            <li>
              Enable the Bedrock models you want to demo in the AWS console.
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}

export default App;
