import { useEffect, useState } from "react";
import { rpc, useStore } from "../store";
import { errorText } from "../commands";

interface Hit {
  name: string;
  displayName?: string;
  summary?: string;
  value?: number;
  valueName?: string;
  default?: number;
}

interface Definition {
  description?: string;
  displayName?: string;
  units?: string;
  range?: { low: number; high: number };
  values?: { code: number; name: string }[];
}

export function Parameters() {
  const selected = useStore((s) => s.selected);
  const vehicle = useStore((s) => (s.selected ? s.vehicles[s.selected] : undefined));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [described, setDescribed] = useState<string>();
  const [open, setOpen] = useState<{ name: string; value?: number; definition?: Definition }>();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string>();
  const [downloading, setDownloading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setHits([]);
    setOpen(undefined);
  }, [selected]);

  useEffect(() => {
    if (!selected || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const answer = await rpc.call("param/search", { vehicleId: selected, query, limit: 30 });
        setHits(answer.hits ?? []);
        setDescribed(answer.describedBy?.definitions?.detail);
      } catch (error) {
        setMessage(errorText(error));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected, tick]);

  if (!vehicle) return <div className="empty">Choose a vehicle to see its parameters.</div>;

  const download = async () => {
    setDownloading(true);
    setMessage(undefined);
    try {
      const answer = await rpc.call("param/refresh", { id: vehicle.id });
      setMessage(`Downloading ${answer.count ?? ""} parameters…`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setDownloading(false);
    }
  };

  const openParam = async (name: string) => {
    setMessage(undefined);
    try {
      const answer = await rpc.call("param/get", { vehicleId: vehicle.id, names: [name] });
      const param = answer.parameters?.[0];
      setOpen({ name, value: param?.value, definition: param?.definition });
      setDraft(param?.value != null ? String(param.value) : "");
    } catch (error) {
      setMessage(errorText(error));
    }
  };

  const save = async () => {
    if (!open) return;
    const number = Number(draft);
    if (Number.isNaN(number)) {
      setMessage("Enter a number.");
      return;
    }
    const range = open.definition?.range;
    if (range && (number < range.low || number > range.high)) {
      if (!window.confirm(`${number} is outside ${range.low}–${range.high}. Set it anyway?`)) return;
    }
    try {
      const answer = await rpc.call("param/set", { vehicleId: vehicle.id, name: open.name, value: number, expectedValue: open.value });
      setMessage(answer.status === "accepted" ? `${open.name} is now ${answer.parameter?.value}` : `${open.name}: ${answer.status}`);
      setOpen({ ...open, value: answer.parameter?.value });
      setTick((t) => t + 1);
    } catch (error) {
      setMessage(errorText(error));
    }
  };

  return (
    <div className="parameters">
      <div className="row">
        <input
          className="grow"
          placeholder={`Search ${vehicle.name}'s parameters by name or meaning, e.g. "battery failsafe"`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={download} disabled={downloading}>
          Download all
        </button>
      </div>
      {described && <div className="muted small">{described}</div>}
      <div className="param-layout">
        {open && (
          <div className="card param-detail">
            <div className="title mono">{open.name}</div>
            <div className="strong">{open.definition?.displayName}</div>
            <p className="muted">{open.definition?.description ?? "No description for this parameter."}</p>
            {open.definition?.range && (
              <div className="small">
                Range {open.definition.range.low}–{open.definition.range.high} {open.definition.units}
              </div>
            )}
            {open.definition?.values && (
              <div className="small">{open.definition.values.map((v) => `${v.code} ${v.name}`).join(" · ")}</div>
            )}
            <div className="row">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} />
              <span className="muted">{open.definition?.units}</span>
              <button className="primary" onClick={save} disabled={draft === String(open.value)}>
                Set
              </button>
            </div>
          </div>
        )}
        <ul className="list">
          {hits.map((hit) => (
            <li key={hit.name} className={open?.name === hit.name ? "active" : ""}>
              <button className="link" onClick={() => openParam(hit.name)}>
                <div className="row between">
                  <span className="mono">{hit.name}</span>
                  <span className="mono">
                    {hit.value ?? "—"}
                    {hit.valueName ? ` (${hit.valueName})` : ""}
                  </span>
                </div>
                <div className="muted small">{hit.displayName ?? hit.summary}</div>
              </button>
            </li>
          ))}
          {query.length >= 2 && hits.length === 0 && (
            <li className="muted small">Nothing found. Download the parameters first if you have not.</li>
          )}
        </ul>
      </div>
      {message && <div className="message">{message}</div>}
    </div>
  );
}
