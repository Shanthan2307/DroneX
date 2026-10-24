import { rpc, setState, useStore, value } from "../store";
import { errorText, fmt } from "../commands";
import { useState } from "react";

export function Fleet() {
  const vehicles = useStore((s) => Object.values(s.vehicles).filter((v) => !v.dismissed));
  const links = useStore((s) => s.links);
  const positions = useStore((s) => s.positions);
  const state = useStore((s) => s);
  const selected = useStore((s) => s.selected);
  const [message, setMessage] = useState<string>();

  const stop = async (linkId: string, simulated: boolean) => {
    if (!window.confirm(simulated ? "Stop this simulated vehicle?" : "Disconnect this link?")) return;
    try {
      await rpc.call(simulated ? "sim/stop" : "link/remove", { id: linkId });
    } catch (error) {
      setMessage(errorText(error));
    }
  };

  return (
    <div className="fleet">
      <h2>Fleet</h2>
      {vehicles.length === 0 && <div className="empty">No vehicles yet. Start a simulation or connect one from Home.</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Altitude</th>
            <th>Battery</th>
            <th>Link</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const link = v.linkId ? links[v.linkId] : undefined;
            const simulated = link?.kind.type === "simulator";
            return (
              <tr key={v.id} className={selected === v.id ? "active" : ""} onClick={() => setState({ selected: v.id })}>
                <td>
                  <div className="strong">{v.name}</div>
                  <div className="muted small">
                    {v.vehicleType} · {v.firmware}
                  </div>
                </td>
                <td>
                  <span className={`badge ${v.presence === "online" ? "ok" : "warn"}`}>{v.presence}</span>{" "}
                  {v.armed && <span className="badge danger">Armed</span>}
                </td>
                <td>{v.mode ?? "—"}</td>
                <td>{fmt(positions[v.id]?.altitudeM, 1, "m")}</td>
                <td>{fmt(value(state, v.id, "battery.remaining_pct"), 0, "%")}</td>
                <td className="small">{link ? `${link.name ?? link.kind.type} (${link.status})` : "—"}</td>
                <td>
                  {link && (
                    <button
                      className="quiet"
                      onClick={(e) => {
                        e.stopPropagation();
                        stop(link.id, simulated);
                      }}
                    >
                      {simulated ? "Stop" : "Disconnect"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {message && <div className="message">{message}</div>}
    </div>
  );
}

export function Plugins() {
  const plugins = useStore((s) => Object.values(s.plugins));
  const [message, setMessage] = useState<string>();
  const toggle = async (id: string, enabled: boolean) => {
    try {
      await rpc.call("plugin/setEnabled", { id, enabled });
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  return (
    <div>
      <h2>Plugins</h2>
      <div className="muted small">
        Install more with <code>dronex plugin install &lt;folder&gt;</code>. Their values show in the vehicle's telemetry.
      </div>
      <ul className="list">
        {plugins.map((p) => (
          <li key={p.id}>
            <div>
              <div className="title">
                {p.name} <span className="muted small">{p.version}</span>
              </div>
              <div className="muted small">{p.description}</div>
            </div>
            <div className="row">
              <span className={`badge ${p.status === "running" ? "ok" : "warn"}`}>{p.status}</span>
              <button onClick={() => toggle(p.id, p.status === "off")}>{p.status === "off" ? "Turn on" : "Turn off"}</button>
            </div>
          </li>
        ))}
      </ul>
      {message && <div className="message">{message}</div>}
    </div>
  );
}
