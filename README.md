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
