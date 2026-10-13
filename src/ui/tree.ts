import type { DocumentEntry, Marker, TodoItem } from "../shared/types";

export const MARKERS: Marker[] = ["TODO", "FIXME", "HACK"];

export interface Filters { text: string; hidden: Marker[]; }

export interface TreeModule {
    module: string;
    count: number;
    documents: { documentId: string; name: string; kind: "microflow" | "nanoflow"; items: TodoItem[] }[];
}

const byName = (a: string, b: string) => a.localeCompare(b);

export function buildTree(documents: DocumentEntry[], filters: Filters): TreeModule[] {
    const text = filters.text.trim().toLowerCase();
    const modules = new Map<string, TreeModule>();
    for (const d of documents) {
        const items = d.items.filter(i => !filters.hidden.includes(i.marker) && (!text || i.fullText.toLowerCase().includes(text)));
        if (items.length === 0) continue;
        let m = modules.get(d.module);
        if (!m) modules.set(d.module, m = { module: d.module, count: 0, documents: [] });
        m.documents.push({ documentId: d.documentId, name: d.name, kind: d.kind, items });
        m.count += items.length;
    }
    const tree = [...modules.values()].sort((a, b) => byName(a.module, b.module));
    for (const m of tree) m.documents.sort((a, b) => byName(a.name, b.name));
    return tree;
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

// toolbar counter: only what is visible after filtering
export function summaryLabel(tree: TreeModule[]): string {
    const items = tree.reduce((n, m) => n + m.count, 0);
    const documents = tree.reduce((n, m) => n + m.documents.length, 0);
    return items === 0 ? plural(0, "item") : `${plural(items, "item")} in ${plural(documents, "document")}`;
}

export function countByMarker(documents: DocumentEntry[]): Record<Marker, number> {
    const counts: Record<Marker, number> = { TODO: 0, FIXME: 0, HACK: 0 };
    for (const d of documents) for (const i of d.items) counts[i.marker]++;
    return counts;
}
