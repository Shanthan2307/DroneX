import { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibre, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getState, setState, useStore } from "../store";
import { errorText, send } from "../commands";

// ArduPilot's usual field, until a vehicle reports where it is.
const DEFAULT_CENTER: [number, number] = [149.16523, -35.363261];

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

// Keyless sources: Esri's imagery and labels, OpenStreetMap, and the AWS
// Open Data terrain tiles (SRTM, Copernicus/ESA, GMTED, ETOPO and national
// surveys, merged by Mapzen) for ground heights.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        "Imagery: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community",
    },
    roads: {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
    },
    places: {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Labels: Esri, TomTom, Garmin, FAO, NOAA, USGS",
    },
    streets: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
    terrain: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15,
      attribution:
        "Ground heights: AWS Terrain Tiles (SRTM, Copernicus DEM © DLR e.V. / Airbus, ESA, GMTED, ETOPO1, USGS NED and others)",
    },
    hillshade: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "streets", type: "raster", source: "streets", layout: { visibility: "none" } },
    {
      id: "hillshade",
      type: "hillshade",
      source: "hillshade",
      layout: { visibility: "none" },
      paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#3d3d3d" },
    },
    { id: "roads", type: "raster", source: "roads", paint: { "raster-opacity": 0.8 } },
    { id: "places", type: "raster", source: "places" },
  ],
  sky: {
    "sky-color": "#8fb8e8",
    "horizon-color": "#d8e6f3",
    "fog-color": "#e7eef5",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.4,
  },
};

type Basemap = "satellite" | "streets";

const empty = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };

/** A square around a point, `size` metres across, for extrusions. */
function square(lon: number, lat: number, size: number): number[][][] {
  const dLat = size / 2 / 111320;
  const dLon = size / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [
      [lon - dLon, lat - dLat],
      [lon + dLon, lat - dLat],
      [lon + dLon, lat + dLat],
      [lon - dLon, lat + dLat],
      [lon - dLon, lat - dLat],
    ],
  ];
}

/** Moves the camera: animated on a flat map, at once over terrain. */
function move(m: MapLibre, to: { center: [number, number] }, duration: number) {
  if (m.getTerrain()) m.jumpTo(to);
  else m.easeTo({ ...to, duration });
}

function markerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vehicle-marker";
  el.innerHTML = `<svg viewBox="0 0 34 34" width="34" height="34">
    <circle cx="17" cy="17" r="15" class="ring"/>
    <path d="M17 6 L24 25 L17 21 L10 25 Z" class="arrow"/>
  </svg>`;
  return el;
}

export function MapPane({ planPreview }: { planPreview?: [number, number][] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre>();
  const markers = useRef<Record<string, Marker>>({});
  const centered = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [threeD, setThreeD] = useState(false);
  const threeDNow = useRef(false);
  const [follow, setFollow] = useState(false);
  const [target, setTarget] = useState<{ lat: number; lng: number }>();
  const [altitude, setAltitude] = useState(30);
  const [status, setStatus] = useState<string>();

  const vehicles = useStore((s) => s.vehicles);
  const positions = useStore((s) => s.positions);
  const trails = useStore((s) => s.trails);
  const selected = useStore((s) => s.selected);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: DEFAULT_CENTER,
      zoom: 17,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      m.addSource("trails", { type: "geojson", data: empty });
      m.addSource("plan", { type: "geojson", data: empty });
      m.addSource("columns", { type: "geojson", data: empty });
      m.addLayer({
        id: "trails",
        type: "line",
        source: "trails",
        paint: { "line-color": "#60a5fa", "line-width": 3, "line-opacity": 0.85 },
      });
      m.addLayer({
        id: "plan",
        type: "line",
        source: "plan",
        paint: { "line-color": "#f59e0b", "line-width": 3, "line-dasharray": [2, 2] },
      });
      // The vehicle at its height: a thin column from the ground and a box
      // where it flies. Extrusions sit on the terrain, so the height above
      // home reads as the height above the ground near home.
      m.addLayer({
        id: "columns",
        type: "fill-extrusion",
        source: "columns",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "top"],
          "fill-extrusion-opacity": 0.9,
        },
      });
      // The credits start folded behind their ⓘ, not over the map.
      container.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");
      setLoaded(true);
    });
    m.on("click", (event) => {
      if (getState().selected) setTarget({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
    m.on("dragstart", () => setFollow(false));
    map.current = m;
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(container.current);
    return () => resize.disconnect();
  }, []);

  // The base map.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const satellite = basemap === "satellite";
    m.setLayoutProperty("satellite", "visibility", satellite ? "visible" : "none");
    m.setLayoutProperty("roads", "visibility", satellite ? "visible" : "none");
    m.setLayoutProperty("places", "visibility", satellite ? "visible" : "none");
    m.setLayoutProperty("streets", "visibility", satellite ? "none" : "visible");
  }, [basemap, loaded]);

  // 3D: the ground's real shape, shading, and a tilted camera.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    // MapLibre freezes the camera's ground height while it animates over
    // terrain and thaws it when the animation ends; one cut short leaves it
    // at sea level, which on high ground is inside the hill, and nothing
    // draws. So the camera animates only while there is no terrain: it
    // tilts first and the ground rises after, and it lies flat after the
    // ground is gone. Over terrain it only jumps (`jump` below).
    threeDNow.current = threeD;
    if (threeD) {
      m.setLayoutProperty("hillshade", "visibility", "visible");
      m.easeTo({ pitch: 65, duration: 700 });
      m.once("moveend", () => {
        if (!threeDNow.current) return; // Turned off again meanwhile.
        m.setTerrain({ source: "terrain", exaggeration: 1 });
        m.jumpTo({ center: m.getCenter() });
      });
    } else {
      m.setTerrain(null);
      m.setLayoutProperty("hillshade", "visibility", "none");
      m.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
  }, [threeD, loaded]);

  // Vehicles, their trails and their heights.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const shown = Object.entries(positions).filter(([id]) => vehicles[id] && !vehicles[id].dismissed);
    const columns: GeoJSON.Feature[] = [];
    for (const [id, position] of shown) {
      const vehicle = vehicles[id];
      const at: [number, number] = [position.longitudeDeg, position.latitudeDeg];
      let marker = markers.current[id];
      if (!marker) {
        const element = markerElement();
        element.addEventListener("click", (e) => {
          e.stopPropagation();
          setState({ selected: id });
        });
        marker = new maplibregl.Marker({ element, rotationAlignment: "map", pitchAlignment: "map" })
          .setLngLat(at)
          .addTo(m);
        markers.current[id] = marker;
      }
      marker.setLngLat(at).setRotation(position.headingDeg ?? 0);
      const element = marker.getElement();
      element.title = vehicle.name;
      element.classList.toggle("selected", id === selected);
      element.classList.toggle("armed", vehicle.armed);

      const height = Math.max(0, position.altitudeM ?? 0);
      const color = vehicle.armed ? "#ef4444" : id === selected ? "#3b82f6" : "#9ca3af";
      if (height > 1) {
        columns.push({
          type: "Feature",
          properties: { base: 0, top: height, color: "#e5e7eb" },
          geometry: { type: "Polygon", coordinates: square(at[0], at[1], 0.4) },
        });
      }
      columns.push({
        type: "Feature",
        properties: { base: Math.max(0, height - 0.6), top: height + 0.6, color },
        geometry: { type: "Polygon", coordinates: square(at[0], at[1], 2.5) },
      });
      if ((!centered.current || (follow && id === selected)) && !target) {
        move(m, { center: at }, centered.current ? 300 : 0);
        centered.current = true;
      }
    }
    for (const id of Object.keys(markers.current)) {
      if (!shown.some(([shownId]) => shownId === id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    }
    (m.getSource("columns") as GeoJSONSource).setData({ type: "FeatureCollection", features: columns });
    (m.getSource("trails") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: shown
        .map(([id]) => trails[id] ?? [])
        .filter((trail) => trail.length > 1)
        .map((trail) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: trail.map(([lat, lon]) => [lon, lat]) },
        })),
    });
  }, [vehicles, positions, trails, selected, loaded, follow, target]);

  // A plan's route.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const path = planPreview ?? [];
    (m.getSource("plan") as GeoJSONSource).setData(
      path.length > 1
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: path.map(([lat, lon]) => [lon, lat]) },
          }
        : empty,
    );
    if (path.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      path.forEach(([lat, lon]) => bounds.extend([lon, lat]));
      m.fitBounds(bounds, { padding: 40, maxZoom: 18, duration: m.getTerrain() ? 0 : 600 });
    }
  }, [planPreview, loaded]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(undefined), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const centre = () => {
    const position = selected ? positions[selected] : undefined;
    if (position && map.current) {
      move(map.current, { center: [position.longitudeDeg, position.latitudeDeg] }, 500);
      setFollow(true);
    }
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
        <div className="segmented">
          <button className={basemap === "satellite" ? "active" : ""} onClick={() => setBasemap("satellite")}>
            Satellite
          </button>
          <button className={basemap === "streets" ? "active" : ""} onClick={() => setBasemap("streets")}>
            Streets
          </button>
        </div>
        <button className={`chip ${threeD ? "on" : ""}`} onClick={() => setThreeD((on) => !on)} title="Terrain and a tilted view">
          3D
        </button>
        <button
          className={`chip ${follow ? "on" : ""}`}
          onClick={() => (follow ? setFollow(false) : centre())}
          disabled={!selected || !positions[selected]}
        >
          {follow ? "Following" : "Follow"}
        </button>
      </div>
      {status && <div className="map-status chip quiet">{status}</div>}
      {target && selected && (
        <div className="fly-here card">
          <div className="fly-here-title">Fly {vehicles[selected]?.name} here?</div>
          <div className="muted small">
            {target.lat.toFixed(6)}, {target.lng.toFixed(6)}
          </div>
          <label className="row">
            Height above home
            <input type="number" min={2} max={500} value={altitude} onChange={(e) => setAltitude(Number(e.target.value))} />m
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
