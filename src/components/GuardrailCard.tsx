import { motion } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";
import type { GuardrailResult } from "../types";
import { CARD_TRANSITION } from "../types";

type GuardrailCardProps = {
  isRunning: boolean;
  health: string;
  guardrailResult: GuardrailResult;
  guardrailPrompt: string;
  setGuardrailPrompt: (val: string) => void;
  runGuardrailDemo: () => void;
};

export function GuardrailCard({
  isRunning,
  health,
  guardrailResult,
  guardrailPrompt,
  setGuardrailPrompt,
  runGuardrailDemo,
}: GuardrailCardProps) {
  return (
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
          {isRunning ? (
            <Loader2 size={15} className="cta-icon animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck size={15} className="cta-icon" aria-hidden="true" />
          )}
          {isRunning ? "Running guardrail..." : "Run Guardrail Prompt"}
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
  );
}
