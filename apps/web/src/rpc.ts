// JSON-RPC 2.0 over the daemon's `/rpc` WebSocket. The session cookie set by
// `/api/session` or pairing authenticates it; `dronex` is the subprotocol.

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void };
type Listener = (params: any) => void;

export class Rpc {
  private socket?: WebSocket;
  private next = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, Set<Listener>>();
  onClose?: () => void;

  connect(): Promise<void> {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${location.host}/rpc`, ["dronex"]);
    this.socket = socket;
    return new Promise((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("Could not reach DroneX."));
      socket.onclose = () => {
        for (const p of this.pending.values()) p.reject(new Error("Disconnected from DroneX."));
        this.pending.clear();
        this.onClose?.();
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const message = JSON.parse(event.data);
        if (message.id != null && this.pending.has(message.id)) {
          const p = this.pending.get(message.id)!;
          this.pending.delete(message.id);
          if (message.error) {
            p.reject(new RpcError(message.error.message, message.error.code, message.error.data));
          } else {
            p.resolve(message.result);
          }
        } else if (message.method) {
          this.listeners.get(message.method)?.forEach((listener) => listener(message.params));
        }
      };
    });
  }

  call<T = any>(method: string, params: object = {}): Promise<T> {
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected to DroneX."));
        return;
      }
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  on(method: string, listener: Listener): () => void {
    let set = this.listeners.get(method);
    if (!set) {
      set = new Set();
      this.listeners.set(method, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }
}

// Signing in: a one-time `?bootstrap=` token from `dronex open`, or pairing,
// which an operator approves at the computer.

export async function sessionPaired(): Promise<boolean> {
  const answer = await fetch("/api/session", { credentials: "same-origin" });
  if (!answer.ok) throw new Error("DroneX is not running on this computer.");
  return (await answer.json()).paired === true;
}

export async function exchangeBootstrap(token: string): Promise<boolean> {
  const answer = await fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bootstrap: token }),
  });
  return answer.ok && (await answer.json()).paired === true;
}

export interface Pairing {
  id: string;
  code: string;
  command?: string;
}

export async function startPairing(): Promise<Pairing> {
  const answer = await fetch("/api/pairing", { method: "POST", credentials: "same-origin" });
  if (!answer.ok) throw new Error(await answer.text());
  return answer.json();
}

export async function pollPairing(id: string): Promise<"pending" | "approved" | "denied" | "unknown"> {
  const answer = await fetch(`/api/pairing/${id}`, { credentials: "same-origin" });
  return (await answer.json()).state;
}
