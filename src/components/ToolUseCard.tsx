import { motion } from "framer-motion";
import { Wrench, Loader2 } from "lucide-react";
import type { ToolResult, ToolName } from "../types";
import {
  CARD_TRANSITION,
  TOOL_OPTIONS,
  TOOL_EXAMPLE_PROMPTS,
} from "../types";

type ToolUseCardProps = {
  isRunning: boolean;
  health: string;
  toolResult: ToolResult;
  selectedTool: ToolName;
  setSelectedTool: (val: ToolName) => void;
  toolPrompt: string;
  setToolPrompt: (val: string) => void;
  runToolDemo: () => void;
};

export function ToolUseCard({
  isRunning,
  health,
  toolResult,
  selectedTool,
  setSelectedTool,
  toolPrompt,
  setToolPrompt,
  runToolDemo,
}: ToolUseCardProps) {
  return (
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
            toolResult.usedTool ? "status-chip ready" : "status-chip neutral"
          }>
          {toolResult.usedTool ? `Used ${toolResult.tool}` : "No tool used"}
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
              {isRunning ? (
                <Loader2 size={15} className="cta-icon animate-spin" aria-hidden="true" />
              ) : (
                <Wrench size={15} className="cta-icon" aria-hidden="true" />
              )}
              {isRunning ? "Running tool..." : "Run Tool Prompt"}
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
  );
}
