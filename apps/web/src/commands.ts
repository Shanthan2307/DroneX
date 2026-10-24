// Vehicle commands as the `Command` contract has them (see `action_json` in
// crates/dronex/src/cli/mod.rs), and a few helpers the pages share.

import { Plan, rpc } from "./store";

export type Command =
  | { type: "arm" }
  | { type: "disarm" }
  | { type: "land" }
  | { type: "rtl" }
  | { type: "set-mode"; mode: string }
  | { type: "go-to"; latitudeDeg: number; longitudeDeg: number; altitudeM: number; altitudeFrame: "above-home" }
  | { type: "long"; command: number; params: number[] };

export const takeoff = (altitudeM: number): Command => ({
  type: "long",
  command: 22,
  params: [0, 0, 0, 0, 0, 0, altitudeM],
});

export const missionStart: Command = { type: "long", command: 300, params: [0, 0] };

export interface Receipt {
  status: string;
  detail?: string;
  statusText?: string;
}

/** Sends a command the person has already confirmed. */
export async function send(vehicleId: string, command: Command): Promise<Receipt> {
  return rpc.call<Receipt>("command/send", { vehicleId, command, confirm: true });
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function fmt(value: number | undefined, digits = 1, unit = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

// Items that are places on the map (not takeoff, RTL or settings).
const PLACE_COMMANDS = new Set([16, 17, 18, 19, 21, 82]);

export function planPath(plan?: Plan): [number, number][] {
  return (plan?.items ?? [])
    .filter((item) => PLACE_COMMANDS.has(item.command) && (item.latitudeDeg !== 0 || item.longitudeDeg !== 0))
    .map((item) => [item.latitudeDeg, item.longitudeDeg]);
}
