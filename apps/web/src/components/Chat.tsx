import { useEffect, useMemo, useRef, useState } from "react";
import { rpc, useStore } from "../store";
import { errorText } from "../commands";

interface AgentConfig {
  provider: string;
  ready: boolean;
  models: string[];
  readyModels: string[];
  defaultModel: string;
}

export function Chat() {
  const threads = useStore((s) => Object.values(s.threads).filter((t) => !t.archived));
  const allItems = useStore((s) => s.items);
  const [threadId, setThreadId] = useState<string>();
  const [text, setText] = useState("");
  const [config, setConfig] = useState<AgentConfig>();
  const [message, setMessage] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rpc.call("agent/config").then(setConfig).catch(() => {});
  }, []);

  const sorted = useMemo(() => [...threads].sort((a, b) => b.updatedAtUs - a.updatedAtUs), [threads]);
  const items = useMemo(
    () => Object.values(allItems).filter((i) => i.threadId === threadId).sort((a, b) => a.index - b.index),
    [allItems, threadId],
  );

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [items]);

  const sendMessage = async () => {
    const body = text.trim();
    if (!body) return;
    setMessage(undefined);
    try {
      let id = threadId;
      if (!id) {
        const thread = await rpc.call("thread/create", {});
        id = thread.id as string;
        setThreadId(id);
      }
      setText("");
      await rpc.call("thread/send", { threadId: id, text: body });
    } catch (error) {
      setMessage(errorText(error));
    }
  };

  const working = items.some((i) => i.status === "inProgress" || i.status === "running" || i.status === "streaming");

  return (
    <div className="chat">
      <div className="chat-threads">
        <button className="primary" onClick={() => setThreadId(undefined)}>
          New chat
        </button>
        <ul className="list">
          {sorted.map((t) => (
            <li key={t.id} className={t.id === threadId ? "active" : ""}>
              <button className="link" onClick={() => setThreadId(t.id)}>
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="chat-main">
        {config && !config.ready && (
          <div className="notice">
            The AI agent is not set up: provider “{config.provider}” is not ready. Add your own key with{" "}
            <code>dronex config set anthropic.key</code> (or <code>openai.key</code>) and restart DroneX.
          </div>
        )}
        <div className="chat-items">
          {items.length === 0 && (
            <div className="empty">
              Ask about your vehicles, for example “take off to 20 m and fly a 50 m square”. Anything that moves a vehicle asks you
              first.
            </div>
          )}
          {items.map((item) => (
            <ChatItem key={item.id} item={item} />
          ))}
          {working && <div className="muted small">Thinking…</div>}
          <div ref={bottom} />
        </div>
        <div className="composer">
          <textarea
            value={text}
            placeholder="Ask DroneX…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button className="primary" onClick={sendMessage} disabled={!text.trim()}>
            Send
          </button>
        </div>
        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}

function ChatItem({ item }: { item: any }) {
  if (item.kind === "userMessage") return <div className="bubble me">{item.text}</div>;
  if (item.kind === "agentMessage") return <div className="bubble agent">{item.text}</div>;
  if (item.kind === "toolCall")
    return (
      <div className="tool">
        <span className="mono">{item.method ?? "tool"}</span> <span className="muted small">{item.status}</span>
      </div>
    );
  if (item.kind === "error") return <div className="bubble error">{item.text}</div>;
  return null;
}
