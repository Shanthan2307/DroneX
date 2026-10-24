import { useEffect, useState } from "react";
import { rpc, useStore, value } from "../store";
import { Command, errorText, fmt, missionStart, send, takeoff } from "../commands";

interface Mode {
  mode: string;
  description: string;
  advanced?: boolean;
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="readout">
      <div className="readout-label">{label}</div>
      <div className="readout-value">{children}</div>
    </div>
  );
}

export function Cockpit() {
  const selected = useStore((s) => s.selected);
  const vehicle = useStore((s) => (s.selected ? s.vehicles[s.selected] : undefined));
  const position = useStore((s) => (s.selected ? s.positions[s.selected] : undefined));
  const battery = useStore((s) => value(s, s.selected, "battery.remaining_pct"));
  const voltage = useStore((s) => value(s, s.selected, "battery.voltage_v"));
  const satellites = useStore((s) => value(s, s.selected, "gps.satellites"));
  const fix = useStore((s) => value(s, s.selected, "gps.fix_type"));
  const airTime = useStore((s) => value(s, s.selected, "flight.air_s"));
  const throttle = useStore((s) => value(s, s.selected, "throttle.output_pct"));

  const [modes, setModes] = useState<Mode[]>([]);
  const [altitude, setAltitude] = useState(20);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setModes([]);
    setMessage(undefined);
    if (!selected) return;
    rpc
      .call("command/modes", { vehicleId: selected })
      .then((answer) => {
        const family = answer.families?.find((f: any) => f.key === answer.vehicleFamily) ?? answer.families?.[0];
        setModes(family?.modes ?? []);
      })
      .catch(() => setModes([]));
  }, [selected]);

  if (!vehicle) {
    return <div className="empty">Choose a vehicle in the sidebar, or start a simulation from Home.</div>;
  }

  const run = async (label: string, command: Command, question?: string) => {
    if (question && !window.confirm(question)) return;
    setBusy(label);
    setMessage(undefined);
    try {
      const receipt = await send(vehicle.id, command);
      setMessage(receipt.status === "accepted" ? `${label}: accepted` : `${label}: ${receipt.status}`);
    } catch (error) {
      setMessage(`${label}: ${errorText(error)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const armAndTakeOff = async () => {
    if (!window.confirm(`Arm ${vehicle.name} and take off to ${altitude} m? The propellers will spin.`)) return;
    setBusy("Take off");
    setMessage(undefined);
    try {
      // ArduPilot takes off only in GUIDED, and disarms by itself if it
      // waits too long, so the three go together.
      await send(vehicle.id, { type: "set-mode", mode: "GUIDED" });
      const armed = await send(vehicle.id, { type: "arm" });
      if (armed.status !== "accepted") throw new Error(`arming was ${armed.status}`);
      const receipt = await send(vehicle.id, takeoff(altitude));
      setMessage(receipt.status === "accepted" ? `Taking off to ${altitude} m` : `Take off: ${receipt.status}`);
    } catch (error) {
      setMessage(`Take off: ${errorText(error)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const online = vehicle.presence === "online";

  return (
    <div className="cockpit">
      <div className="cockpit-head">
        <div>
          <div className="title">{vehicle.name}</div>
          <div className="muted small">
            {vehicle.vehicleType ?? "Vehicle"} · {vehicle.autopilot ?? ""} {vehicle.firmware ?? ""}
          </div>
        </div>
        <div className="badges">
          <span className={`badge ${online ? "ok" : "warn"}`}>{vehicle.presence}</span>
          <span className={`badge ${vehicle.armed ? "danger" : ""}`}>{vehicle.armed ? "Armed" : "Disarmed"}</span>
          <span className="badge">{vehicle.mode ?? "—"}</span>
        </div>
      </div>

      <div className="readouts">
        <Readout label="Altitude">{fmt(position?.altitudeM, 1, "m")}</Readout>
        <Readout label="Ground speed">{fmt(position?.groundSpeedMps, 1, "m/s")}</Readout>
        <Readout label="Climb">{fmt(position?.climbMps, 1, "m/s")}</Readout>
        <Readout label="Heading">{fmt(position?.headingDeg, 0, "°")}</Readout>
        <Readout label="Battery">
          {fmt(battery, 0, "%")} <span className="muted small">{fmt(voltage, 1, "V")}</span>
        </Readout>
        <Readout label="GPS">
          {satellites != null ? `${satellites} sats` : "—"}{" "}
          <span className="muted small">{fix != null ? (fix >= 3 ? "3D fix" : "no fix") : ""}</span>
        </Readout>
        <Readout label="Throttle">{fmt(throttle, 0, "%")}</Readout>
        <Readout label="Time in air">{airTime != null ? `${Math.floor(airTime / 60)}:${String(Math.floor(airTime % 60)).padStart(2, "0")}` : "—"}</Readout>
      </div>

      <div className="controls">
        {!vehicle.armed ? (
          <div className="row">
            <button className="primary" disabled={!!busy || !online} onClick={armAndTakeOff}>
              {busy === "Take off" ? "Taking off…" : "Arm and take off"}
            </button>
            <input type="number" min={2} max={120} value={altitude} onChange={(e) => setAltitude(Number(e.target.value))} />
            <span className="muted">m</span>
            <button disabled={!!busy || !online} onClick={() => run("Arm", { type: "arm" }, `Arm ${vehicle.name}? The propellers may spin.`)}>
              Arm only
            </button>
          </div>
        ) : (
          <div className="row wrap">
            <button disabled={!!busy} onClick={() => run("Land", { type: "land" })}>
              Land
            </button>
            <button disabled={!!busy} onClick={() => run("Return home", { type: "rtl" })}>
              Return home
            </button>
            <button disabled={!!busy} onClick={() => run("Mission", missionStart)}>
              Start mission
            </button>
            <button
              className="danger"
              disabled={!!busy}
              onClick={() => run("Disarm", { type: "disarm" }, `Disarm ${vehicle.name}? If it is flying, it will fall.`)}
            >
              Disarm
            </button>
          </div>
        )}
        <div className="row">
          <label className="muted">Mode</label>
          <select
            value=""
            disabled={!!busy || !online || modes.length === 0}
            onChange={(e) => e.target.value && run(`Mode ${e.target.value}`, { type: "set-mode", mode: e.target.value })}
          >
            <option value="">Change mode…</option>
            {modes
              .filter((m) => !m.advanced)
              .map((m) => (
                <option key={m.mode} value={m.mode} title={m.description}>
                  {m.mode} — {m.description}
                </option>
              ))}
          </select>
        </div>
        <div className="muted small">Tip: click the map to fly the vehicle there.</div>
        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}
