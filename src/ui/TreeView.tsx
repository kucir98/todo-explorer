import React, { useState } from "react";
import type { TodoItem } from "../shared/types";
import type { TreeModule } from "./tree";

interface Props {
    tree: TreeModule[];
    onOpenDocument(documentId: string): void;
    onOpenItem(documentId: string, elementId: string): void;
}

function toggle(set: Set<string>, key: string) {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
}

export function TreeView({ tree, onOpenDocument, onOpenItem }: Props) {
    const [collapsed, setCollapsed] = useState(new Set<string>());
    const [expanded, setExpanded] = useState(new Set<string>());

    const itemRow = (documentId: string, i: TodoItem) => (
        <React.Fragment key={i.elementId}>
            <div className="row" style={{ paddingLeft: 52 }} title={i.fullText} onClick={() => onOpenItem(documentId, i.elementId)}>
                <span className="chev" onClick={e => { if (i.extraLines) { e.stopPropagation(); setExpanded(s => toggle(s, i.elementId)); } }}>
                    {i.extraLines ? (expanded.has(i.elementId) ? "▾" : "▸") : ""}
                </span>
                <span className={`badge ${i.marker}`}>{i.marker}</span>
                <span className="text">{i.firstLine}</span>
                {i.extraLines > 0 && <span className="muted">+{i.extraLines} line{i.extraLines === 1 ? "" : "s"}</span>}
            </div>
            {expanded.has(i.elementId) && <div className="more" style={{ paddingLeft: 92 }}>{i.fullText}</div>}
        </React.Fragment>
    );

    return (
        <div className="tree">
            {tree.map(m => (
                <React.Fragment key={m.module}>
                    <div className="row" onClick={() => setCollapsed(s => toggle(s, m.module))}>
                        <span className="chev">{collapsed.has(m.module) ? "▸" : "▾"}</span>
                        <span className="text">{m.module || "(no module)"}</span>
                        <span className="muted">{m.count}</span>
                    </div>
                    {!collapsed.has(m.module) && m.documents.map(d => (
                        <React.Fragment key={d.documentId}>
                            <div className="row" style={{ paddingLeft: 26 }} onClick={() => onOpenDocument(d.documentId)}>
                                <span className="chev" onClick={e => { e.stopPropagation(); setCollapsed(s => toggle(s, d.documentId)); }}>
                                    {collapsed.has(d.documentId) ? "▸" : "▾"}
                                </span>
                                <span className="kind">{d.kind === "microflow" ? "MF" : "NF"}</span>
                                <span className="text">{d.name}</span>
                                <span className="muted">{d.items.length}</span>
                            </div>
                            {!collapsed.has(d.documentId) && d.items.map(i => itemRow(d.documentId, i))}
                        </React.Fragment>
                    ))}
                </React.Fragment>
            ))}
        </div>
    );
}
