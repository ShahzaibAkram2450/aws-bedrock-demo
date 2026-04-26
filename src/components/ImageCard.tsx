import { motion } from "framer-motion";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import type { ImageResult } from "../types";
import { CARD_TRANSITION } from "../types";

type ImageCardProps = {
  isRunning: boolean;
  health: string;
  imageResult: ImageResult;
  imagePrompt: string;
  setImagePrompt: (val: string) => void;
  runImageDemo: () => void;
};

export function ImageCard({
  isRunning,
  health,
  imageResult,
  imagePrompt,
  setImagePrompt,
  runImageDemo,
}: ImageCardProps) {
  return (
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
          {isRunning ? (
            <Loader2 size={15} className="cta-icon animate-spin" aria-hidden="true" />
          ) : (
            <ImageIcon size={15} className="cta-icon" aria-hidden="true" />
          )}
          {isRunning ? "Generating image..." : "Run Image Prompt"}
        </button>
      </div>

      <div
        className={
          imageResult.blocked ? "guardrail-box blocked" : "guardrail-box safe"
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
        {imageResult.actionReason ? <p>{imageResult.actionReason}</p> : null}
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
  );
}
