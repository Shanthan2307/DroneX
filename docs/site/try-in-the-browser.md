---
title: Try it in the browser
order: 1
group: Get started
summary: Start a simulated flight, then connect to DroneX on your computer.
---

Try a simulated vehicle before connecting hardware.

1. Open [app.dronex.example](https://app.dronex.example) in Chrome and choose **Try a simulation**. Nothing to install. If DroneX was connected but stopped, the button is **Start simulation**.
2. A simulated VTOL plane starts in flight over Y Combinator's parking lot in Dogpatch, San Francisco. If a simulation is already running, DroneX keeps it instead of starting another.
3. Read [Telemetry, Cockpit and Messages](/docs/telemetry-and-control), then use **Cockpit** to try a command and see its receipt. Use **Stop simulation** there to finish.

Choose **Simulated vehicle** under **Fleet** to select another type and starting place. The simulation runs in this browser; keep its page open while using it.

## Connect the browser to this computer

To connect a real vehicle or use a coding agent's MCP tools, [install DroneX](/docs/install). Choose **Connect to DroneX on this computer** on the home page or in **Settings**.

Chrome may ask to let the page reach DroneX on this computer. DroneX then shows the same six-digit code with **Allow**. Once allowed, the page reconnects automatically. Safari cannot reach DroneX this way; open the app from DroneX instead.

The menu at the top left shows whether you are using **Browser** or **Computer**. Check it if a vehicle appears in one place but not in your MCP session.

The in-app AI chat is currently hidden in production. You can use an external coding agent through [MCP](/docs/mcp).
