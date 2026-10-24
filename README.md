# DroneX Core

The open-source runtime behind [DroneX](https://dronex.example). Connect MAVLink
vehicles, understand their telemetry and build tools for drones and robotics.

Written in Rust, Core brings vehicle connections, simulation and AI tools into
one local service. Use it from a terminal, connect your AI assistant over MCP,
or build your own application with its RPC contracts and plugin SDK.

[Try DroneX in your browser](https://app.dronex.example/?fly) · [Apache-2.0 license](LICENSE)

## What you can do

- **Connect real vehicles.** Work with ArduPilot and PX4 over serial, UDP or TCP,
  and forward MAVLink to other ground stations and tools.
- **Understand what is happening.** Read live telemetry, inspect vehicle messages
  and parameter descriptions, and record flights for later investigation.
- **Work in simulation.** Run ArduPilot and PX4 simulations to explore vehicle
  behaviour and try your integrations.
- **Bring your AI assistant.** Ask about telemetry, diagnose connection problems
  and investigate parameters through MCP. Vehicle commands and changes go through
  operator permissions and approvals.
- **Build something of your own.** Create plugins in JavaScript, TypeScript or
  Rust, or use the RPC interface for your own clients and workflows.

## Build and run

Install [Rust through rustup](https://rustup.rs). The repository pins the compiler
and WebAssembly target. On Debian or Ubuntu, also install `build-essential`,
`pkg-config` and `libudev-dev`.

```sh
git clone https://github.com/dronexhq/dronex-core.git
cd dronex-core
cargo build --locked -p dronex
cargo run --locked -p dronex -- --help
```

Start a headless service on macOS or Linux:

```sh
DRONEX_NO_TRAY=1 cargo run --locked -p dronex -- daemon
```

In PowerShell, set `$env:DRONEX_NO_TRAY = '1'`, then run
`cargo run --locked -p dronex -- daemon`.

In another terminal, from the same directory:

```sh
cargo run --locked -p dronex -- rpc call vehicle/list
```

An empty list means the service is running and waiting for a vehicle connection.

## Web app

`apps/web` is a browser interface for the daemon: start simulations, connect
vehicles, fly from the cockpit or by clicking the map, run missions, edit
parameters and talk to the agent. It needs [Node.js](https://nodejs.org).

```sh
cd apps/web && npm install && npm run build && cd ../..
DRONEX_NO_TRAY=1 cargo run --locked -p dronex -- daemon --ui-dir apps/web/dist
cargo run --locked -p dronex -- open
```

`dronex open` signs the browser in. For a simulator to fly, build one first
with `scripts/sitl.sh copter`. After `npm run build`, restart the daemon: it
reads the build's `version.json` once, at start.

The map needs no keys: satellite imagery and labels from Esri World Imagery,
streets from OpenStreetMap, and 3D ground heights from the
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) open data
set. Esri's free imagery is for development and non-commercial use; a product
needs an ArcGIS account, and heavy use of OpenStreetMap's tiles needs a tile
provider of your own.

To work on the app with live reload, run the daemon with `--dev` (it listens
on 45100 and trusts the dev server) and `npm run dev` in `apps/web`, then open
the link the daemon prints:

```sh
DRONEX_NO_TRAY=1 DRONEX_TERRAIN_URL=none cargo run --locked -p dronex -- --dev daemon
```

## Explore

| Start here                                  | What you will find                                    |
| ------------------------------------------- | ----------------------------------------------------- |
| [Command line](docs/site/cli.md)            | Inspect vehicles, read telemetry and script commands. |
| [AI assistants and MCP](docs/site/mcp.md)   | Connect an assistant and investigate your vehicles.   |
| [Plugin guide](docs/site/write-a-plugin.md) | Build and test your own plugins.                      |
| [RPC contracts](crates/dronex-contracts/)   | Types and fixtures for building a client.             |

MCP clients can launch `cargo run --locked -p dronex -- mcp` over stdio from
this directory. See the [CI workflow](.github/workflows/ci.yml) for build and test
commands.

## Contributing

Bug reports, ideas, documentation improvements and pull requests are welcome.
[Open an issue](https://github.com/dronexhq/dronex-core/issues) to share what you
are building or discuss a change. For bugs, include your platform, the DroneX
version and steps to reproduce the problem.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE) and [third-party notices](THIRD_PARTY.md).
