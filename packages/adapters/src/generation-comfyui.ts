import { randomUUID } from "node:crypto";
import type {
  GenerationAdapter,
  GenerationProgress,
  GenerationRequest,
  GenerationResult,
} from "@icy/core";

export type ComfyUIBackend = "local" | "cloud";

export type ComfyUIGenerationAdapterOptions = {
  /**
   * HTTP base. Local default `http://127.0.0.1:8188` (or `COMFYUI_URL`).
   * Cloud default `https://cloud.comfy.org` when mode is cloud.
   */
  baseUrl?: string;
  /**
   * `cloud` | `local`. Auto: cloud when `COMFY_CLOUD_API_KEY` is set or URL hosts cloud.comfy.org.
   * Override with `COMFYUI_BACKEND=local|cloud`.
   */
  backend?: ComfyUIBackend;
  /** Cloud API key (`COMFY_CLOUD_API_KEY`). Required for cloud. */
  apiKey?: string;
  fetch?: typeof fetch;
  WebSocket?: typeof WebSocket;
  /** Max wait for a single run (default 10 minutes). */
  timeoutMs?: number;
};

export class ComfyUIGenerationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ComfyUIGenerationError";
  }
}

type HistoryImage = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type NodeOutputs = Record<string, { images?: HistoryImage[] }>;

type HistoryEntry = {
  outputs?: NodeOutputs;
  status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
};

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function resolveBackend(
  options: ComfyUIGenerationAdapterOptions,
  baseUrl: string,
  apiKey: string | undefined,
): ComfyUIBackend {
  if (options.backend) return options.backend;
  const fromEnv = env("COMFYUI_BACKEND");
  if (fromEnv === "local" || fromEnv === "cloud") return fromEnv;
  try {
    if (new URL(baseUrl).hostname.includes("cloud.comfy.org")) return "cloud";
  } catch {
    /* ignore */
  }
  if (apiKey) return "cloud";
  return "local";
}

function resolveBaseUrl(
  options: ComfyUIGenerationAdapterOptions,
  backend: ComfyUIBackend,
): string {
  if (options.baseUrl) return normalizeBaseUrl(options.baseUrl);
  const fromEnv = env("COMFYUI_URL");
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return backend === "cloud"
    ? "https://cloud.comfy.org"
    : "http://127.0.0.1:8188";
}

function toWsUrl(httpBase: string): string {
  const u = new URL(httpBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = "";
  u.hash = "";
  return u.toString();
}

export class ComfyUIGenerationAdapter implements GenerationAdapter {
  private readonly baseUrl: string;
  private readonly backend: ComfyUIBackend;
  private readonly apiKey: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly WebSocketCtor: typeof WebSocket;
  private readonly timeoutMs: number;
  /** Cloud uses `/api/...`; local uses root paths (`/prompt`, …). */
  private readonly apiPrefix: string;

  constructor(options: ComfyUIGenerationAdapterOptions = {}) {
    const apiKey = options.apiKey ?? env("COMFY_CLOUD_API_KEY");
    // Tentative URL for hostname detection before backend is known.
    const tentativeUrl = normalizeBaseUrl(
      options.baseUrl ?? env("COMFYUI_URL") ?? "http://127.0.0.1:8188",
    );
    this.backend = resolveBackend(options, tentativeUrl, apiKey);
    this.baseUrl = resolveBaseUrl(options, this.backend);
    this.apiKey = apiKey;
    this.apiPrefix = this.backend === "cloud" ? "/api" : "";
    this.fetchFn = options.fetch ?? fetch.bind(globalThis);
    this.WebSocketCtor = options.WebSocket ?? WebSocket;
    this.timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

    if (this.backend === "cloud" && !this.apiKey) {
      // Don't throw in constructor — ping/run will fail with a clear message.
    }
  }

  get url(): string {
    return this.baseUrl;
  }

  get mode(): ComfyUIBackend {
    return this.backend;
  }

  get hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  private path(suffix: string): string {
    const s = suffix.startsWith("/") ? suffix : `/${suffix}`;
    return `${this.baseUrl}${this.apiPrefix}${s}`;
  }

  private authHeaders(extra?: Record<string, string>): Headers {
    const headers = new Headers(extra);
    if (this.apiKey) headers.set("X-API-Key", this.apiKey);
    return headers;
  }

  async ping(): Promise<{ ok: boolean; detail?: string }> {
    try {
      if (this.backend === "cloud" && !this.apiKey) {
        return {
          ok: false,
          detail: "缺少 COMFY_CLOUD_API_KEY（platform.comfy.org 申请）",
        };
      }

      if (this.backend === "cloud") {
        const res = await this.fetchFn(this.path("/user"), {
          headers: this.authHeaders(),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          return {
            ok: false,
            detail:
              res.status === 401
                ? "API Key 无效或未授权"
                : `HTTP ${res.status}`,
          };
        }
        const body = (await res.json()) as { status?: string };
        return {
          ok: true,
          detail: body.status ? `Cloud · ${body.status}` : "Cloud · ok",
        };
      }

      const res = await this.fetchFn(`${this.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return { ok: false, detail: `HTTP ${res.status}` };
      }
      const body = (await res.json()) as {
        system?: { comfyui_version?: string };
      };
      const ver = body.system?.comfyui_version;
      return { ok: true, detail: ver ? `Local · ComfyUI ${ver}` : "Local · ok" };
    } catch (e) {
      return {
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async run(
    request: GenerationRequest,
    onProgress?: (p: GenerationProgress) => void,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    if (this.backend === "cloud" && !this.apiKey) {
      throw new ComfyUIGenerationError(
        "Cloud 模式需要 COMFY_CLOUD_API_KEY（https://platform.comfy.org/profile/api-keys）",
      );
    }

    const started = Date.now();
    const clientId = randomUUID();

    let workflow = request.workflow;
    if (request.inputImages.length > 0) {
      const nameMap = new Map<string, string>();
      for (const img of request.inputImages) {
        const uploaded = await this.uploadImage(img.name, img.data, signal);
        if (uploaded !== img.name) nameMap.set(img.name, uploaded);
      }
      if (nameMap.size > 0) {
        workflow = remapLoadImageNames(workflow, nameMap);
      }
    }

    const promptId = await this.queuePrompt(workflow, clientId, signal);
    const wsOutputs = await this.waitForPrompt(
      promptId,
      clientId,
      onProgress,
      signal,
    );

    const images = await this.collectImages(promptId, wsOutputs, signal);
    if (images.length === 0) {
      throw new ComfyUIGenerationError(`任务 ${promptId} 未产出图片`);
    }

    return { images, durationMs: Date.now() - started };
  }

  private async uploadImage(
    name: string,
    data: Buffer,
    signal?: AbortSignal,
  ): Promise<string> {
    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(data)], { type: "application/octet-stream" }),
      name,
    );
    form.append("overwrite", "true");
    const res = await this.fetchFn(this.path("/upload/image"), {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
      signal,
    });
    if (!res.ok) {
      throw new ComfyUIGenerationError(
        `上传图片失败 ${name}: HTTP ${res.status}`,
      );
    }
    try {
      const body = (await res.json()) as { name?: string };
      return body.name?.trim() || name;
    } catch {
      return name;
    }
  }

  private async queuePrompt(
    workflow: Record<string, unknown>,
    clientId: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const res = await this.fetchFn(this.path("/prompt"), {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ComfyUIGenerationError(
        `提交 prompt 失败: HTTP ${res.status}${text ? ` — ${text}` : ""}`,
      );
    }
    const body = (await res.json()) as {
      prompt_id?: string;
      error?: unknown;
      node_errors?: unknown;
    };
    // Cloud returns `node_errors: {}` on success — only non-empty objects count.
    if (hasPayload(body.error) || hasPayload(body.node_errors)) {
      throw new ComfyUIGenerationError(
        `ComfyUI 拒绝工作流: ${JSON.stringify(body.error ?? body.node_errors)}`,
      );
    }
    if (!body.prompt_id) {
      throw new ComfyUIGenerationError("ComfyUI 未返回 prompt_id");
    }
    return body.prompt_id;
  }

  private waitForPrompt(
    promptId: string,
    clientId: string,
    onProgress?: (p: GenerationProgress) => void,
    signal?: AbortSignal,
  ): Promise<NodeOutputs> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let currentNode: string | null = null;
      const outputs: NodeOutputs = {};

      const qs = new URLSearchParams({ clientId });
      if (this.apiKey) qs.set("token", this.apiKey);
      const wsUrl = `${toWsUrl(this.baseUrl)}?${qs}`;
      const ws = new this.WebSocketCtor(wsUrl);

      const cleanup = () => {
        signal?.removeEventListener("abort", onAbort);
        clearTimeout(timer);
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };

      const finishOk = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(outputs);
      };

      const finishErr = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const onAbort = () => {
        void this.fetchFn(this.path("/interrupt"), {
          method: "POST",
          headers: this.authHeaders(),
        }).catch(() => undefined);
        finishErr(new ComfyUIGenerationError("生成已取消"));
      };

      const timer = setTimeout(() => {
        finishErr(new ComfyUIGenerationError(`生成超时（>${this.timeoutMs}ms）`));
      }, this.timeoutMs);

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      ws.addEventListener("error", () => {
        finishErr(new ComfyUIGenerationError("ComfyUI WebSocket 连接失败"));
      });

      ws.addEventListener("message", (event) => {
        let msg: { type?: string; data?: Record<string, unknown> };
        try {
          const raw =
            typeof event.data === "string"
              ? event.data
              : Buffer.from(event.data as ArrayBuffer).toString("utf8");
          if (raw.length > 0 && raw.charCodeAt(0) === 0) return;
          msg = JSON.parse(raw) as typeof msg;
        } catch {
          return;
        }

        const data = msg.data ?? {};
        const pid = data.prompt_id;
        // Cloud docs: filter to our job when prompt_id is present.
        if (pid != null && pid !== promptId) return;

        if (msg.type === "progress") {
          const value = Number(data.value ?? 0);
          const max = Number(data.max ?? 0);
          onProgress?.({
            fraction: max > 0 ? value / max : null,
            currentNode,
          });
          return;
        }

        if (msg.type === "executed") {
          const node = data.node;
          const output = data.output;
          if (node != null && output && typeof output === "object") {
            outputs[String(node)] = output as { images?: HistoryImage[] };
          }
          return;
        }

        if (msg.type === "execution_success") {
          finishOk();
          return;
        }

        if (msg.type === "executing") {
          const node = data.node;
          if (node == null) {
            // Local ComfyUI often signals done this way; cloud prefers execution_success.
            finishOk();
            return;
          }
          currentNode = String(node);
          onProgress?.({ fraction: null, currentNode });
          return;
        }

        if (msg.type === "execution_error") {
          finishErr(
            new ComfyUIGenerationError(
              `ComfyUI 执行错误: ${formatExecutionError(data)}`,
            ),
          );
        }
      });
    });
  }

  private async collectImages(
    promptId: string,
    wsOutputs: NodeOutputs,
    signal?: AbortSignal,
  ): Promise<GenerationResult["images"]> {
    let outputs = wsOutputs;
    if (!hasImages(outputs)) {
      outputs = (await this.fetchHistoryOutputs(promptId, signal)) ?? outputs;
    }

    const images: GenerationResult["images"] = [];
    for (const output of Object.values(outputs)) {
      for (const img of output.images ?? []) {
        const data = await this.viewImage(img, signal);
        images.push({ filename: img.filename, data });
      }
    }
    return images;
  }

  private async fetchHistoryOutputs(
    promptId: string,
    signal?: AbortSignal,
  ): Promise<NodeOutputs | null> {
    const res = await this.fetchFn(this.path(`/history/${promptId}`), {
      headers: this.authHeaders(),
      signal,
    });
    if (!res.ok) return null;
    const history = (await res.json()) as Record<string, HistoryEntry>;
    return history[promptId]?.outputs ?? null;
  }

  private async viewImage(
    img: HistoryImage,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const params = new URLSearchParams({
      filename: img.filename,
      subfolder: img.subfolder ?? "",
      type: img.type ?? "output",
    });
    // Cloud returns 302 → signed URL; fetch follows redirects by default.
    const res = await this.fetchFn(`${this.path("/view")}?${params}`, {
      headers: this.authHeaders(),
      signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new ComfyUIGenerationError(
        `下载图片失败 ${img.filename}: HTTP ${res.status}`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

/** When upload renames a file, patch LoadImage `image` inputs that still use the old name. */
function remapLoadImageNames(
  workflow: Record<string, unknown>,
  nameMap: Map<string, string>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...workflow };
  for (const [nodeId, raw] of Object.entries(workflow)) {
    if (!raw || typeof raw !== "object") continue;
    const node = raw as { class_type?: string; inputs?: Record<string, unknown> };
    if (node.class_type !== "LoadImage" || !node.inputs) continue;
    const image = node.inputs.image;
    if (typeof image !== "string" || !nameMap.has(image)) continue;
    next[nodeId] = {
      ...node,
      inputs: { ...node.inputs, image: nameMap.get(image) },
    };
  }
  return next;
}

function hasImages(outputs: NodeOutputs): boolean {
  return Object.values(outputs).some((o) => (o.images?.length ?? 0) > 0);
}

/** True when value is a non-empty object/array/string (Cloud uses `{}` for “no errors”). */
function hasPayload(value: unknown): boolean {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function formatExecutionError(data: Record<string, unknown>): string {
  const msg = data.exception_message;
  if (typeof msg === "string" && msg.trim()) {
    // Prefer the nested validation detail when Cloud wraps JSON in the message.
    const nodeErrorsIdx = msg.indexOf('"node_errors"');
    if (nodeErrorsIdx >= 0) {
      try {
        const parsed = JSON.parse(msg.slice(msg.indexOf("{"))) as {
          node_errors?: Record<
            string,
            { errors?: { details?: string; message?: string }[] }
          >;
        };
        const parts: string[] = [];
        for (const [nodeId, node] of Object.entries(parsed.node_errors ?? {})) {
          for (const err of node.errors ?? []) {
            parts.push(`节点 ${nodeId}: ${err.details || err.message || "error"}`);
          }
        }
        if (parts.length) return parts.join("; ");
      } catch {
        /* fall through */
      }
    }
    return msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
  }
  return JSON.stringify(data);
}
