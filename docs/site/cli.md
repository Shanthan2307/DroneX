---
title: The command line
order: 5
group: Debug and integrate
summary: Use read-only checks, scripts and commands from a terminal.
---

Use the command line to script DroneX, run it without a window, or work over SSH. [Install DroneX](/docs/install) first.

## Check the connection

These commands read state without changing the vehicle:

```sh
dronex --version
dronex status
dronex ports
dronex rpc call daemon/about
dronex rpc call link/list
dronex rpc call vehicle/list
```

`status` shows the data directory and whether DroneX is running there. `ports` shows listeners and conflicts. `vehicle/list` returns the vehicle IDs used by other commands.

If you started DroneX with `--dev` or a custom `--data-dir`, use the same option for your CLI and MCP connection. Otherwise they read a different installation's state.

## Open DroneX

`dronex open` starts or reuses DroneX and follows **When I open DroneX** from
Settings. Explicit actions leave that preference unchanged:

```sh
dronex open --window
dronex open --browser
dronex open --print
```

`--print` prints the browser address without opening it. `dronex daemon start`
starts DroneX in the background without a window. `dronex mcp` only connects to
an already running DroneX; start it yourself before connecting an AI agent.

## Read one vehicle

Copy a vehicle ID from `vehicle/list` in place of `VEHICLE_ID`:

```sh
dronex rpc call telemetry/get --json '{"id":"VEHICLE_ID"}'
dronex rpc call vehicle/messages --json '{"vehicleId":"VEHICLE_ID"}'
dronex vehicle history VEHICLE_ID
```

For connection or stale-value problems, follow [Troubleshooting](/docs/troubleshooting). For an agent that compares readings over time, follow [Use with AI agents](/docs/mcp).

## Find a simulation's starting place

Search names and addresses through the same hosted API as the Starting point
picker:

```sh
dronex rpc call place/search --json '{"query":"Queenstown, New Zealand","limit":5}'
```

Choose the intended region from `suggestions`. Pass that suggestion's exact
`key`, `text` and `near` hint, if present, to `place/locate`:

```sh
dronex rpc call place/locate --json '{"key":"CHOSEN_KEY","text":"CHOSEN_TEXT"}'
```

The result's `place` contains `latitudeDeg` and `longitudeDeg`. Read `terrain/at`
at those coordinates for the ground elevation, then use them and that height with
`sim/start`. Searching and locating read data only; they never start a simulation
or save a place. Both respect the selected operator's place-name search setting.
See [Use with AI agents](/docs/mcp#choose-a-simulation-s-starting-place) for MCP.

## Send a command

Choose the target explicitly when more than one vehicle is connected. Read the command's receipt to see whether DroneX refused it, the vehicle rejected it, or the vehicle accepted it. Acceptance does not prove the action has finished: check the resulting telemetry and messages.

```sh
dronex command --vehicle VEHICLE_ID arm
dronex command --vehicle VEHICLE_ID disarm
```

In a terminal, a command the app would confirm, such as arm, asks first. A script is not asked, but a dangerous command, such as disarming in flight, is sent only with `--yes`.

See [Confirmations](/docs/confirmations) before issuing commands.

## Find the remaining commands

```sh
dronex --help
dronex sim start --help
dronex params definitions --help
dronex video --help
```

Each subcommand lists its flags and examples. Remote watch and control workflows are still in preview; their availability depends on the build and account configuration.
