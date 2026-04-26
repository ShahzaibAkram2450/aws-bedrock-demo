import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import heroImg from "./assets/hero.png";
import "./App.css";

import type {
  DemoMode,
  ToolName,
  HealthResponse,
  CompareResult,
  GuardrailResult,
  ToolResult,
  AgentResult,
  ImageResult,
} from "./types";

import {
  MODELS,
  DEMO_MODES,
  MODE_META,
  DEFAULT_PROMPT,
  SECONDARY_MODEL,
  DEFAULT_TOOL_PROMPT,
  DEFAULT_GUARDRAIL_PROMPT,
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_AGENT_PROMPT,
} from "./types";

import { LiveOutputCard } from "./components/LiveOutputCard";
import { CompareCard } from "./components/CompareCard";
import { GuardrailCard } from "./components/GuardrailCard";
import { ToolUseCard } from "./components/ToolUseCard";
import { ImageCard } from "./components/ImageCard";
import { AgentCard } from "./components/AgentCard";

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
            <LiveOutputCard
              isRunning={isRunning}
              health={health}
              lastRun={lastRun}
              selectedModelName={selectedModel.name}
              error={error}
              mode={mode}
              streamText={streamText}
              liveOutput={liveOutput}
              prompt={prompt}
              setPrompt={setPrompt}
              selectedModelId={selectedModelId}
              setSelectedModelId={setSelectedModelId}
              tone={tone}
              setTone={setTone}
              runDemo={runDemo}
              runPrimaryLabel={runPrimaryLabel}
            />
          )}

          {mode === "compare" && (
            <CompareCard
              isRunning={isRunning}
              health={health}
              compareResults={compareResults}
              comparePrompt={comparePrompt}
              setComparePrompt={setComparePrompt}
              compareModelAId={compareModelAId}
              setCompareModelAId={setCompareModelAId}
              compareModelBId={compareModelBId}
              setCompareModelBId={setCompareModelBId}
              tone={tone}
              setTone={setTone}
              runCompareDemo={runCompareDemo}
            />
          )}

          {mode === "guardrails" && (
            <GuardrailCard
              isRunning={isRunning}
              health={health}
              guardrailResult={guardrailResult}
              guardrailPrompt={guardrailPrompt}
              setGuardrailPrompt={setGuardrailPrompt}
              runGuardrailDemo={runGuardrailDemo}
            />
          )}

          {mode === "tools" && (
            <ToolUseCard
              isRunning={isRunning}
              health={health}
              toolResult={toolResult}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              toolPrompt={toolPrompt}
              setToolPrompt={setToolPrompt}
              runToolDemo={runToolDemo}
            />
          )}

          {mode === "image" && (
            <ImageCard
              isRunning={isRunning}
              health={health}
              imageResult={imageResult}
              imagePrompt={imagePrompt}
              setImagePrompt={setImagePrompt}
              runImageDemo={runImageDemo}
            />
          )}

          {mode === "agent" && (
            <AgentCard
              isRunning={isRunning}
              health={health}
              agentResult={agentResult}
              agentPrompt={agentPrompt}
              setAgentPrompt={setAgentPrompt}
              runAgentDemo={runAgentDemo}
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
