import { motion } from "framer-motion";
import { Bot, Sparkles, Loader2 } from "lucide-react";
import type { AgentResult } from "../types";
import { CARD_TRANSITION, AGENT_TEST_PROMPTS } from "../types";

type AgentCardProps = {
  isRunning: boolean;
  health: string;
  agentResult: AgentResult;
  agentPrompt: string;
  setAgentPrompt: (val: string) => void;
  runAgentDemo: (promptOverride?: string) => void;
};

export function AgentCard({
  isRunning,
  health,
  agentResult,
  agentPrompt,
  setAgentPrompt,
  runAgentDemo,
}: AgentCardProps) {
  return (
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
          <p>This card sends prompts to your configured AWS Bedrock Agent.</p>
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
              <Sparkles size={13} className="cta-icon" aria-hidden="true" />
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
          {isRunning ? (
            <Loader2 size={15} className="cta-icon animate-spin" aria-hidden="true" />
          ) : (
            <Bot size={15} className="cta-icon" aria-hidden="true" />
          )}
          {isRunning ? "Running agent..." : "Run Agent Prompt"}
        </button>
      </div>

      <div className="tool-box">
        <div>
          <span>Agent ID</span>
          <strong>{agentResult.agentId || "Set BEDROCK_AGENT_ID"}</strong>
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
  );
}
