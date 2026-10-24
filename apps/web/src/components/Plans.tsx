import { useState } from "react";
import { Plan, rpc, useStore } from "../store";
import { errorText, missionStart, send } from "../commands";

export function Plans({ preview, onPreview }: { preview?: string; onPreview: (id?: string) => void }) {
  const plans = useStore((s) => Object.values(s.plans));
  const selected = useStore((s) => s.selected);
  const vehicle = useStore((s) => (s.selected ? s.vehicles[s.selected] : undefined));
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  const importFile = async (file: File) => {
    setMessage(undefined);
    try {
      const text = await file.text();
      await rpc.call("plan/import", { vehicleType: "multicopter", files: [{ name: file.name, text }] });
      setMessage(`Imported ${file.name}`);
    } catch (error) {
      setMessage(errorText(error));
    }
  };

  const upload = async (plan: Plan, fly: boolean) => {
    if (!selected) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const check = await rpc.call("plan/check", { id: plan.id, vehicleId: selected });
      const errors = (check.checks ?? []).filter((c: any) => c.severity === "error");
      if (errors.length) throw new Error(errors.map((e: any) => e.message).join("; "));
      await rpc.call("plan/upload", { planId: plan.id, vehicleId: selected });
      if (fly) {
        if (!vehicle?.armed) throw new Error(`Uploaded. Take off first, then start the mission.`);
        await send(selected, { type: "set-mode", mode: "AUTO" });
        const receipt = await send(selected, missionStart);
        setMessage(receipt.status === "accepted" ? `Flying “${plan.name}”` : `Mission start: ${receipt.status}`);
      } else {
        setMessage(`Uploaded “${plan.name}” to ${vehicle?.name}`);
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (plan: Plan) => {
    if (!window.confirm(`Delete the plan “${plan.name}”?`)) return;
    try {
      await rpc.call("plan/delete", { id: plan.id });
    } catch (error) {
      setMessage(errorText(error));
    }
  };

  return (
    <div className="plans">
      <div className="row between">
        <div className="muted small">{plans.length} saved plan{plans.length === 1 ? "" : "s"}</div>
        <label className="button">
          Import .plan / .waypoints
          <input
            type="file"
            accept=".plan,.waypoints,.txt,.kml"
            hidden
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
        </label>
      </div>
      {plans.length === 0 && <div className="empty">No plans yet. Import one from QGroundControl or Mission Planner.</div>}
      <ul className="list">
        {plans.map((plan) => (
          <li key={plan.id} className={preview === plan.id ? "active" : ""}>
            <button className="link" onClick={() => onPreview(preview === plan.id ? undefined : plan.id)}>
              <div className="title">{plan.name}</div>
              <div className="muted small">
                {plan.items.length} items · {plan.vehicleType}
              </div>
            </button>
            <div className="row">
              <button disabled={!selected || busy} onClick={() => upload(plan, false)} title="Upload to the selected vehicle">
                Upload
              </button>
              <button className="primary" disabled={!selected || busy} onClick={() => upload(plan, true)}>
                Fly it
              </button>
              <button className="quiet" onClick={() => remove(plan)} title="Delete">
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      {message && <div className="message">{message}</div>}
    </div>
  );
}
