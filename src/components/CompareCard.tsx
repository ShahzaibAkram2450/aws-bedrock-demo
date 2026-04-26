import { motion } from "framer-motion";
import { Gauge, Loader2 } from "lucide-react";
import type { CompareResult } from "../types";
import { CARD_TRANSITION, MODELS } from "../types";

type CompareCardProps = {
  isRunning: boolean;
  health: string;
  compareResults: CompareResult[];
  comparePrompt: string;
  setComparePrompt: (val: string) => void;
  compareModelAId: string;
  setCompareModelAId: (val: string) => void;
  compareModelBId: string;
  setCompareModelBId: (val: string) => void;
  tone: "concise" | "detailed";
  setTone: (val: "concise" | "detailed") => void;
  runCompareDemo: () => void;
};

export function CompareCard({
  isRunning,
  health,
  compareResults,
  comparePrompt,
  setComparePrompt,
  compareModelAId,
  setCompareModelAId,
  compareModelBId,
  setCompareModelBId,
  tone,
  setTone,
  runCompareDemo,
}: CompareCardProps) {
  return (
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
          <div className="comparison-card" key={`${item.modelId}-${index}`}>
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
          {isRunning ? (
            <Loader2 size={15} className="cta-icon animate-spin" aria-hidden="true" />
          ) : (
            <Gauge size={15} className="cta-icon" aria-hidden="true" />
          )}
          {isRunning ? "Running compare..." : "Run Compare"}
        </button>
      </div>
    </motion.article>
  );
}
