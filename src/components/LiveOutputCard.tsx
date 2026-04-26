import { motion } from "framer-motion";
import { Activity, Play, Loader2 } from "lucide-react";
import { CARD_TRANSITION, MODELS } from "../types";

type LiveOutputCardProps = {
  isRunning: boolean;
  health: string;
  lastRun: string;
  selectedModelName: string;
  error: string;
  mode: "generate" | "stream";
  streamText: string;
  liveOutput: string;
  prompt: string;
  setPrompt: (val: string) => void;
  selectedModelId: string;
  setSelectedModelId: (val: string) => void;
  tone: "concise" | "detailed";
  setTone: (val: "concise" | "detailed") => void;
  runDemo: () => void;
  runPrimaryLabel: string;
};

export function LiveOutputCard({
  isRunning,
  health,
  lastRun,
  selectedModelName,
  error,
  mode,
  streamText,
  liveOutput,
  prompt,
  setPrompt,
  selectedModelId,
  setSelectedModelId,
  tone,
  setTone,
  runDemo,
  runPrimaryLabel,
}: LiveOutputCardProps) {
  return (
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
          <span className="feature-tag">{selectedModelName}</span>
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

      <div className="tool-action-row">
        <button
          type="button"
          className="primary-button"
          onClick={runDemo}
          disabled={isRunning || health.includes("offline")}>
          {isRunning ? (
            <Loader2 size={15} className="cta-icon animate-spin" aria-hidden="true" />
          ) : (
            <Play size={15} className="cta-icon" aria-hidden="true" />
          )}
          {isRunning ? "Running..." : runPrimaryLabel}
        </button>
      </div>
    </motion.article>
  );
}
