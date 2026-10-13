import { describe, expect, test } from "vitest";
import { buildTree, countByMarker, summaryLabel } from "../src/ui/tree";
import type { DocumentEntry, Marker } from "../src/shared/types";

const item = (marker: Marker, text: string) =>
    ({ elementId: `${marker}-${text}`, marker, firstLine: text, fullText: `${marker}: ${text}`, extraLines: 0 });
const doc = (module: string, name: string, items: ReturnType<typeof item>[]): DocumentEntry =>
    ({ documentId: `${module}.${name}`, kind: "microflow", module, name, fromAppStore: false, items });

const docs = [
    doc("B", "Second", [item("TODO", "b1")]),
    doc("A", "Zeta", [item("TODO", "z1"), item("FIXME", "z2")]),
    doc("A", "alpha", [item("FIXME", "only fixme")]),
    doc("A", "Sales", [item("HACK", "walidacja kodu pocztowego")])
];

describe("buildTree", () => {
    test("groupsAndSorts", () => {
        const tree = buildTree(docs, { text: "", hidden: [] });
        expect(tree.map(m => [m.module, m.count])).toEqual([["A", 4], ["B", 1]]);
        expect(tree[0].documents.map(d => d.name)).toEqual(["alpha", "Sales", "Zeta"]);
        expect(tree[0].documents[2].items.map(i => i.firstLine)).toEqual(["z1", "z2"]);
    });

    test("hiddenMarkers", () => {
        const tree = buildTree(docs, { text: "", hidden: ["FIXME"] });
        expect(tree[0].documents.map(d => d.name)).toEqual(["Sales", "Zeta"]);
        expect(tree[0].documents[1].items.map(i => i.marker)).toEqual(["TODO"]);
        expect(tree[0].count).toBe(2);
    });

    test("textFilter", () => {
        const tree = buildTree(docs, { text: "POCZT", hidden: [] });
        expect(tree.map(m => m.module)).toEqual(["A"]);
        expect(tree[0].documents.map(d => d.name)).toEqual(["Sales"]);
    });
});

describe("summaryLabel", () => {
    test("countsVisibleItemsAndDocuments", () => {
        expect(summaryLabel(buildTree(docs, { text: "", hidden: [] }))).toBe("5 items in 4 documents");
    });

    test("singular", () => {
        expect(summaryLabel(buildTree(docs, { text: "POCZT", hidden: [] }))).toBe("1 item in 1 document");
    });

    test("nothingVisible", () => {
        expect(summaryLabel([])).toBe("0 items");
    });

    test("thousandsSeparator", () => {
        const many = [doc("A", "Big", Array.from({ length: 1200 }, (_, i) => item("TODO", `t${i}`)))];
        expect(summaryLabel(buildTree(many, { text: "", hidden: [] }))).toBe("1,200 items in 1 document");
    });
});

describe("countByMarker", () => {
    test("countsIgnoreFilters", () => {
        expect(countByMarker(docs)).toEqual({ TODO: 2, FIXME: 2, HACK: 1 });
    });
});
