import React from "react";
import type { Marker } from "../shared/types";
import { MARKERS } from "./tree";

interface Props {
    text: string;
    hidden: Marker[];
    counts: Record<Marker, number>;
    includeMarketplace: boolean;
    summary: string;
    onText(text: string): void;
    onToggleMarker(marker: Marker): void;
    onIncludeMarketplace(include: boolean): void;
    onRescan(): void;
}

export function Toolbar(p: Props) {
    return (
        <div className="toolbar">
            <input type="text" placeholder="Filter text" value={p.text} onChange={e => p.onText(e.target.value)} />
            {MARKERS.map(m => (
                <button key={m} className={`chip${p.hidden.includes(m) ? " off" : ""}`} onClick={() => p.onToggleMarker(m)}
                        aria-pressed={!p.hidden.includes(m)}>
                    <span className={`badge ${m}`}>{m}</span>
                    <span className="muted">{p.counts[m]}</span>
                </button>
            ))}
            <label className="muted">
                <input type="checkbox" checked={!p.includeMarketplace} onChange={e => p.onIncludeMarketplace(!e.target.checked)} />
                {" "}Hide Marketplace modules
            </label>
            <span className="spacer muted">{p.summary}</span>
            <button className="btn" onClick={p.onRescan} aria-label="Rescan" title="Rescan">⟳</button>
        </div>
    );
}
