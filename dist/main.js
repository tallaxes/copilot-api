#!/usr/bin/env node

// src/main.ts
import { defineCommand as defineCommand3, runMain } from "citty";

// src/auth.ts
import { defineCommand } from "citty";
import consola5 from "consola";

// src/lib/paths.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
var APP_DIR = path.join(os.homedir(), ".local", "share", "copilot-api");
var GITHUB_TOKEN_PATH = path.join(APP_DIR, "github_token");
var PATHS = {
  APP_DIR,
  GITHUB_TOKEN_PATH
};
async function ensurePaths() {
  await fs.mkdir(PATHS.APP_DIR, { recursive: true });
  await ensureFile(PATHS.GITHUB_TOKEN_PATH);
}
async function ensureFile(filePath) {
  try {
    await fs.access(filePath, fs.constants.W_OK);
  } catch {
    await fs.writeFile(filePath, "");
    await fs.chmod(filePath, 384);
  }
}

// src/lib/state.ts
var state = {
  accountType: "individual",
  manualApprove: false,
  rateLimitWait: false,
  showToken: false
};

// src/lib/token.ts
import consola4 from "consola";
import fs2 from "node:fs/promises";

// src/lib/api-config.ts
import { randomUUID } from "node:crypto";
var standardHeaders = () => ({
  "content-type": "application/json",
  accept: "application/json"
});
var COPILOT_VERSION = "0.26.7";
var EDITOR_PLUGIN_VERSION = `copilot-chat/${COPILOT_VERSION}`;
var USER_AGENT = `GitHubCopilotChat/${COPILOT_VERSION}`;
var API_VERSION = "2025-04-01";
var copilotBaseUrl = (state2) => state2.accountType === "individual" ? "https://api.githubcopilot.com" : `https://api.${state2.accountType}.githubcopilot.com`;
var copilotHeaders = (state2, vision = false) => {
  const headers = {
    Authorization: `Bearer ${state2.copilotToken}`,
    "content-type": standardHeaders()["content-type"],
    "copilot-integration-id": "vscode-chat",
    "editor-version": `vscode/${state2.vsCodeVersion}`,
    "editor-plugin-version": EDITOR_PLUGIN_VERSION,
    "user-agent": USER_AGENT,
    "openai-intent": "conversation-panel",
    "x-github-api-version": API_VERSION,
    "x-request-id": randomUUID(),
    "x-vscode-user-agent-library-version": "electron-fetch"
  };
  if (vision) headers["copilot-vision-request"] = "true";
  return headers;
};
var GITHUB_API_BASE_URL = "https://api.github.com";
var githubHeaders = (state2) => ({
  ...standardHeaders(),
  authorization: `token ${state2.githubToken}`,
  "editor-version": `vscode/${state2.vsCodeVersion}`,
  "editor-plugin-version": EDITOR_PLUGIN_VERSION,
  "user-agent": USER_AGENT,
  "x-github-api-version": API_VERSION,
  "x-vscode-user-agent-library-version": "electron-fetch"
});
var GITHUB_BASE_URL = "https://github.com";
var GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
var GITHUB_APP_SCOPES = ["read:user"].join(" ");

// src/lib/error.ts
import consola from "consola";
var HTTPError = class extends Error {
  response;
  constructor(message, response) {
    super(message);
    this.response = response;
  }
};
async function forwardError(c, error) {
  consola.error("Error occurred:", error);
  if (error instanceof HTTPError) {
    const cloned = error.response.clone();
    let errorText;
    let errorJson;
    try {
      errorJson = await cloned.json();
      consola.error("HTTP error:", errorJson);
      errorText = typeof errorJson === "string" ? errorJson : JSON.stringify(errorJson);
    } catch {
      try {
        errorText = await cloned.text();
        consola.error("HTTP error text:", errorText);
      } catch {
        errorText = "Failed to read error response";
        consola.error("Failed to read error response body");
      }
    }
    return c.json(
      {
        error: {
          message: errorText,
          type: "error"
        }
      },
      error.response.status
    );
  }
  return c.json(
    {
      error: {
        message: error.message,
        type: "error"
      }
    },
    500
  );
}

// src/services/github/get-copilot-token.ts
var getCopilotToken = async () => {
  const response = await fetch(
    `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`,
    {
      headers: githubHeaders(state)
    }
  );
  if (!response.ok) throw new HTTPError("Failed to get Copilot token", response);
  return await response.json();
};

// src/services/github/get-device-code.ts
async function getDeviceCode() {
  const response = await fetch(`${GITHUB_BASE_URL}/login/device/code`, {
    method: "POST",
    headers: standardHeaders(),
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: GITHUB_APP_SCOPES
    })
  });
  if (!response.ok) throw new HTTPError("Failed to get device code", response);
  return await response.json();
}

// src/services/github/get-user.ts
async function getGitHubUser() {
  const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
    headers: {
      authorization: `token ${state.githubToken}`,
      ...standardHeaders()
    }
  });
  if (!response.ok) throw new HTTPError("Failed to get GitHub user", response);
  return await response.json();
}

// src/services/github/poll-access-token.ts
import consola3 from "consola";

// src/lib/utils.ts
import consola2 from "consola";

// src/services/copilot/get-models.ts
var getModels = async () => {
  const response = await fetch(`${copilotBaseUrl(state)}/models`, {
    headers: copilotHeaders(state)
  });
  if (!response.ok) throw new HTTPError("Failed to get models", response);
  return await response.json();
};

// src/services/get-vscode-version.ts
var FALLBACK = "1.98.1";
async function getVSCodeVersion() {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5e3);
  try {
    const response = await fetch(
      "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=visual-studio-code-bin",
      {
        signal: controller.signal
      }
    );
    const pkgbuild = await response.text();
    const pkgverRegex = /pkgver=([0-9.]+)/;
    const match = pkgbuild.match(pkgverRegex);
    if (match) {
      return match[1];
    }
    return FALLBACK;
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(timeout);
  }
}
await getVSCodeVersion();

// src/lib/utils.ts
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var isNullish = (value) => value === null || value === void 0;
async function cacheModels() {
  const models = await getModels();
  state.models = models;
}
var cacheVSCodeVersion = async () => {
  const response = await getVSCodeVersion();
  state.vsCodeVersion = response;
  consola2.info(`Using VSCode version: ${response}`);
};

// src/services/github/poll-access-token.ts
async function pollAccessToken(deviceCode) {
  const sleepDuration = (deviceCode.interval + 1) * 1e3;
  consola3.debug(`Polling access token with interval of ${sleepDuration}ms`);
  while (true) {
    const response = await fetch(
      `${GITHUB_BASE_URL}/login/oauth/access_token`,
      {
        method: "POST",
        headers: standardHeaders(),
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      }
    );
    if (!response.ok) {
      await sleep(sleepDuration);
      consola3.error("Failed to poll access token:", await response.text());
      continue;
    }
    const json = await response.json();
    consola3.debug("Polling access token response:", json);
    const { access_token } = json;
    if (access_token) {
      return access_token;
    } else {
      await sleep(sleepDuration);
    }
  }
}

// src/lib/token.ts
var readGithubToken = () => fs2.readFile(PATHS.GITHUB_TOKEN_PATH, "utf8");
var writeGithubToken = (token) => fs2.writeFile(PATHS.GITHUB_TOKEN_PATH, token);
var setupCopilotToken = async () => {
  const { token, refresh_in } = await getCopilotToken();
  state.copilotToken = token;
  consola4.debug("GitHub Copilot Token fetched successfully!");
  if (state.showToken) {
    consola4.info("Copilot token:", token);
  }
  const refreshInterval = (refresh_in - 60) * 1e3;
  setInterval(async () => {
    consola4.debug("Refreshing Copilot token");
    try {
      const { token: token2 } = await getCopilotToken();
      state.copilotToken = token2;
      consola4.debug("Copilot token refreshed");
      if (state.showToken) {
        consola4.info("Refreshed Copilot token:", token2);
      }
    } catch (error) {
      consola4.error("Failed to refresh Copilot token:", error);
      throw error;
    }
  }, refreshInterval);
};
async function setupGitHubToken(options) {
  try {
    const githubToken = await readGithubToken();
    if (githubToken && !options?.force) {
      state.githubToken = githubToken;
      if (state.showToken) {
        consola4.info("GitHub token:", githubToken);
      }
      await logUser();
      return;
    }
    consola4.info("Not logged in, getting new access token");
    const response = await getDeviceCode();
    consola4.debug("Device code response:", response);
    consola4.info(
      `Please enter the code "${response.user_code}" in ${response.verification_uri}`
    );
    const token = await pollAccessToken(response);
    await writeGithubToken(token);
    state.githubToken = token;
    if (state.showToken) {
      consola4.info("GitHub token:", token);
    }
    await logUser();
  } catch (error) {
    if (error instanceof HTTPError) {
      consola4.error("Failed to get GitHub token:", await error.response.json());
      throw error;
    }
    consola4.error("Failed to get GitHub token:", error);
    throw error;
  }
}
async function logUser() {
  const user = await getGitHubUser();
  consola4.info(`Logged in as ${user.login}`);
}

// src/auth.ts
async function runAuth(options) {
  if (options.verbose) {
    consola5.level = 5;
    consola5.info("Verbose logging enabled");
  }
  state.showToken = options.showToken;
  await ensurePaths();
  await setupGitHubToken({ force: true });
  consola5.success("GitHub token written to", PATHS.GITHUB_TOKEN_PATH);
}
var auth = defineCommand({
  meta: {
    name: "auth",
    description: "Run GitHub auth flow without running the server"
  },
  args: {
    verbose: {
      alias: "v",
      type: "boolean",
      default: false,
      description: "Enable verbose logging"
    },
    "show-token": {
      type: "boolean",
      default: false,
      description: "Show GitHub token on auth"
    }
  },
  run({ args }) {
    return runAuth({
      verbose: args.verbose,
      showToken: args["show-token"]
    });
  }
});

// src/start.ts
import { defineCommand as defineCommand2 } from "citty";
import clipboard from "clipboardy";
import consola11 from "consola";
import { serve } from "srvx";
import invariant from "tiny-invariant";

// src/lib/shell.ts
import { execSync } from "node:child_process";
import process from "node:process";
function getShell() {
  const { platform, ppid, env } = process;
  if (platform === "win32") {
    try {
      const command = `wmic process get ParentProcessId,Name | findstr "${ppid}"`;
      const parentProcess = execSync(command, { stdio: "pipe" }).toString();
      if (parentProcess.toLowerCase().includes("powershell.exe")) {
        return "powershell";
      }
    } catch {
      return "cmd";
    }
    return "cmd";
  } else {
    const shellPath = env.SHELL;
    if (shellPath) {
      if (shellPath.endsWith("zsh")) return "zsh";
      if (shellPath.endsWith("fish")) return "fish";
      if (shellPath.endsWith("bash")) return "bash";
    }
    return "sh";
  }
}
function generateEnvScript(envVars, commandToRun = "") {
  const shell = getShell();
  const filteredEnvVars = Object.entries(envVars).filter(
    ([, value]) => value !== void 0
  );
  let commandBlock;
  switch (shell) {
    case "powershell": {
      commandBlock = filteredEnvVars.map(([key, value]) => `$env:${key} = ${value}`).join("; ");
      break;
    }
    case "cmd": {
      commandBlock = filteredEnvVars.map(([key, value]) => `set ${key}=${value}`).join(" & ");
      break;
    }
    case "fish": {
      commandBlock = filteredEnvVars.map(([key, value]) => `set -gx ${key} ${value}`).join("; ");
      break;
    }
    default: {
      const assignments = filteredEnvVars.map(([key, value]) => `${key}=${value}`).join(" ");
      commandBlock = filteredEnvVars.length > 0 ? `export ${assignments}` : "";
      break;
    }
  }
  if (commandBlock && commandToRun) {
    const separator = shell === "cmd" ? " & " : " && ";
    return `${commandBlock}${separator}${commandToRun}`;
  }
  return commandBlock || commandToRun;
}

// src/server.ts
import { Hono as Hono7 } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// src/routes/chat-completions/route.ts
import { Hono } from "hono";

// src/routes/chat-completions/handler.ts
import consola9 from "consola";
import { streamSSE } from "hono/streaming";

// src/lib/approval.ts
import consola6 from "consola";
var awaitApproval = async () => {
  const response = await consola6.prompt(`Accept incoming request?`, {
    type: "confirm"
  });
  if (!response)
    throw new HTTPError(
      "Request rejected",
      Response.json({ message: "Request rejected" }, { status: 403 })
    );
};

// src/lib/rate-limit.ts
import consola7 from "consola";
async function checkRateLimit(state2) {
  if (state2.rateLimitSeconds === void 0) return;
  const now = Date.now();
  if (!state2.lastRequestTimestamp) {
    state2.lastRequestTimestamp = now;
    return;
  }
  const elapsedSeconds = (now - state2.lastRequestTimestamp) / 1e3;
  if (elapsedSeconds > state2.rateLimitSeconds) {
    state2.lastRequestTimestamp = now;
    return;
  }
  const waitTimeSeconds = Math.ceil(state2.rateLimitSeconds - elapsedSeconds);
  if (!state2.rateLimitWait) {
    consola7.warn(
      `Rate limit exceeded. Need to wait ${waitTimeSeconds} more seconds.`
    );
    throw new HTTPError(
      "Rate limit exceeded",
      Response.json({ message: "Rate limit exceeded" }, { status: 429 })
    );
  }
  const waitTimeMs = waitTimeSeconds * 1e3;
  consola7.warn(
    `Rate limit reached. Waiting ${waitTimeSeconds} seconds before proceeding...`
  );
  await sleep(waitTimeMs);
  state2.lastRequestTimestamp = now;
  consola7.info("Rate limit wait completed, proceeding with request");
  return;
}

// src/lib/tokenizer.ts
import { countTokens } from "gpt-tokenizer/model/gpt-4o";
var getTokenCount = (messages) => {
  const simplifiedMessages = messages.map((message) => {
    let content = "";
    if (typeof message.content === "string") {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content.filter((part) => part.type === "text").map((part) => part.text).join("");
    }
    return { ...message, content };
  });
  let inputMessages = simplifiedMessages.filter((message) => {
    return message.role !== "tool";
  });
  let outputMessages = [];
  const lastMessage = simplifiedMessages.at(-1);
  if (lastMessage?.role === "assistant") {
    inputMessages = simplifiedMessages.slice(0, -1);
    outputMessages = [lastMessage];
  }
  const inputTokens = countTokens(inputMessages);
  const outputTokens = countTokens(outputMessages);
  return {
    input: inputTokens,
    output: outputTokens
  };
};

// src/services/copilot/create-chat-completions.ts
import consola8 from "consola";
import { events } from "fetch-event-stream";
var createChatCompletions = async (payload) => {
  if (!state.copilotToken) throw new Error("Copilot token not found");
  const enableVision = payload.messages.some(
    (x) => typeof x.content !== "string" && x.content?.some((x2) => x2.type === "image_url")
  );
  const isAgentCall = payload.messages.some(
    (msg) => ["assistant", "tool"].includes(msg.role)
  );
  const headers = {
    ...copilotHeaders(state, enableVision),
    "X-Initiator": isAgentCall ? "agent" : "user"
  };
  const response = await fetch(`${copilotBaseUrl(state)}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    consola8.error("Failed to create chat completions", response);
    throw new HTTPError("Failed to create chat completions", response);
  }
  if (payload.stream) {
    return events(response);
  }
  return await response.json();
};

// src/routes/chat-completions/handler.ts
async function handleCompletion(c) {
  await checkRateLimit(state);
  let payload = await c.req.json();
  consola9.debug("Request payload:", JSON.stringify(payload).slice(-400));
  consola9.info("Current token count:", getTokenCount(payload.messages));
  if (state.manualApprove) await awaitApproval();
  if (isNullish(payload.max_tokens)) {
    const selectedModel = state.models?.data.find(
      (model) => model.id === payload.model
    );
    payload = {
      ...payload,
      max_tokens: selectedModel?.capabilities.limits.max_output_tokens
    };
    consola9.debug("Set max_tokens to:", JSON.stringify(payload.max_tokens));
  }
  const response = await createChatCompletions(payload);
  if (isNonStreaming(response)) {
    consola9.debug("Non-streaming response:", JSON.stringify(response));
    return c.json(response);
  }
  consola9.debug("Streaming response");
  return streamSSE(c, async (stream) => {
    for await (const chunk of response) {
      consola9.debug("Streaming chunk:", JSON.stringify(chunk));
      await stream.writeSSE(chunk);
    }
  });
}
var isNonStreaming = (response) => Object.hasOwn(response, "choices");

// src/routes/chat-completions/route.ts
var completionRoutes = new Hono();
completionRoutes.post("/", async (c) => {
  try {
    return await handleCompletion(c);
  } catch (error) {
    return await forwardError(c, error);
  }
});

// src/routes/embeddings/route.ts
import { Hono as Hono2 } from "hono";

// src/services/copilot/create-embeddings.ts
var createEmbeddings = async (payload) => {
  if (!state.copilotToken) throw new Error("Copilot token not found");
  const response = await fetch(`${copilotBaseUrl(state)}/embeddings`, {
    method: "POST",
    headers: copilotHeaders(state),
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new HTTPError("Failed to create embeddings", response);
  return await response.json();
};

// src/routes/embeddings/route.ts
var embeddingRoutes = new Hono2();
embeddingRoutes.post("/", async (c) => {
  try {
    const paylod = await c.req.json();
    const response = await createEmbeddings(paylod);
    return c.json(response);
  } catch (error) {
    return await forwardError(c, error);
  }
});

// src/routes/messages/route.ts
import { Hono as Hono3 } from "hono";

// src/routes/messages/handler.ts
import consola10 from "consola";
import { streamSSE as streamSSE2 } from "hono/streaming";

// src/routes/messages/utils.ts
function mapOpenAIStopReasonToAnthropic(finishReason) {
  if (finishReason === null) {
    return null;
  }
  const stopReasonMap = {
    stop: "end_turn",
    length: "max_tokens",
    tool_calls: "tool_use",
    content_filter: "end_turn"
  };
  return stopReasonMap[finishReason];
}

// src/routes/messages/non-stream-translation.ts
function fixMessageSequence(messages) {
  const fixedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    fixedMessages.push(message);
    if (message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0) {
      const foundToolResponses = /* @__PURE__ */ new Set();
      let j = i + 1;
      while (j < messages.length && messages[j].role === "tool") {
        const toolMessage = messages[j];
        if ("tool_call_id" in toolMessage && toolMessage.tool_call_id) {
          foundToolResponses.add(toolMessage.tool_call_id);
        }
        j++;
      }
      for (const toolCall of message.tool_calls) {
        if (!foundToolResponses.has(toolCall.id)) {
          fixedMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: "Tool execution completed."
          });
        }
      }
    }
  }
  return fixedMessages;
}
function translateToOpenAI(payload) {
  const translated = {
    model: payload.model,
    messages: translateAnthropicMessagesToOpenAI(
      payload.messages,
      payload.system
    ),
    max_tokens: payload.max_tokens,
    stop: payload.stop_sequences,
    stream: payload.stream,
    temperature: payload.temperature,
    top_p: payload.top_p,
    user: payload.metadata?.user_id,
    tools: translateAnthropicToolsToOpenAI(payload.tools),
    tool_choice: translateAnthropicToolChoiceToOpenAI(payload.tool_choice)
  };
  translated.messages = fixMessageSequence(translated.messages);
  return translated;
}
function translateAnthropicMessagesToOpenAI(anthropicMessages, system) {
  const systemMessages = handleSystemPrompt(system);
  const otherMessages = [];
  for (const message of anthropicMessages) {
    if (message.role === "user") {
      otherMessages.push(...handleUserMessage(message));
    } else {
      const assistantMessages = handleAssistantMessage(message);
      otherMessages.push(...assistantMessages);
    }
  }
  return [...systemMessages, ...otherMessages];
}
function handleSystemPrompt(system) {
  if (!system) {
    return [];
  }
  if (typeof system === "string") {
    return [{ role: "system", content: system }];
  } else {
    const systemText = system.map((block) => block.text).join("\n\n");
    return [{ role: "system", content: systemText }];
  }
}
function handleUserMessage(message) {
  const msgs = [];
  if (Array.isArray(message.content)) {
    const toolResultBlocks = message.content.filter(
      (block) => block.type === "tool_result"
    );
    const textBlocks = message.content.filter((block) => block.type === "text");
    const otherBlocks = message.content.filter(
      (block) => block.type !== "tool_result" && block.type !== "text"
    );
    for (const block of toolResultBlocks) {
      msgs.push({
        role: "tool",
        tool_call_id: block.tool_use_id,
        content: typeof block.content === "string" ? block.content : JSON.stringify(block.content)
      });
    }
    if (textBlocks.length > 0 || otherBlocks.length > 0) {
      const textContent = [
        ...textBlocks.map((b) => b.text),
        ...otherBlocks.map((b) => JSON.stringify(b))
        // fallback for custom blocks
      ].join("\n\n").trim();
      if (textContent.length > 0) {
        msgs.push({
          role: "user",
          content: textContent
        });
      }
    }
  } else {
    msgs.push({
      role: "user",
      content: mapContent(message.content)
    });
  }
  return msgs;
}
function handleAssistantMessage(message) {
  if (!Array.isArray(message.content)) {
    return [
      {
        role: "assistant",
        content: mapContent(message.content)
      }
    ];
  }
  const toolUseBlocks = message.content.filter(
    (block) => block.type === "tool_use"
  );
  const textBlocks = message.content.filter(
    (block) => block.type === "text"
  );
  return toolUseBlocks.length > 0 ? [
    {
      role: "assistant",
      content: textBlocks.map((b) => b.text).join("\n\n") || null,
      tool_calls: toolUseBlocks.map((toolUse) => ({
        id: toolUse.id,
        type: "function",
        function: {
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input)
        }
      }))
    }
  ] : [
    {
      role: "assistant",
      content: mapContent(message.content)
    }
  ];
}
function mapContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const hasImage = content.some((block) => block.type === "image");
  if (!hasImage) {
    return content.filter((block) => block.type === "text").map((block) => block.text).join("\n\n");
  }
  const contentParts = [];
  for (const block of content) {
    if (block.type === "text") {
      contentParts.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${block.source.media_type};base64,${block.source.data}`
        }
      });
    }
  }
  return contentParts;
}
function translateAnthropicToolsToOpenAI(anthropicTools) {
  if (!anthropicTools) {
    return void 0;
  }
  return anthropicTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}
function translateAnthropicToolChoiceToOpenAI(anthropicToolChoice) {
  if (!anthropicToolChoice) {
    return void 0;
  }
  switch (anthropicToolChoice.type) {
    case "auto": {
      return "auto";
    }
    case "any": {
      return "required";
    }
    case "tool": {
      if (anthropicToolChoice.name) {
        return {
          type: "function",
          function: { name: anthropicToolChoice.name }
        };
      }
      return void 0;
    }
    case "none": {
      return "none";
    }
    default: {
      return void 0;
    }
  }
}
function translateToAnthropic(response) {
  const choice = response.choices[0];
  const textBlocks = getAnthropicTextBlocks(choice.message.content);
  const toolUseBlocks = getAnthropicToolUseBlocks(choice.message.tool_calls);
  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: response.model,
    content: [...textBlocks, ...toolUseBlocks],
    stop_reason: mapOpenAIStopReasonToAnthropic(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0
    }
  };
}
function getAnthropicTextBlocks(messageContent) {
  if (typeof messageContent === "string") {
    return [{ type: "text", text: messageContent }];
  }
  if (Array.isArray(messageContent)) {
    return messageContent.filter((part) => part.type === "text").map((part) => ({ type: "text", text: part.text }));
  }
  return [];
}
function getAnthropicToolUseBlocks(toolCalls) {
  if (!toolCalls) {
    return [];
  }
  return toolCalls.map((toolCall) => ({
    type: "tool_use",
    id: toolCall.id,
    name: toolCall.function.name,
    input: JSON.parse(toolCall.function.arguments)
  }));
}

// src/routes/messages/stream-translation.ts
function isToolBlockOpen(state2) {
  if (!state2.contentBlockOpen) {
    return false;
  }
  return Object.values(state2.toolCalls).some(
    (tc) => tc.anthropicBlockIndex === state2.contentBlockIndex
  );
}
function translateChunkToAnthropicEvents(chunk, state2) {
  const events2 = [];
  if (chunk.choices.length === 0) {
    return events2;
  }
  const choice = chunk.choices[0];
  const { delta } = choice;
  if (!state2.messageStartSent) {
    events2.push({
      type: "message_start",
      message: {
        id: chunk.id,
        type: "message",
        role: "assistant",
        content: [],
        model: chunk.model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 1,
          output_tokens: 1
          // Anthropic requires this to be > 0
        }
      }
    });
    state2.messageStartSent = true;
  }
  if (delta.content) {
    if (isToolBlockOpen(state2)) {
      events2.push({
        type: "content_block_stop",
        index: state2.contentBlockIndex
      });
      state2.contentBlockIndex++;
      state2.contentBlockOpen = false;
    }
    if (!state2.contentBlockOpen) {
      events2.push({
        type: "content_block_start",
        index: state2.contentBlockIndex,
        content_block: {
          type: "text",
          text: ""
        }
      });
      state2.contentBlockOpen = true;
    }
    events2.push({
      type: "content_block_delta",
      index: state2.contentBlockIndex,
      delta: {
        type: "text_delta",
        text: delta.content
      }
    });
  }
  if (delta.tool_calls) {
    for (const toolCall of delta.tool_calls) {
      if (toolCall.id && toolCall.function?.name) {
        if (state2.contentBlockOpen) {
          events2.push({
            type: "content_block_stop",
            index: state2.contentBlockIndex
          });
          state2.contentBlockIndex++;
          state2.contentBlockOpen = false;
        }
        const anthropicBlockIndex = state2.contentBlockIndex;
        state2.toolCalls[toolCall.index] = {
          id: toolCall.id,
          name: toolCall.function.name,
          anthropicBlockIndex
        };
        events2.push({
          type: "content_block_start",
          index: anthropicBlockIndex,
          content_block: {
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: {}
          }
        });
        state2.contentBlockOpen = true;
      }
      if (toolCall.function?.arguments) {
        const toolCallInfo = state2.toolCalls[toolCall.index];
        if (toolCallInfo) {
          events2.push({
            type: "content_block_delta",
            index: toolCallInfo.anthropicBlockIndex,
            delta: {
              type: "input_json_delta",
              partial_json: toolCall.function.arguments
            }
          });
        }
      }
    }
  }
  if (choice.finish_reason) {
    if (state2.contentBlockOpen) {
      events2.push({
        type: "content_block_stop",
        index: state2.contentBlockIndex
      });
      state2.contentBlockOpen = false;
    }
    events2.push(
      {
        type: "message_delta",
        delta: {
          stop_reason: mapOpenAIStopReasonToAnthropic(choice.finish_reason),
          stop_sequence: null
        },
        usage: {
          output_tokens: 1
        }
      },
      {
        type: "message_stop"
      }
    );
  }
  return events2;
}

// src/routes/messages/handler.ts
async function handleCompletion2(c) {
  await checkRateLimit(state);
  const anthropicPayload = await c.req.json();
  consola10.debug("Anthropic request payload:", JSON.stringify(anthropicPayload));
  const openAIPayload = translateToOpenAI(anthropicPayload);
  consola10.debug(
    "Translated OpenAI request payload:",
    JSON.stringify(openAIPayload)
  );
  if (state.manualApprove) {
    await awaitApproval();
  }
  const response = await createChatCompletions(openAIPayload);
  if (isNonStreaming2(response)) {
    consola10.debug(
      "Non-streaming response from Copilot:",
      JSON.stringify(response).slice(-400)
    );
    const anthropicResponse = translateToAnthropic(response);
    consola10.debug(
      "Translated Anthropic response:",
      JSON.stringify(anthropicResponse)
    );
    return c.json(anthropicResponse);
  }
  consola10.debug("Streaming response from Copilot");
  return streamSSE2(c, async (stream) => {
    const streamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {}
    };
    for await (const rawEvent of response) {
      consola10.debug("Copilot raw stream event:", JSON.stringify(rawEvent));
      if (rawEvent.data === "[DONE]") {
        break;
      }
      if (!rawEvent.data) {
        continue;
      }
      const chunk = JSON.parse(rawEvent.data);
      const events2 = translateChunkToAnthropicEvents(chunk, streamState);
      for (const event of events2) {
        consola10.debug("Translated Anthropic event:", JSON.stringify(event));
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event)
        });
      }
    }
  });
}
var isNonStreaming2 = (response) => Object.hasOwn(response, "choices");

// src/routes/messages/route.ts
var messageRoutes = new Hono3();
messageRoutes.post("/", async (c) => {
  try {
    return await handleCompletion2(c);
  } catch (error) {
    return await forwardError(c, error);
  }
});

// src/routes/models/route.ts
import { Hono as Hono4 } from "hono";
var modelRoutes = new Hono4();
modelRoutes.get("/", async (c) => {
  try {
    if (!state.models) {
      await cacheModels();
    }
    const models = state.models?.data.map((model) => ({
      id: model.id,
      object: "model",
      type: "model",
      created: 0,
      // No date available from source
      created_at: (/* @__PURE__ */ new Date(0)).toISOString(),
      // No date available from source
      owned_by: model.vendor,
      display_name: model.name
    }));
    return c.json({
      object: "list",
      data: models,
      has_more: false
    });
  } catch (error) {
    return await forwardError(c, error);
  }
});

// src/routes/token/route.ts
import { Hono as Hono5 } from "hono";
var tokenRoute = new Hono5();
tokenRoute.get("/", (c) => {
  try {
    return c.json({
      token: state.copilotToken
    });
  } catch (error) {
    console.error("Error fetching token:", error);
    return c.json({ error: "Failed to fetch token", token: null }, 500);
  }
});

// src/routes/usage/route.ts
import { Hono as Hono6 } from "hono";

// src/services/github/get-copilot-usage.ts
var getCopilotUsage = async () => {
  const response = await fetch(`${GITHUB_API_BASE_URL}/copilot_internal/user`, {
    headers: githubHeaders(state)
  });
  if (!response.ok) {
    throw new HTTPError("Failed to get Copilot usage", response);
  }
  return await response.json();
};

// src/routes/usage/route.ts
var usageRoute = new Hono6();
usageRoute.get("/", async (c) => {
  try {
    const usage = await getCopilotUsage();
    return c.json(usage);
  } catch (error) {
    console.error("Error fetching Copilot usage:", error);
    return c.json({ error: "Failed to fetch Copilot usage" }, 500);
  }
});

// src/server.ts
var server = new Hono7();
server.use(logger());
server.use(cors());
server.get("/", (c) => c.text("Server running"));
server.route("/chat/completions", completionRoutes);
server.route("/models", modelRoutes);
server.route("/embeddings", embeddingRoutes);
server.route("/usage", usageRoute);
server.route("/token", tokenRoute);
server.route("/v1/chat/completions", completionRoutes);
server.route("/v1/models", modelRoutes);
server.route("/v1/embeddings", embeddingRoutes);
server.route("/v1/messages", messageRoutes);
server.post("/v1/messages/count_tokens", (c) => c.json({ input_tokens: 1 }));

// src/start.ts
async function runServer(options) {
  if (options.verbose) {
    consola11.level = 5;
    consola11.info("Verbose logging enabled");
  }
  state.accountType = options.accountType;
  if (options.accountType !== "individual") {
    consola11.info(`Using ${options.accountType} plan GitHub account`);
  }
  state.manualApprove = options.manual;
  state.rateLimitSeconds = options.rateLimit;
  state.rateLimitWait = options.rateLimitWait;
  state.showToken = options.showToken;
  await ensurePaths();
  await cacheVSCodeVersion();
  if (options.githubToken) {
    state.githubToken = options.githubToken;
    consola11.info("Using provided GitHub token");
  } else {
    await setupGitHubToken();
  }
  await setupCopilotToken();
  await cacheModels();
  consola11.info(
    `Available models: 
${state.models?.data.map((model) => `- ${model.id}`).join("\n")}`
  );
  const serverUrl = `http://localhost:${options.port}`;
  if (options.claudeCode) {
    invariant(state.models, "Models should be loaded by now");
    const selectedModel = await consola11.prompt(
      "Select a model to use with Claude Code",
      {
        type: "select",
        options: state.models.data.map((model) => model.id)
      }
    );
    const selectedSmallModel = await consola11.prompt(
      "Select a small model to use with Claude Code",
      {
        type: "select",
        options: state.models.data.map((model) => model.id)
      }
    );
    const command = generateEnvScript(
      {
        ANTHROPIC_BASE_URL: serverUrl,
        ANTHROPIC_AUTH_TOKEN: "dummy",
        ANTHROPIC_MODEL: selectedModel,
        ANTHROPIC_SMALL_FAST_MODEL: selectedSmallModel
      },
      "claude"
    );
    clipboard.writeSync(command);
    consola11.success("Copied Claude Code command to clipboard!");
  }
  consola11.box(
    `\u{1F310} Usage Viewer: https://ericc-ch.github.io/copilot-api?endpoint=${serverUrl}/usage`
  );
  serve({
    fetch: server.fetch,
    port: options.port
  });
}
var start = defineCommand2({
  meta: {
    name: "start",
    description: "Start the Copilot API server"
  },
  args: {
    port: {
      alias: "p",
      type: "string",
      default: "4141",
      description: "Port to listen on"
    },
    verbose: {
      alias: "v",
      type: "boolean",
      default: false,
      description: "Enable verbose logging"
    },
    "account-type": {
      alias: "a",
      type: "string",
      default: "individual",
      description: "Account type to use (individual, business, enterprise)"
    },
    manual: {
      type: "boolean",
      default: false,
      description: "Enable manual request approval"
    },
    "rate-limit": {
      alias: "r",
      type: "string",
      description: "Rate limit in seconds between requests"
    },
    wait: {
      alias: "w",
      type: "boolean",
      default: false,
      description: "Wait instead of error when rate limit is hit. Has no effect if rate limit is not set"
    },
    "github-token": {
      alias: "g",
      type: "string",
      description: "Provide GitHub token directly (must be generated using the `auth` subcommand)"
    },
    "claude-code": {
      alias: "c",
      type: "boolean",
      default: false,
      description: "Generate a command to launch Claude Code with Copilot API config"
    },
    "show-token": {
      type: "boolean",
      default: false,
      description: "Show GitHub and Copilot tokens on fetch and refresh"
    }
  },
  run({ args }) {
    const rateLimitRaw = args["rate-limit"];
    const rateLimit = (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      rateLimitRaw === void 0 ? void 0 : Number.parseInt(rateLimitRaw, 10)
    );
    return runServer({
      port: Number.parseInt(args.port, 10),
      verbose: args.verbose,
      accountType: args["account-type"],
      manual: args.manual,
      rateLimit,
      rateLimitWait: Boolean(args.wait),
      githubToken: args["github-token"],
      claudeCode: args["claude-code"],
      showToken: args["show-token"]
    });
  }
});

// src/main.ts
var main = defineCommand3({
  meta: {
    name: "copilot-api",
    description: "A wrapper around GitHub Copilot API to make it OpenAI compatible, making it usable for other tools."
  },
  subCommands: { auth, start }
});
await runMain(main);
//# sourceMappingURL=main.js.map