// What the page knows: the daemon's state (a `state/subscribe` snapshot kept
// current by `state/delta`) and each vehicle's live telemetry.

import { useRef, useSyncExternalStore } from "react";
import { Rpc } from "./rpc";

export interface Vehicle {
  id: string;
  name: string;
  linkId?: string;
  presence: "online" | "stale" | "offline" | string;
  armed: boolean;
  mode?: string;
  vehicleType?: string;
  autopilot?: string;
  firmware?: string;
  dismissed?: boolean;
}

export interface Link {
  id: string;
  name?: string;
  status: string;
  statusDetail?: string;
  kind: { type: string; [key: string]: unknown };
}

export interface Plan {
  id: string;
  name: string;
  vehicleType?: string;
  items: { command: number; latitudeDeg: number; longitudeDeg: number; altitudeM: number }[];
}

export interface Approval {
  id: string;
  clientName?: string;
  summary: string;
  method: string;
  state: string;
}

export interface Thread {
  id: string;
  title: string;
  model?: string;
  archived?: boolean;
  updatedAtUs: number;
}

export interface Item {
  id: string;
  threadId: string;
  index: number;
  kind: string;
  status: string;
  text?: string;
  method?: string;
  result?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  status: string;
  description?: string;
}

export interface TelemetryItem {
  key: string;
  label: string;
  unit: string;
  value?: number;
  text?: string;
  source: string;
}

export interface Position {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeM?: number;
  headingDeg?: number;
  groundSpeedMps?: number;
  climbMps?: number;
}

const ENTITIES = ["vehicle", "link", "plan", "approval", "thread", "item", "plugin", "operator"] as const;
type Entity = (typeof ENTITIES)[number];

export interface State {
  connection: "connecting" | "signing-in" | "connected" | "disconnected";
  operatorId?: string;
  vehicles: Record<string, Vehicle>;
  links: Record<string, Link>;
  plans: Record<string, Plan>;
  approvals: Record<string, Approval>;
  threads: Record<string, Thread>;
  items: Record<string, Item>;
  plugins: Record<string, Plugin>;
  operators: Record<string, { id: string; name: string }>;
  telemetry: Record<string, Record<string, TelemetryItem>>;
  positions: Record<string, Position>;
  trails: Record<string, [number, number][]>;
  selected?: string;
}

const PLURAL: Record<Entity, keyof State> = {
  vehicle: "vehicles",
  link: "links",
  plan: "plans",
  approval: "approvals",
  thread: "threads",
  item: "items",
  plugin: "plugins",
  operator: "operators",
};

let state: State = {
  connection: "connecting",
  vehicles: {},
  links: {},
  plans: {},
  approvals: {},
  threads: {},
  items: {},
  plugins: {},
  operators: {},
  telemetry: {},
  positions: {},
  trails: {},
};
const subscribers = new Set<() => void>();

export function getState(): State {
  return state;
}

export function setState(change: Partial<State> | ((s: State) => Partial<State>)) {
  const patch = typeof change === "function" ? change(state) : change;
  state = { ...state, ...patch };
  subscribers.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
};

/** Same items in the same order: a list a selector built again is not a change. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((item, i) => Object.is(item, b[i]));
}

/**
 * A value from the state. Selectors may build lists; the result is kept
 * while the state is the same, and while it comes out the same.
 */
export function useStore<T>(select: (s: State) => T): T {
  const cache = useRef<{ state?: State; value?: T }>({});
  return useSyncExternalStore(subscribe, () => {
    if (cache.current.state === state) return cache.current.value as T;
    const next = select(state);
    const value = "value" in cache.current && same(cache.current.value, next) ? (cache.current.value as T) : next;
    cache.current = { state, value };
    return value;
  });
}

export const rpc = new Rpc();

const byId = <T extends { id: string }>(list: T[] = []) =>
  Object.fromEntries(list.map((entry) => [entry.id, entry]));

const TRAIL_POINTS = 600;
const fusedSeen = new Set<string>();

/** Connects, says who this page is, and starts following the daemon. */
export async function start() {
  await rpc.connect();
  setState({ connection: "connected" });
  rpc.onClose = () => setState({ connection: "disconnected" });

  await rpc.call("initialize", {
    clientInfo: { name: "DroneX Web", version: "0.1.0", kind: "operator-ui" },
    capabilities: { protocolVersion: 1, binaryChannels: false, approvals: true, optOutNotifications: ["log/line"] },
  });

  rpc.on("state/delta", (params) => {
    setState((s) => {
      const patch: Partial<State> = {};
      for (const change of params.changes ?? []) {
        const key = PLURAL[change.entity as Entity];
        if (!key) continue;
        const current = { ...((patch[key] ?? s[key]) as Record<string, unknown>) };
        if (change.op === "remove") delete current[change.id];
        else current[change.id] = change[change.entity];
        (patch as any)[key] = current;
      }
      // The first vehicle heard is the one the cockpit flies.
      const vehicles = (patch.vehicles ?? s.vehicles) as Record<string, Vehicle>;
      if (!s.selected || !vehicles[s.selected] || vehicles[s.selected].dismissed) {
        patch.selected = Object.values(vehicles).find((v) => !v.dismissed)?.id;
      }
      return patch;
    });
  });

  rpc.on("telemetry/update", (params) => {
    setState((s) => {
      const id: string = params.vehicleId;
      const items = { ...(s.telemetry[id] ?? {}) };
      for (const item of params.items ?? []) items[item.key] = item;
      const patch: Partial<State> = { telemetry: { ...s.telemetry, [id]: items } };
      // The autopilot's own estimate. The GPS's arrives separately, with
      // only its height above the sea, and is used only without the other.
      const positions: any[] = params.positions ?? [];
      const fused =
        positions.find((p) => p.source === "fused") ?? (fusedSeen.has(id) ? undefined : positions[0]);
      if (fused?.source === "fused") fusedSeen.add(id);
      if (fused) {
        const relative = fused.altitudes?.find((a: any) => a.frame === "above-home") ?? fused.altitudes?.[0];
        const position: Position = {
          latitudeDeg: fused.latitudeDeg,
          longitudeDeg: fused.longitudeDeg,
          altitudeM: relative?.meters,
          headingDeg: fused.headingDeg,
          groundSpeedMps: fused.groundSpeedMps,
          climbMps: fused.climbMps,
        };
        const trail = [...(s.trails[id] ?? []), [position.latitudeDeg, position.longitudeDeg] as [number, number]];
        patch.positions = { ...s.positions, [id]: position };
        patch.trails = { ...s.trails, [id]: trail.slice(-TRAIL_POINTS) };
      }
      return patch;
    });
  });

  rpc.on("agent/itemDelta", (params) => {
    setState((s) => {
      const item = s.items[params.itemId];
      if (!item) return {};
      return { items: { ...s.items, [item.id]: { ...item, text: (item.text ?? "") + params.delta } } };
    });
  });

  const subscribed = await rpc.call("state/subscribe", { entities: ENTITIES });
  const snapshot = subscribed.snapshot ?? {};
  setState({
    vehicles: byId(snapshot.vehicles),
    links: byId(snapshot.links),
    plans: byId(snapshot.plans),
    approvals: byId(snapshot.approvals),
    threads: byId(snapshot.threads),
    items: byId(snapshot.items),
    plugins: byId(snapshot.plugins),
    operators: byId(snapshot.operators),
  });
  await rpc.call("telemetry/subscribe", {});
  await chooseOperator();

  const first = Object.values(getState().vehicles).find((v) => !v.dismissed);
  if (first) setState({ selected: first.id });
}

/** Commands are sent as an operator: the first one, or a new one. */
async function chooseOperator() {
  let operator = Object.values(getState().operators)[0];
  if (!operator) {
    operator = await rpc.call("operator/create", { name: "Pilot" });
  }
  await rpc.call("client/setOperator", { operatorId: operator.id });
  setState({ operatorId: operator.id });
}

/** A vehicle's telemetry value by key. */
export function value(s: State, vehicleId: string | undefined, key: string): number | undefined {
  return vehicleId ? s.telemetry[vehicleId]?.[key]?.value : undefined;
}
