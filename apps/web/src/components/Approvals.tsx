import { rpc, useStore } from "../store";

/** What the agent, MCP clients or plugins are waiting for the operator to allow. */
export function Approvals() {
  const pending = useStore((s) => Object.values(s.approvals).filter((a) => a.state === "pending"));
  if (pending.length === 0) return null;
  const resolve = (id: string, allow: boolean) => rpc.call("approval/resolve", { id, allow }).catch(() => {});
  return (
    <div className="approvals">
      {pending.map((a) => (
        <div key={a.id} className="card approval">
          <div className="strong">{a.clientName ?? "Something"} asks to:</div>
          <div>{a.summary}</div>
          <div className="row end">
            <button onClick={() => resolve(a.id, false)}>Deny</button>
            <button className="primary" onClick={() => resolve(a.id, true)}>
              Allow
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
