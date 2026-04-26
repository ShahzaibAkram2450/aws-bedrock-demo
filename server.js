import "dotenv/config";
import http from "node:http";
import { performance } from "node:perf_hooks";
import {
  ApplyGuardrailCommand,
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const PORT = Number(process.env.PORT || 8787);
const REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID || "";
const GUARDRAIL_VERSION =
  process.env.BEDROCK_GUARDRAIL_VERSION || (GUARDRAIL_ID ? "DRAFT" : "");
const MAX_PROMPT_CHARS = Number(process.env.BUDGET_MAX_PROMPT_CHARS || 1200);
const MAX_OUTPUT_TOKENS = Number(process.env.BUDGET_MAX_OUTPUT_TOKENS || 220);
const MAX_REQUESTS_PER_MINUTE = Number(
  process.env.BUDGET_MAX_REQUESTS_PER_MINUTE || 30,
);
const IMAGE_MODEL_ID_CANDIDATES = (
  process.env.BEDROCK_IMAGE_MODEL_ID_CANDIDATES ||
  process.env.BEDROCK_IMAGE_MODEL_ID ||
  "amazon.nova-canvas-v1:0,amazon.titan-image-generator-v2:0,amazon.titan-image-generator-v1"
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const ALLOWED_MODEL_IDS = new Set(["amazon.nova-micro-v1:0"]);
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestBuckets = new Map();

const client = new BedrockRuntimeClient({ region: REGION });

const MODEL_LABELS = new Map([["amazon.nova-micro-v1:0", "Nova Micro"]]);
const TOOL_DEFINITIONS = {
  getWeather: {
    toolSpec: {
      name: "getWeather",
      description: "Get weather for a city or region.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
      },
    },
  },
  calculate: {
    toolSpec: {
      name: "calculate",
      description: "Perform a simple math calculation.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["add", "subtract", "multiply", "divide"],
            },
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["operation", "a", "b"],
        },
      },
    },
  },
  knowledgeLookup: {
    toolSpec: {
      name: "knowledgeLookup",
      description: "Look up a short Bedrock demo summary.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
    },
  },
};
const SUPPORTED_TOOLS = Object.keys(TOOL_DEFINITIONS);

function isAllowedModel(modelId) {
  return ALLOWED_MODEL_IDS.has(modelId);
}

function modelName(modelId) {
  return MODEL_LABELS.get(modelId) ?? modelId;
}

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  jsonResponse(res, 404, { message: "Not found" });
}

function badRequest(res, message) {
  jsonResponse(res, 400, { message });
}

function rateLimited(res, retryAfterSeconds) {
  res.writeHead(429, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Retry-After": String(retryAfterSeconds),
  });
  res.end(
    JSON.stringify({
      message: `Request budget exceeded. Try again in ${retryAfterSeconds}s.`,
      error: "RateLimitExceeded",
    }),
  );
}

function getPromptBudgetError(prompt) {
  const text = String(prompt || "");
  if (text.length === 0) {
    return "prompt is required";
  }
  if (text.length > MAX_PROMPT_CHARS) {
    return `Prompt exceeds budget limit (${MAX_PROMPT_CHARS} characters).`;
  }
  return "";
}

function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(req) {
  const now = Date.now();
  const ip = getRequestIp(req);
  const bucket = requestBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(ip, { windowStart: now, count: 1 });
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_REQUESTS_PER_MINUTE) {
    const msLeft = RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(msLeft / 1000)),
    };
  }

  bucket.count += 1;
  requestBuckets.set(ip, bucket);
  return { limited: false, retryAfterSeconds: 0 };
}

function getAwsErrorMessage(error) {
  const name = error?.name || error?.code || "BedrockError";

  if (name === "CredentialsProviderError" || name === "NoCredentialsError") {
    return "AWS credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or use an IAM role.";
  }

  if (
    name === "AccessDeniedException" ||
    name === "UnrecognizedClientException"
  ) {
    return "AWS rejected the request. Check IAM permissions and that the credentials are valid.";
  }

  if (name === "ValidationException") {
    return "Bedrock rejected the request. Confirm the model ID is enabled in this region and your account has access.";
  }

  if (name === "ResourceNotFoundException") {
    return "The requested Bedrock resource was not found. Check the model ID, guardrail ID, and region.";
  }

  if (name === "ModelNotReadyException") {
    return "The Bedrock model is not ready yet. Try again in a moment.";
  }

  if (name === "ThrottlingException") {
    return "Bedrock is throttling requests. Try again shortly.";
  }

  return error?.message || "The Bedrock request failed.";
}

function getAwsErrorStatus(error) {
  const name = error?.name || error?.code;

  if (name === "CredentialsProviderError" || name === "NoCredentialsError") {
    return 503;
  }

  if (
    name === "AccessDeniedException" ||
    name === "UnrecognizedClientException"
  ) {
    return 403;
  }

  if (name === "ValidationException" || name === "ResourceNotFoundException") {
    return 400;
  }

  if (name === "ModelNotReadyException" || name === "ThrottlingException") {
    return 503;
  }

  return 500;
}

async function hasCredentials() {
  try {
    await client.config.credentials();
    return true;
  } catch {
    return false;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function systemPrompt(tone) {
  return tone === "concise"
    ? "Answer in a short, direct format with no more than three bullets."
    : "Answer clearly and helpfully with enough detail for a product demo.";
}

function toolSystemPrompt() {
  return [
    "You are demonstrating Bedrock tool use.",
    "Use a tool when the user asks about weather, calculations, or data lookup.",
    "Do not answer directly if a tool is relevant.",
  ].join(" ");
}

function extractText(contentBlocks = []) {
  return contentBlocks
    .map((block) => {
      if (block?.text) return block.text;
      if (block?.toolUse) return "";
      if (block?.reasoningContent?.text) return block.reasoningContent.text;
      return "";
    })
    .filter(Boolean)
    .join("")
    .trim();
}

function runTool(name, input = {}) {
  if (name === "getWeather") {
    const location = String(input.location || "Seattle, WA");
    return {
      location,
      temperature: "72°F",
      conditions: "clear skies",
      summary: `${location}: 72°F and clear skies`,
    };
  }

  if (name === "calculate") {
    const a = Number(input.a ?? 0);
    const b = Number(input.b ?? 0);
    const operation = String(input.operation || "add");
    let result = a + b;

    if (operation === "subtract") result = a - b;
    if (operation === "multiply") result = a * b;
    if (operation === "divide") result = b === 0 ? Number.NaN : a / b;

    return {
      operation,
      a,
      b,
      result,
    };
  }

  return {
    query: String(input.query || "bedrock feature summary"),
    answer: "Found a relevant summary from the demo helper.",
  };
}

async function invokeImageGeneration(prompt) {
  const start = performance.now();
  const requestBody = {
    taskType: "TEXT_IMAGE",
    textToImageParams: {
      text: String(prompt),
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      width: 1024,
      height: 1024,
      quality: "standard",
      cfgScale: 8,
    },
  };

  let lastError = null;

  for (const modelId of IMAGE_MODEL_ID_CANDIDATES) {
    try {
      const response = await client.send(
        new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(requestBody),
        }),
      );

      const rawBody = Buffer.from(response.body).toString("utf8");
      const payload = JSON.parse(rawBody);
      const imageBase64 =
        (Array.isArray(payload?.images) ? payload.images[0] : "") ||
        (Array.isArray(payload?.artifacts) ? payload.artifacts[0]?.base64 : "");

      if (!imageBase64) {
        throw new Error(
          `Bedrock image model ${modelId} returned no image data.`,
        );
      }

      return {
        modelId,
        imageDataUrl: `data:image/png;base64,${imageBase64}`,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      const name = error?.name || error?.code;
      const canTryNext =
        (name === "ResourceNotFoundException" ||
          name === "ValidationException") &&
        modelId !==
          IMAGE_MODEL_ID_CANDIDATES[IMAGE_MODEL_ID_CANDIDATES.length - 1];

      if (canTryNext) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  const candidateList = IMAGE_MODEL_ID_CANDIDATES.join(", ");
  const notFoundError = new Error(
    `No image model worked in region ${REGION}. Checked: ${candidateList}. Enable model access in Bedrock or set BEDROCK_IMAGE_MODEL_ID_CANDIDATES.`,
  );
  notFoundError.name = lastError?.name || "ResourceNotFoundException";
  throw notFoundError;
}

async function invokeText(modelId, prompt, tone) {
  const start = performance.now();

  const response = await client.send(
    new ConverseCommand({
      modelId,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      system: [{ text: systemPrompt(tone) }],
      inferenceConfig: {
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: tone === "concise" ? 0.3 : 0.7,
        topP: 0.9,
      },
    }),
  );

  const text = extractText(response?.output?.message?.content ?? []);

  return {
    modelId,
    modelName: modelName(modelId),
    text: text || "No text returned from the model.",
    latencyMs: Math.round(performance.now() - start),
    usage: response?.usage ?? null,
  };
}

async function invokeCompare(prompt, modelAId, modelBId, tone) {
  const [a, b] = await Promise.all([
    invokeText(modelAId, prompt, tone),
    invokeText(modelBId, prompt, tone),
  ]);

  return { a, b };
}

async function invokeGuardrail(prompt) {
  if (!GUARDRAIL_ID || !GUARDRAIL_VERSION) {
    return {
      configured: false,
      blocked: false,
      action: "NOT_CONFIGURED",
      message:
        "Set BEDROCK_GUARDRAIL_ID and BEDROCK_GUARDRAIL_VERSION to enable the real Bedrock guardrail check.",
    };
  }

  const start = performance.now();
  const response = await client.send(
    new ApplyGuardrailCommand({
      guardrailIdentifier: GUARDRAIL_ID,
      guardrailVersion: GUARDRAIL_VERSION,
      source: "INPUT",
      content: [{ text: { text: prompt } }],
      outputScope: "FULL",
    }),
  );

  const blocked = response.action === "GUARDRAIL_INTERVENED";

  return {
    configured: true,
    blocked,
    action: response.action ?? "NONE",
    actionReason: response.actionReason ?? "",
    message: blocked
      ? "Bedrock Guardrail intervened and blocked the prompt."
      : "Bedrock Guardrail allowed the prompt.",
    latencyMs: Math.round(performance.now() - start),
    usage: response.usage ?? null,
    trace: response,
  };
}

async function invokeToolUse(modelId, prompt, tone, preferredTool) {
  const tools =
    preferredTool && TOOL_DEFINITIONS[preferredTool]
      ? [TOOL_DEFINITIONS[preferredTool]]
      : Object.values(TOOL_DEFINITIONS);

  const baseInput = {
    modelId,
    messages: [{ role: "user", content: [{ text: prompt }] }],
    system: [{ text: `${systemPrompt(tone)} ${toolSystemPrompt()}` }],
    inferenceConfig: {
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      topP: 0.9,
    },
    toolConfig: {
      tools,
    },
  };

  const firstResponse = await client.send(new ConverseCommand(baseInput));
  const firstBlocks = firstResponse?.output?.message?.content ?? [];
  const toolUseBlock = firstBlocks.find((block) => block.toolUse?.name);

  if (!toolUseBlock?.toolUse) {
    return {
      modelId,
      modelName: modelName(modelId),
      usedTool: false,
      requestedTool: preferredTool || "auto",
      tool: "none",
      input: "",
      output: "The model answered without requesting a tool.",
      text: extractText(firstBlocks) || "No text returned from the model.",
    };
  }

  const toolUse = toolUseBlock.toolUse;
  const toolOutput = runTool(toolUse.name, toolUse.input);

  const secondResponse = await client.send(
    new ConverseCommand({
      ...baseInput,
      messages: [
        { role: "user", content: [{ text: prompt }] },
        { role: "assistant", content: firstBlocks },
        {
          role: "user",
          content: [
            {
              toolResult: {
                toolUseId: toolUse.toolUseId,
                content: [{ json: toolOutput }],
              },
            },
          ],
        },
      ],
    }),
  );

  return {
    modelId,
    modelName: modelName(modelId),
    usedTool: true,
    requestedTool: preferredTool || "auto",
    tool: toolUse.name,
    input: JSON.stringify(toolUse.input),
    output: JSON.stringify(toolOutput),
    text:
      extractText(secondResponse?.output?.message?.content ?? []) ||
      "Tool call completed but no text was returned.",
  };
}

async function streamTextResponse(req, res, body) {
  const { prompt, modelId, tone } = body;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const response = await client.send(
      new ConverseStreamCommand({
        modelId,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        system: [{ text: systemPrompt(tone) }],
        inferenceConfig: {
          maxTokens: MAX_OUTPUT_TOKENS,
          temperature: tone === "concise" ? 0.3 : 0.7,
          topP: 0.9,
        },
      }),
    );

    let finalText = "";

    for await (const event of response.stream ?? []) {
      const deltaText = event?.contentBlockDelta?.delta?.text;
      if (deltaText) {
        finalText += deltaText;
        sendEvent({ type: "delta", text: deltaText });
      }
    }

    sendEvent({ type: "done", text: finalText });
  } catch (error) {
    sendEvent({
      type: "error",
      message: error?.message || "Streaming failed.",
    });
  } finally {
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  if (req.method === "POST" && pathname.startsWith("/api/")) {
    const limit = checkRateLimit(req);
    if (limit.limited) {
      rateLimited(res, limit.retryAfterSeconds);
      return;
    }
  }

  if (req.method === "GET" && pathname === "/api/health") {
    const credentialsReady = await hasCredentials();
    jsonResponse(res, 200, {
      ok: true,
      region: REGION,
      guardrailConfigured: Boolean(GUARDRAIL_ID),
      guardrailVersion: GUARDRAIL_ID ? GUARDRAIL_VERSION : "",
      credentialsReady,
      budget: {
        maxPromptChars: MAX_PROMPT_CHARS,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
      },
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/generate") {
    try {
      const body = await readJson(req);
      if (!body.prompt || !body.modelId) {
        badRequest(res, "prompt and modelId are required");
        return;
      }
      const promptError = getPromptBudgetError(body.prompt);
      if (promptError) {
        badRequest(res, promptError);
        return;
      }
      if (!isAllowedModel(body.modelId)) {
        badRequest(
          res,
          "This demo is restricted to amazon.nova-micro-v1:0 to minimize cost.",
        );
        return;
      }

      const result = await invokeText(
        body.modelId,
        body.prompt,
        body.tone || "detailed",
      );
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, getAwsErrorStatus(error), {
        message: getAwsErrorMessage(error),
        error: error?.name || error?.code || "BedrockError",
      });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/compare") {
    try {
      const body = await readJson(req);
      if (!body.prompt || !body.modelAId || !body.modelBId) {
        badRequest(res, "prompt, modelAId, and modelBId are required");
        return;
      }
      const promptError = getPromptBudgetError(body.prompt);
      if (promptError) {
        badRequest(res, promptError);
        return;
      }
      if (!isAllowedModel(body.modelAId) || !isAllowedModel(body.modelBId)) {
        badRequest(
          res,
          "This demo is restricted to amazon.nova-micro-v1:0 to minimize cost.",
        );
        return;
      }

      const result = await invokeCompare(
        body.prompt,
        body.modelAId,
        body.modelBId,
        body.tone || "detailed",
      );
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, getAwsErrorStatus(error), {
        message: getAwsErrorMessage(error),
        error: error?.name || error?.code || "BedrockError",
      });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/guardrails") {
    try {
      const body = await readJson(req);
      if (!body.prompt) {
        badRequest(res, "prompt is required");
        return;
      }
      const promptError = getPromptBudgetError(body.prompt);
      if (promptError) {
        badRequest(res, promptError);
        return;
      }

      const result = await invokeGuardrail(body.prompt);
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, getAwsErrorStatus(error), {
        message: getAwsErrorMessage(error),
        error: error?.name || error?.code || "BedrockError",
      });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/image-generate") {
    let requestedPrompt = "";
    try {
      const body = await readJson(req);
      if (!body.prompt) {
        badRequest(res, "prompt is required");
        return;
      }
      requestedPrompt = String(body.prompt);

      const promptError = getPromptBudgetError(body.prompt);
      if (promptError) {
        badRequest(res, promptError);
        return;
      }

      const guardrail = await invokeGuardrail(body.prompt);

      if (!guardrail.configured) {
        jsonResponse(res, 200, {
          configured: false,
          blocked: false,
          prompt: body.prompt,
          imageDataUrl: "",
          message:
            "Guardrails are not configured. Set BEDROCK_GUARDRAIL_ID to use image generation safely.",
        });
        return;
      }

      if (guardrail.blocked) {
        jsonResponse(res, 200, {
          configured: true,
          blocked: true,
          prompt: body.prompt,
          imageDataUrl: "",
          message: guardrail.message,
          action: guardrail.action,
          actionReason: guardrail.actionReason,
        });
        return;
      }

      const image = await invokeImageGeneration(body.prompt);

      jsonResponse(res, 200, {
        configured: true,
        blocked: false,
        prompt: body.prompt,
        imageDataUrl: image.imageDataUrl,
        modelId: image.modelId,
        latencyMs: image.latencyMs,
        message: "Image generated by Bedrock after guardrail check.",
        action: guardrail.action,
      });
    } catch (error) {
      const name = error?.name || error?.code || "BedrockError";
      if (
        name === "ResourceNotFoundException" ||
        name === "ValidationException" ||
        name === "AccessDeniedException"
      ) {
        jsonResponse(res, 200, {
          configured: Boolean(GUARDRAIL_ID),
          blocked: false,
          prompt: requestedPrompt,
          imageDataUrl: "",
          message:
            "No Bedrock image model is available for this account/region yet. Enable an image model in Bedrock Model access, or set BEDROCK_IMAGE_MODEL_ID_CANDIDATES to models you have access to.",
          error: name,
        });
        return;
      }

      jsonResponse(res, getAwsErrorStatus(error), {
        message: getAwsErrorMessage(error),
        error: name,
      });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/tools") {
    try {
      const body = await readJson(req);
      if (!body.prompt || !body.modelId) {
        badRequest(res, "prompt and modelId are required");
        return;
      }
      if (body.preferredTool && !SUPPORTED_TOOLS.includes(body.preferredTool)) {
        badRequest(
          res,
          `preferredTool must be one of: ${SUPPORTED_TOOLS.join(", ")}`,
        );
        return;
      }
      const promptError = getPromptBudgetError(body.prompt);
      if (promptError) {
        badRequest(res, promptError);
        return;
      }
      if (!isAllowedModel(body.modelId)) {
        badRequest(
          res,
          "This demo is restricted to amazon.nova-micro-v1:0 to minimize cost.",
        );
        return;
      }

      const result = await invokeToolUse(
        body.modelId,
        body.prompt,
        body.tone || "detailed",
        body.preferredTool,
      );
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, getAwsErrorStatus(error), {
        message: getAwsErrorMessage(error),
        error: error?.name || error?.code || "BedrockError",
      });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/stream") {
    try {
      const body = await readJson(req);
      if (!body.prompt || !body.modelId) {
        badRequest(res, "prompt and modelId are required");
        return;
      }
      const promptError = getPromptBudgetError(body.prompt);
      if (promptError) {
        badRequest(res, promptError);
        return;
      }
      if (!isAllowedModel(body.modelId)) {
        badRequest(
          res,
          "This demo is restricted to amazon.nova-micro-v1:0 to minimize cost.",
        );
        return;
      }

      await streamTextResponse(req, res, body);
    } catch (error) {
      jsonResponse(res, getAwsErrorStatus(error), {
        message: getAwsErrorMessage(error),
        error: error?.name || error?.code || "BedrockError",
      });
    }
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`Bedrock demo backend listening on http://localhost:${PORT}`);
  console.log(`AWS region: ${REGION}`);
  if (GUARDRAIL_ID && GUARDRAIL_VERSION) {
    console.log("Guardrail checks: enabled");
  } else {
    console.log(
      "Guardrail checks: disabled until BEDROCK_GUARDRAIL_ID and BEDROCK_GUARDRAIL_VERSION are set",
    );
  }
});
