import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComfyUIGenerationAdapter,
  ComfyUIGenerationError,
} from "./generation-comfyui";

type WsListener = (event: { data: string }) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 1;
  private listeners = new Map<string, Set<WsListener>>();

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: WsListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, data: unknown) {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    for (const fn of this.listeners.get(type) ?? []) {
      fn({ data: payload });
    }
  }
}

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
  delete process.env.COMFY_CLOUD_API_KEY;
  delete process.env.COMFYUI_BACKEND;
  delete process.env.COMFYUI_URL;
});

function mockFetchSequence(
  handlers: Array<(url: string, init?: RequestInit) => Promise<Response> | Response>,
) {
  let i = 0;
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const handler = handlers[i++];
    if (!handler) throw new Error(`unexpected fetch: ${url}`);
    return handler(url, init);
  });
}

describe("ComfyUIGenerationAdapter.ping", () => {
  it("local: reports ok when system_stats responds", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ system: { comfyui_version: "0.3.0" } }),
    );
    const adapter = new ComfyUIGenerationAdapter({
      backend: "local",
      baseUrl: "http://127.0.0.1:8188",
      fetch: fetchFn as unknown as typeof fetch,
    });
    await expect(adapter.ping()).resolves.toEqual({
      ok: true,
      detail: "Local · ComfyUI 0.3.0",
    });
  });

  it("cloud: uses /api/user with X-API-Key", async () => {
    const fetchFn = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://cloud.comfy.org/api/user");
      const headers = new Headers(init?.headers);
      expect(headers.get("X-API-Key")).toBe("test-key");
      return Response.json({ status: "active" });
    });
    const adapter = new ComfyUIGenerationAdapter({
      backend: "cloud",
      apiKey: "test-key",
      fetch: fetchFn as unknown as typeof fetch,
    });
    await expect(adapter.ping()).resolves.toEqual({
      ok: true,
      detail: "Cloud · active",
    });
    expect(adapter.mode).toBe("cloud");
    expect(adapter.url).toBe("https://cloud.comfy.org");
  });

  it("cloud: fails clearly without API key", async () => {
    const adapter = new ComfyUIGenerationAdapter({ backend: "cloud" });
    const result = await adapter.ping();
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/COMFY_CLOUD_API_KEY/);
  });
});

describe("ComfyUIGenerationAdapter.run", () => {
  it("local: queues prompt, waits on websocket, downloads images", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchFn = mockFetchSequence([
      async (url, init) => {
        expect(url).toContain("/prompt");
        expect(url).not.toContain("/api/prompt");
        expect(init?.method).toBe("POST");
        return Response.json({ prompt_id: "pid-1" });
      },
      async (url) => {
        expect(url).toContain("/history/pid-1");
        return Response.json({
          "pid-1": {
            outputs: {
              "9": {
                images: [{ filename: "icy_00001_.png", type: "output" }],
              },
            },
          },
        });
      },
      async (url) => {
        expect(url).toContain("/view?");
        return new Response(png, { status: 200 });
      },
    ]);

    const adapter = new ComfyUIGenerationAdapter({
      backend: "local",
      baseUrl: "http://127.0.0.1:8188",
      fetch: fetchFn as unknown as typeof fetch,
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      timeoutMs: 5000,
    });

    const runPromise = adapter.run({
      workflow: { "3": { class_type: "KSampler", inputs: {} } },
      inputImages: [],
    });

    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    const ws = FakeWebSocket.instances[0]!;
    expect(ws.url).not.toContain("token=");
    ws.emit("message", {
      type: "executing",
      data: { node: null, prompt_id: "pid-1" },
    });

    const result = await runPromise;
    expect(result.images[0]!.data.equals(png)).toBe(true);
  });

  it("opens websocket before queueing and keeps completion events received before prompt response", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    class ConnectingWebSocket extends FakeWebSocket {
      readyState = 0;
    }

    const fetchFn = mockFetchSequence([
      async (url) => {
        expect(url).toContain("/prompt");
        const ws = FakeWebSocket.instances[0]!;
        expect(ws.readyState).toBe(1);
        ws.emit("message", {
          type: "executed",
          data: {
            prompt_id: "pid-fast",
            node: "9",
            output: { images: [{ filename: "fast.png", type: "output" }] },
          },
        });
        ws.emit("message", {
          type: "execution_success",
          data: { prompt_id: "pid-fast" },
        });
        return Response.json({ prompt_id: "pid-fast" });
      },
      async (url) => {
        expect(url).toContain("/view?");
        return new Response(png, { status: 200 });
      },
    ]);

    const adapter = new ComfyUIGenerationAdapter({
      backend: "local",
      baseUrl: "http://127.0.0.1:8188",
      fetch: fetchFn as unknown as typeof fetch,
      WebSocket: ConnectingWebSocket as unknown as typeof WebSocket,
      timeoutMs: 5000,
    });

    const runPromise = adapter.run({ workflow: {}, inputImages: [] });
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    expect(fetchFn).not.toHaveBeenCalled();

    const ws = FakeWebSocket.instances[0]!;
    ws.readyState = 1;
    ws.emit("open", "");

    await expect(runPromise).resolves.toMatchObject({
      images: [{ filename: "fast.png" }],
    });
  });

  it("interrupts the backend when a run times out", async () => {
    const fetchFn = mockFetchSequence([
      async (url) => {
        expect(url).toContain("/prompt");
        return Response.json({ prompt_id: "pid-timeout" });
      },
      async (url, init) => {
        expect(url).toContain("/interrupt");
        expect(init?.method).toBe("POST");
        return Response.json({});
      },
    ]);
    const adapter = new ComfyUIGenerationAdapter({
      backend: "local",
      baseUrl: "http://127.0.0.1:8188",
      fetch: fetchFn as unknown as typeof fetch,
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      timeoutMs: 10,
    });

    await expect(adapter.run({ workflow: {}, inputImages: [] })).rejects.toThrow(
      /生成超时/,
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("cloud: treats empty node_errors as success", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchFn = mockFetchSequence([
      async () =>
        Response.json({ prompt_id: "pid-empty-err", node_errors: {} }),
      async () => new Response(png, { status: 200 }),
    ]);
    const adapter = new ComfyUIGenerationAdapter({
      backend: "cloud",
      apiKey: "cloud-key",
      fetch: fetchFn as unknown as typeof fetch,
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      timeoutMs: 5000,
    });
    const runPromise = adapter.run({ workflow: {}, inputImages: [] });
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    FakeWebSocket.instances[0]!.emit("message", {
      type: "executed",
      data: {
        prompt_id: "pid-empty-err",
        node: "9",
        output: { images: [{ filename: "ok.png", type: "output" }] },
      },
    });
    FakeWebSocket.instances[0]!.emit("message", {
      type: "execution_success",
      data: { prompt_id: "pid-empty-err" },
    });
    await expect(runPromise).resolves.toMatchObject({
      images: [{ filename: "ok.png" }],
    });
  });

  it("cloud: uses /api paths, WS token, executed outputs + execution_success", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchFn = mockFetchSequence([
      async (url, init) => {
        expect(url).toBe("https://cloud.comfy.org/api/prompt");
        const headers = new Headers(init?.headers);
        expect(headers.get("X-API-Key")).toBe("cloud-key");
        return Response.json({ prompt_id: "pid-cloud" });
      },
      async (url, init) => {
        expect(url).toContain("https://cloud.comfy.org/api/view?");
        const headers = new Headers(init?.headers);
        expect(headers.get("X-API-Key")).toBe("cloud-key");
        return new Response(png, { status: 200 });
      },
    ]);

    const adapter = new ComfyUIGenerationAdapter({
      backend: "cloud",
      apiKey: "cloud-key",
      fetch: fetchFn as unknown as typeof fetch,
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      timeoutMs: 5000,
    });

    const runPromise = adapter.run({ workflow: {}, inputImages: [] });

    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    const ws = FakeWebSocket.instances[0]!;
    expect(ws.url).toContain("wss://cloud.comfy.org/ws?");
    expect(ws.url).toContain("token=cloud-key");

    ws.emit("message", {
      type: "executed",
      data: {
        prompt_id: "pid-cloud",
        node: "9",
        output: { images: [{ filename: "out.png", type: "output" }] },
      },
    });
    ws.emit("message", {
      type: "execution_success",
      data: { prompt_id: "pid-cloud" },
    });

    const result = await runPromise;
    expect(result.images).toHaveLength(1);
    expect(result.images[0]!.filename).toBe("out.png");
  });

  it("surfaces execution_error from websocket", async () => {
    const fetchFn = mockFetchSequence([
      async () => Response.json({ prompt_id: "pid-err" }),
    ]);
    const adapter = new ComfyUIGenerationAdapter({
      backend: "local",
      baseUrl: "http://comfy.test",
      fetch: fetchFn as unknown as typeof fetch,
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      timeoutMs: 2000,
    });

    const runPromise = adapter.run({ workflow: {}, inputImages: [] });
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    FakeWebSocket.instances[0]!.emit("message", {
      type: "execution_error",
      data: { prompt_id: "pid-err", exception_message: "boom" },
    });

    await expect(runPromise).rejects.toBeInstanceOf(ComfyUIGenerationError);
  });
});
