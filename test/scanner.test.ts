import { describe, expect, test } from "vitest";
import { extractTodos, parseCaption } from "../src/main/scanner";

let nextId = 1;
const ann = (caption: string, x = 0, y = 0) =>
    ({ $ID: `a${nextId++}`, $Type: "Microflows$Annotation", caption, relativeMiddlePoint: { x, y } });
const loop = (objects: unknown[], x = 0, y = 0) =>
    ({ $ID: `l${nextId++}`, $Type: "Microflows$LoopedActivity", relativeMiddlePoint: { x, y }, objectCollection: { objects } });
const coll = (objects: unknown[]) => ({ objects }) as any;

describe("parseCaption", () => {
    test("basicPrefix", () => {
        expect(parseCaption("TODO: fix it")).toEqual({ marker: "TODO", firstLine: "fix it", fullText: "TODO: fix it", extraLines: 0 });
    });

    test("prefixVariants", () => {
        expect(parseCaption("TODO - a")?.firstLine).toBe("a");
        expect(parseCaption("TODO a")?.firstLine).toBe("a");
        expect(parseCaption("FIXME: b")?.firstLine).toBe("b");
        expect(parseCaption("HACK c")?.firstLine).toBe("c");
    });

    test("markerInMiddle", () => {
        const r = parseCaption("check this TODO later");
        expect(r?.marker).toBe("TODO");
        expect(r?.firstLine).toBe("check this TODO later");
    });

    test("firstMarkerWins", () => {
        expect(parseCaption("FIXME then TODO")?.marker).toBe("FIXME");
    });

    test("caseSensitive", () => {
        expect(parseCaption("todo lowercase")).toBeNull();
    });

    test("noMarker", () => {
        expect(parseCaption("plain comment")).toBeNull();
    });

    test("wordBoundaries", () => {
        expect(parseCaption("TODOS")).toBeNull();
        expect(parseCaption("TODO_x")).toBeNull();
        expect(parseCaption("XTODO")).toBeNull();
    });

    test("markerOnly", () => {
        for (const c of ["TODO", "TODO:"]) {
            const r = parseCaption(c);
            expect(r?.firstLine).toBe("");
            expect(r?.extraLines).toBe(0);
        }
    });

    test("multiline", () => {
        const r = parseCaption("FIXME: a\r\nautor: Jan\r\ndata: 2026-10-13");
        expect(r?.firstLine).toBe("a");
        expect(r?.extraLines).toBe(2);
    });

    test("trailingBlankLines", () => {
        expect(parseCaption("TODO: a\n\nb\r\n\r\n")?.extraLines).toBe(1);
    });
});

describe("extractTodos", () => {
    test("nestedLoops", () => {
        const top = ann("TODO: top");
        const deep = ann("TODO: deep");
        const items = extractTodos(coll([top, ann("no marker"), loop([loop([deep])])]));
        expect(items.map(i => [i.elementId, i.firstLine])).toEqual([[top.$ID, "top"], [deep.$ID, "deep"]]);
    });

    test("sortByPosition", () => {
        const items = extractTodos(coll([
            ann("TODO: c", 10, 300),
            ann("TODO: b", 50, 100),
            ann("TODO: a", 10, 100),
            loop([ann("TODO: inLoop2", 0, 50), ann("TODO: inLoop1", 0, 10)], 0, 200)
        ]));
        expect(items.map(i => i.firstLine)).toEqual(["a", "b", "inLoop1", "inLoop2", "c"]);
    });
});
