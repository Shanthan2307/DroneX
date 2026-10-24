import { useEffect, useState } from "react";
import { exchangeBootstrap, Pairing, pollPairing, sessionPaired, startPairing } from "./rpc";
import { setState, start, useStore } from "./store";
import { errorText, planPath } from "./commands";
import { MapPane } from "./components/MapPane";
import { Cockpit } from "./components/Cockpit";
import { Plans } from "./components/Plans";
import { Parameters } from "./components/Parameters";
import { Home } from "./components/Home";
import { Fleet, Plugins } from "./components/Fleet";
import { Chat } from "./components/Chat";
import { Approvals } from "./components/Approvals";

const PAGES = [
  ["home", "Home"],
  ["fleet", "Fleet"],
  ["plans", "Plans"],
  ["parameters", "Parameters"],
  ["plugins", "Plugins"],
  ["chat", "Ask AI"],
] as const;
type Page = (typeof PAGES)[number][0];

/** Signs in with `?bootstrap=` or pairing, then connects. */
function useConnection() {
  const [phase, setPhase] = useState<"checking" | "pairing" | "ready" | "failed">("checking");
  const [pairing, setPairing] = useState<Pairing>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const url = new URL(location.href);
        const bootstrap = url.searchParams.get("bootstrap");
        if (bootstrap) {
          url.searchParams.delete("bootstrap");
          history.replaceState(null, "", url);
          await exchangeBootstrap(bootstrap);
        }
        if (!(await sessionPaired())) {
          setPhase("pairing");
          const asked = await startPairing();
          setPairing(asked);
          for (;;) {
            await new Promise((r) => setTimeout(r, 1000));
            if (stopped) return;
            const answer = await pollPairing(asked.id);
            if (answer === "approved") break;
            if (answer !== "pending") throw new Error(answer === "denied" ? "Pairing was denied." : "Pairing expired.");
          }
        }
        setState({ connection: "connecting" });
        await start();
        setPhase("ready");
        // The daemon keeps an interface that says it booted.
        fetch("/interface/ready", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: __BUILD_ID__ }),
        }).catch(() => {});
      } catch (e) {
        setError(errorText(e));
        setPhase("failed");
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  return { phase, pairing, error };
}

function SignIn({ phase, pairing, error }: ReturnType<typeof useConnection>) {
  const command = pairing
    ? `dronex rpc call pairing/approve --json '{"code":"${pairing.code}"}'`
    : undefined;
  return (
    <div className="signin">
      <div className="card">
        <div className="brand big">DroneX</div>
        {phase === "checking" && <p>Connecting to DroneX on this computer…</p>}
        {phase === "pairing" && pairing && (
          <>
            <p>Allow this browser to control DroneX. The code is</p>
            <div className="code">{pairing.code}</div>
            <p className="muted small">Approve it in a terminal on this computer:</p>
            <pre className="mono small">{command}</pre>
            <p className="muted small">
              Or open the page with <code>dronex open</code>, which signs it in for you.
            </p>
          </>
        )}
        {phase === "failed" && (
          <>
            <p className="error">{error}</p>
            <p className="muted small">
              Start it with <code>dronex daemon --dev</code> and reload this page.
            </p>
            <button onClick={() => location.reload()}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}

function Sidebar({ page, go }: { page: Page; go: (p: Page) => void }) {
  const vehicles = useStore((s) => Object.values(s.vehicles).filter((v) => !v.dismissed));
  const selected = useStore((s) => s.selected);
  const connection = useStore((s) => s.connection);
  return (
    <nav className="sidebar">
      <div className="brand">DroneX</div>
      {PAGES.map(([id, label]) => (
        <button key={id} className={`nav ${page === id ? "active" : ""}`} onClick={() => go(id)}>
          {label}
        </button>
      ))}
      <div className="section-title">Fleet</div>
      {vehicles.length === 0 && <div className="muted small pad">No vehicles yet</div>}
      {vehicles.map((v) => (
        <button key={v.id} className={`nav vehicle ${selected === v.id ? "active" : ""}`} onClick={() => setState({ selected: v.id })}>
          <span className={`dot ${v.presence}`} />
          <span className="grow">{v.name}</span>
          <span className="muted small">{v.armed ? "armed" : v.mode}</span>
        </button>
      ))}
      <div className="grow" />
      <div className={`connection ${connection}`}>
        {connection === "connected" ? "Connected to DroneX" : connection === "disconnected" ? "Disconnected — reload" : "Connecting…"}
      </div>
    </nav>
  );
}

export function App() {
  const connection = useConnection();
  const [page, setPage] = useState<Page>("home");
  const [tab, setTab] = useState<"cockpit" | "mission">("cockpit");
  const [previewPlan, setPreviewPlan] = useState<string>();
  const plan = useStore((s) => (previewPlan ? s.plans[previewPlan] : undefined));

  if (connection.phase !== "ready") return <SignIn {...connection} />;

  return (
    <div className="app">
      <Sidebar page={page} go={setPage} />
      <main className="main">
        {page === "home" && <Home go={(p) => setPage(p as Page)} />}
        {page === "fleet" && <Fleet />}
        {page === "plans" && (
          <>
            <h2>Plans</h2>
            <Plans preview={previewPlan} onPreview={setPreviewPlan} />
          </>
        )}
        {page === "parameters" && (
          <>
            <h2>Parameters</h2>
            <Parameters />
          </>
        )}
        {page === "plugins" && <Plugins />}
        {page === "chat" && <Chat />}
      </main>
      <aside className="side">
        <section className="pane map-section">
          <MapPane planPreview={planPath(plan)} />
        </section>
        <section className="pane">
          <div className="tabs">
            <button className={tab === "cockpit" ? "active" : ""} onClick={() => setTab("cockpit")}>
              Cockpit
            </button>
            <button className={tab === "mission" ? "active" : ""} onClick={() => setTab("mission")}>
              Mission
            </button>
          </div>
          <div className="pane-body">
            {tab === "cockpit" ? <Cockpit /> : <Plans preview={previewPlan} onPreview={setPreviewPlan} />}
          </div>
        </section>
      </aside>
      <Approvals />
    </div>
  );
}
