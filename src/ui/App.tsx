import React, { useEffect, useMemo, useState } from "react";
import type { getStudioProApi } from "@mendix/extensions-api";
import type { PaneRequest, StateMessage } from "../shared/messages";
import type { Marker } from "../shared/types";
import { Toolbar } from "./Toolbar";
import { TreeView } from "./TreeView";
import { requestUntilAnswered } from "./retry";
import { buildTree, countByMarker, summaryLabel } from "./tree";

type StudioPro = ReturnType<typeof getStudioProApi>;

const STORAGE_KEY = "todo-explorer.filters";
interface Saved { text: string; hidden: Marker[]; includeMarketplace: boolean }

function loadSaved(): Saved {
    const fallback: Saved = { text: "", hidden: [], includeMarketplace: false };
    try {
        return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
    } catch {
        return fallback;
    }
}

export function App({ studioPro }: { studioPro: StudioPro }) {
    const [state, setState] = useState<StateMessage | null>(null);
    const [saved, setSaved] = useState(loadSaved);

    const send = (request: PaneRequest) => void studioPro.ui.messagePassing.sendMessage<PaneRequest, never>(request);

    useEffect(() => {
        let cancelled = false, answered = false, cancelRetry = () => {};
        let handler: Awaited<ReturnType<typeof studioPro.ui.messagePassing.addMessageHandler>> | undefined;
        void studioPro.ui.messagePassing.addMessageHandler<StateMessage>(async ({ message }) => {
            if (message?.type === "state") { answered = true; setState(message); }
        }).then(h => {
            handler = h;
            if (cancelled) return void studioPro.ui.messagePassing.removeMessageHandler(h);
            if (saved.includeMarketplace) send({ type: "setIncludeMarketplace", include: true });
            cancelRetry = requestUntilAnswered(() => send({ type: "getState" }), () => answered, 1000, 30);
        });
        const onVisible = () => document.visibilityState === "visible" && send({ type: "syncDeletions" });
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            cancelRetry();
            document.removeEventListener("visibilitychange", onVisible);
            if (handler) void studioPro.ui.messagePassing.removeMessageHandler(handler);
        };
    }, []);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* no storage available – ignore */ }
    }, [saved]);

    const documents = state?.documents ?? [];
    const tree = useMemo(() => buildTree(documents, saved), [documents, saved]);
    const counts = useMemo(() => countByMarker(documents), [documents]);

    const editors = studioPro.ui.editors;
    const openDocument = (id: string) => editors.editDocument({ id }).catch(e => console.error("TODO Explorer:", e));
    const openItem = (documentId: string, elementId: string) =>
        editors.editDocument({ id: documentId }, { id: elementId })
            .catch(() => editors.editDocument({ id: documentId }))
            .catch(e => console.error("TODO Explorer:", e));

    const status = state?.status;
    const scanning = !state || !state.scanned || status?.state === "scanning";
    const progress = status?.state === "scanning" ? status : null;

    return (
        <>
            <Toolbar
                text={saved.text} hidden={saved.hidden} counts={counts} includeMarketplace={saved.includeMarketplace}
                summary={summaryLabel(tree)}
                onText={text => setSaved(s => ({ ...s, text }))}
                onToggleMarker={m => setSaved(s => ({ ...s, hidden: s.hidden.includes(m) ? s.hidden.filter(x => x !== m) : [...s.hidden, m] }))}
                onIncludeMarketplace={include => { setSaved(s => ({ ...s, includeMarketplace: include })); send({ type: "setIncludeMarketplace", include }); }}
                onRescan={() => send({ type: "rescan" })}
            />
            {tree.length > 0 && <TreeView tree={tree} onOpenDocument={openDocument} onOpenItem={openItem} />}
            {tree.length === 0 && !scanning && status?.state !== "error" && (
                <div className="empty">
                    {documents.length === 0
                        ? "No TODO, FIXME or HACK annotations in your microflows and nanoflows."
                        : "No annotations match the filters."}
                </div>
            )}
            {tree.length === 0 && (scanning || status?.state === "error") && <div className="tree" />}
            {scanning && status?.state !== "error" && (
                <div className="status">
                    <div className="progress"><div style={{ width: progress?.total ? `${(100 * progress.done) / progress.total}%` : "5%" }} /></div>
                    <span>Scanning… {progress ? `${progress.done.toLocaleString("en-US")} / ${progress.total.toLocaleString("en-US")}` : ""}</span>
                </div>
            )}
            {status?.state === "error" && (
                <div className="status error">
                    <span>Scan failed.</span>
                    <button className="btn" onClick={() => send({ type: "retry" })}>Retry</button>
                </div>
            )}
        </>
    );
}
