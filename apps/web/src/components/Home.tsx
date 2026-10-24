import { useEffect, useState } from "react";
import { rpc, setState, useStore } from "../store";
import { errorText } from "../commands";

const VEHICLES = [
  ["multicopter", "Multicopter"],
  ["plane", "Plane"],
  ["vtol", "VTOL"],
  ["rover", "Rover"],
  ["boat", "Boat"],
  ["submarine", "Submarine"],
  ["airship", "Airship"],
] as const;

const PLACES = [
  { name: "ArduPilot's field, Canberra", lat: -35.363261, lon: 149.16523, ground: 584, heading: 353 },
  { name: "Golden Gate Park, San Francisco", lat: 37.769421, lon: -122.486214, ground: 60, heading: 270 },
  { name: "Hyde Park, London", lat: 51.507268, lon: -0.165742, ground: 30, heading: 90 },
  { name: "Berkeley Marina", lat: 37.866012, lon: -122.315285, ground: 3, heading: 0 },
];

interface Binary {
  program: string;
  vehicles: string[];
  frames: string[];
  defaultFrame: string;
}

function Card({ title, detail, onClick, tag }: { title: string; detail: string; onClick: () => void; tag?: string }) {
  return (
    <button className="start-card" onClick={onClick}>
      <div>
        <div className="title">
          {title} {tag && <span className="tag">{tag}</span>}
        </div>
        <div className="muted small">{detail}</div>
      </div>
      <span className="chevron">›</span>
    </button>
  );
}

export function Home({ go }: { go: (page: string) => void }) {
  const [panel, setPanel] = useState<"start" | "sim" | "connect">("start");
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const vehicles = useStore((s) => Object.values(s.vehicles).filter((v) => !v.dismissed));

  // A simulation form.
  const [vehicle, setVehicle] = useState("multicopter");
  const [place, setPlace] = useState(0);
  const [inAir, setInAir] = useState(30);
  const [startInAir, setStartInAir] = useState(true);
  const [speedup, setSpeedup] = useState(1);
  const [name, setName] = useState("");

  // A real vehicle.
  const [linkType, setLinkType] = useState<"udp-listen" | "tcp-client" | "serial">("udp-listen");
  const [host, setHost] = useState("0.0.0.0");
  const [port, setPort] = useState(14550);
  const [device, setDevice] = useState("");
  const [baud, setBaud] = useState(57600);
  const [serialPorts, setSerialPorts] = useState<{ device: string; description?: string }[]>([]);

  useEffect(() => {
    // The daemon looks for builds as it starts; ask again until it has.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const ask = () =>
      rpc
        .call("sim/binaries")
        .then((a) => {
          setBinaries(a.binaries ?? []);
          if (!a.binaries?.length && ++tries < 15) timer = setTimeout(ask, 2000);
        })
        .catch(() => {});
    ask();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (panel === "connect")
      rpc.call("serial/list").then((a) => setSerialPorts(a.ports ?? [])).catch(() => setSerialPorts([]));
  }, [panel]);

  const available = (kind: string) => binaries.some((b) => b.vehicles.includes(kind));

  const startSim = async (opts: { vehicle: string; place: (typeof PLACES)[number]; inAirM?: number; speedup: number; name?: string }) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const link = await rpc.call("sim/start", {
        vehicle: opts.vehicle,
        latitudeDeg: opts.place.lat,
        longitudeDeg: opts.place.lon,
        altitudeM: opts.place.ground,
        headingDeg: opts.place.heading,
        speedup: opts.speedup,
        ...(opts.inAirM ? { inAirM: opts.inAirM } : {}),
        ...(opts.name ? { name: opts.name } : {}),
      });
      setMessage(`Starting ${link.name}… it appears in the sidebar in a few seconds.`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      const kind =
        linkType === "serial"
          ? { type: "serial", device, baud }
          : { type: linkType, host, port };
      const link = await rpc.call("link/add", { kind });
      setMessage(`Added ${link.name ?? "the link"}. A vehicle appears once it sends a heartbeat.`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home">
      {panel === "start" && (
        <>
          <h1>How do you want to start?</h1>
          <div className="start-cards">
            <Card
              title="Start flying"
              tag="Quick start"
              detail={
                available("multicopter")
                  ? "A quadcopter already flying at 30 m over ArduPilot's field."
                  : "Needs a simulator build: run scripts/sitl.sh copter first."
              }
              onClick={() => startSim({ vehicle: "multicopter", place: PLACES[0], inAirM: 30, speedup: 1 })}
            />
            <Card title="New simulation" detail="Choose the vehicle, place and height." onClick={() => setPanel("sim")} />
            <Card title="Connect a real vehicle" detail="Over USB, a telemetry radio or the network." onClick={() => setPanel("connect")} />
            <Card title="Ask AI" detail="Ask about your vehicles or get help setting them up." onClick={() => go("chat")} />
          </div>
          {vehicles.length > 0 && (
            <div className="muted small">
              {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} connected. Pick one in the sidebar to fly it from the
              Cockpit.
            </div>
          )}
        </>
      )}

      {panel === "sim" && (
        <div className="form card">
          <button className="quiet" onClick={() => setPanel("start")}>
            ‹ Back
          </button>
          <h2>New simulation</h2>
          <label>
            Vehicle
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              {VEHICLES.map(([value, label]) => (
                <option key={value} value={value} disabled={!available(value)}>
                  {label}
                  {available(value) ? "" : " (no simulator build)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Where
            <select value={place} onChange={(e) => setPlace(Number(e.target.value))}>
              {PLACES.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={startInAir} onChange={(e) => setStartInAir(e.target.checked)} />
            Start flying at
            <input type="number" min={10} max={500} value={inAir} disabled={!startInAir} onChange={(e) => setInAir(Number(e.target.value))} />m
          </label>
          <label>
            Speed
            <select value={speedup} onChange={(e) => setSpeedup(Number(e.target.value))}>
              {[1, 2, 5, 10].map((s) => (
                <option key={s} value={s}>
                  {s}× real time
                </option>
              ))}
            </select>
          </label>
          <label>
            Name (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alpha" />
          </label>
          <button
            className="primary"
            disabled={busy || !available(vehicle)}
            onClick={() =>
              startSim({ vehicle, place: PLACES[place], inAirM: startInAir ? inAir : undefined, speedup, name: name.trim() || undefined })
            }
          >
            Start simulation
          </button>
          {binaries.length === 0 && (
            <div className="muted small">
              No simulator builds found. Build one with <code>scripts/sitl.sh copter</code> and restart DroneX.
            </div>
          )}
        </div>
      )}

      {panel === "connect" && (
        <div className="form card">
          <button className="quiet" onClick={() => setPanel("start")}>
            ‹ Back
          </button>
          <h2>Connect a real vehicle</h2>
          <label>
            How
            <select value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)}>
              <option value="udp-listen">Listen on UDP (telemetry radio via MAVProxy, companion computer)</option>
              <option value="tcp-client">Connect over TCP</option>
              <option value="serial">USB or serial radio</option>
            </select>
          </label>
          {linkType === "serial" ? (
            <>
              <label>
                Port
                <select value={device} onChange={(e) => setDevice(e.target.value)}>
                  <option value="">Choose…</option>
                  {serialPorts.map((p) => (
                    <option key={p.device} value={p.device}>
                      {p.description ? `${p.description} — ` : ""}
                      {p.device}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Baud
                <select value={baud} onChange={(e) => setBaud(Number(e.target.value))}>
                  {[57600, 115200, 921600].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <div className="row">
              <label className="grow">
                Host
                <input value={host} onChange={(e) => setHost(e.target.value)} />
              </label>
              <label>
                Port
                <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              </label>
            </div>
          )}
          <button className="primary" disabled={busy || (linkType === "serial" && !device)} onClick={connect}>
            Connect
          </button>
        </div>
      )}

      {message && <div className="message">{message}</div>}
      {vehicles.length > 0 && panel === "start" && (
        <button className="quiet small" onClick={() => setState({ selected: vehicles[0].id })}>
          Select {vehicles[0].name}
        </button>
      )}
    </div>
  );
}
