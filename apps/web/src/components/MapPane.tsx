import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getState, setState, useStore } from "../store";
import { errorText, send } from "../commands";

// ArduPilot's usual field, until a vehicle reports where it is.
const DEFAULT_CENTER: [number, number] = [-35.363261, 149.16523];

function vehicleIcon(heading: number, selected: boolean, armed: boolean) {
  const color = armed ? "var(--danger)" : selected ? "var(--accent)" : "var(--muted)";
  return L.divIcon({
    className: "vehicle-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<svg viewBox="0 0 34 34" width="34" height="34" style="transform: rotate(${heading}deg)">
      <circle cx="17" cy="17" r="15" fill="var(--surface)" stroke="${color}" stroke-width="2"/>
      <path d="M17 6 L24 25 L17 21 L10 25 Z" fill="${color}"/>
    </svg>`,
  });
}

export function MapPane({ planPreview }: { planPreview?: [number, number][] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const layers = useRef<{ markers: Record<string, L.Marker>; trails: Record<string, L.Polyline>; plan?: L.Polyline }>({
    markers: {},
    trails: {},
  });
  const centered = useRef(false);
  const [target, setTarget] = useState<{ lat: number; lng: number }>();
  const [altitude, setAltitude] = useState(30);
  const [status, setStatus] = useState<string>();

  const vehicles = useStore((s) => s.vehicles);
  const positions = useStore((s) => s.positions);
  const trails = useStore((s) => s.trails);
  const selected = useStore((s) => s.selected);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = L.map(container.current, { zoomControl: true }).setView(DEFAULT_CENTER, 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    m.on("click", (event: L.LeafletMouseEvent) => {
      if (getState().selected) setTarget({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    map.current = m;
    // The pane can change size as the layout settles.
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(container.current);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const { markers, trails: lines } = layers.current;
    for (const [id, position] of Object.entries(positions)) {
      const vehicle = vehicles[id];
      if (!vehicle || vehicle.dismissed) continue;
      const at: [number, number] = [position.latitudeDeg, position.longitudeDeg];
      const icon = vehicleIcon(position.headingDeg ?? 0, id === selected, vehicle.armed);
      if (markers[id]) {
        markers[id].setLatLng(at).setIcon(icon);
      } else {
        markers[id] = L.marker(at, { icon, title: vehicle.name })
          .addTo(m)
          .on("click", () => setState({ selected: id }));
      }
      markers[id].bindTooltip(vehicle.name, { direction: "top", offset: [0, -16] });
      const trail = trails[id] ?? [];
      if (lines[id]) lines[id].setLatLngs(trail);
      else lines[id] = L.polyline(trail, { color: "#3b82f6", weight: 2, opacity: 0.7 }).addTo(m);
      if (!centered.current) {
        m.setView(at, 17);
        centered.current = true;
      }
    }
    for (const id of Object.keys(markers)) {
      if (!vehicles[id] || vehicles[id].dismissed || !positions[id]) {
        markers[id].remove();
        lines[id]?.remove();
        delete markers[id];
        delete lines[id];
      }
    }
  }, [vehicles, positions, trails, selected]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.plan?.remove();
    layers.current.plan = undefined;
    if (planPreview && planPreview.length) {
      layers.current.plan = L.polyline(planPreview, { color: "#f59e0b", weight: 3, dashArray: "6 6" }).addTo(m);
      m.fitBounds(layers.current.plan.getBounds(), { padding: [30, 30], maxZoom: 18 });
    }
  }, [planPreview]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(undefined), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const follow = () => {
    const position = selected ? positions[selected] : undefined;
    if (position && map.current) map.current.setView([position.latitudeDeg, position.longitudeDeg]);
  };

  const flyHere = async () => {
    if (!selected || !target) return;
    setStatus("Sending…");
    try {
      const receipt = await send(selected, {
        type: "go-to",
        latitudeDeg: target.lat,
        longitudeDeg: target.lng,
        altitudeM: altitude,
        altitudeFrame: "above-home",
      });
      setStatus(receipt.status === "accepted" ? "On its way" : `Not accepted: ${receipt.status}`);
      setTarget(undefined);
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  return (
    <div className="map-pane">
      <div ref={container} className="map" />
      <div className="map-tools">
        <button className="chip" onClick={follow} disabled={!selected || !positions[selected]}>
          Centre on vehicle
        </button>
        {status && <span className="chip quiet">{status}</span>}
      </div>
      {target && selected && (
        <div className="fly-here card">
          <div className="fly-here-title">Fly {vehicles[selected]?.name} here?</div>
          <div className="muted small">
            {target.lat.toFixed(6)}, {target.lng.toFixed(6)}
          </div>
          <label className="row">
            Height above home
            <input
              type="number"
              min={2}
              max={500}
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
            />
            m
          </label>
          <div className="row end">
            <button onClick={() => setTarget(undefined)}>Cancel</button>
            <button className="primary" onClick={flyHere}>
              Fly here
            </button>
          </div>
          <div className="muted small">Switches to GUIDED. The vehicle must be armed and flying.</div>
        </div>
      )}
    </div>
  );
}
