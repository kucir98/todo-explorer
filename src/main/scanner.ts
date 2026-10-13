import type { Microflows } from "@mendix/extensions-api";
import type { Marker, TodoItem } from "../shared/types";

// case-sensitive: „todo” małymi literami częściej trafia się w zwykłym tekście
const MARKER = /\b(TODO|FIXME|HACK)\b/;

export function parseCaption(caption: string): Omit<TodoItem, "elementId"> | null {
    const match = MARKER.exec(caption);
    if (!match) return null;
    const marker = match[1] as Marker;
    const text = match.index === 0 ? caption.replace(new RegExp(`^${marker}\\s*[:\\-]?\\s*`), "") : caption;
    const [first = "", ...rest] = text.split(/\r?\n/);
    return {
        marker,
        firstLine: first.trim(),
        fullText: caption,
        extraLines: rest.filter(l => l.trim() !== "").length
    };
}

type Position = [number, number][];

function collect(coll: Microflows.MicroflowObjectCollection, parent: Position, out: { item: TodoItem; pos: Position }[]) {
    for (const o of coll.objects) {
        const pos: Position = [...parent, [o.relativeMiddlePoint.y, o.relativeMiddlePoint.x]];
        if (o.$Type === "Microflows$Annotation") {
            const parsed = parseCaption(o.caption);
            if (parsed) out.push({ item: { elementId: o.$ID, ...parsed }, pos });
        } else if (o.$Type === "Microflows$LoopedActivity") {
            collect(o.objectCollection, pos, out);
        }
    }
}

function comparePositions(a: Position, b: Position): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const d = a[i][0] - b[i][0] || a[i][1] - b[i][1];
        if (d !== 0) return d;
    }
    return a.length - b.length;
}

export function extractTodos(coll: Microflows.MicroflowObjectCollection): TodoItem[] {
    const found: { item: TodoItem; pos: Position }[] = [];
    collect(coll, [], found);
    return found.sort((a, b) => comparePositions(a.pos, b.pos)).map(f => f.item);
}
