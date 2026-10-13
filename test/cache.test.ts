import { describe, expect, test } from "vitest";
import { Queue } from "../src/main/queue";
import { ModelPort, TodoCache } from "../src/main/cache";
import type { ScanStatus } from "../src/shared/types";

type Kind = "microflow" | "nanoflow";
interface FakeDoc { kind: Kind; module: string; name: string; captions: string[] }

class FakeModel implements ModelPort {
    modules = [{ name: "MyFirstModule", fromAppStore: false }, { name: "Atlas_Core", fromAppStore: true }];
    docs = new Map<string, FakeDoc>();
    loaded: string[] = [];
    failLoad = false;
    unitsInfoCalls = 0;
    onLoad?: () => void;

    add(id: string, doc: Partial<FakeDoc> & { captions: string[] }) {
        this.docs.set(id, { kind: "microflow", module: "MyFirstModule", name: id, ...doc });
    }
    async getModules() { return this.modules; }
    async unitsInfo(kind: Kind) {
        this.unitsInfoCalls++;
        return [...this.docs].filter(([, d]) => d.kind === kind).map(([id, d]) => ({ $ID: id, name: d.name, moduleName: d.module }));
    }
    async load(kind: Kind, ids: string[]) {
        if (this.failLoad) throw new Error("Backend failed to handle the request. Response code: 500.");
        this.loaded.push(...ids);
        this.onLoad?.();
        return ids.filter(id => this.docs.get(id)?.kind === kind).map(id => {
            const d = this.docs.get(id)!;
            return {
                $ID: id, name: d.name,
                objectCollection: { objects: d.captions.map((caption, i) => ({ $ID: `${id}-a${i}`, $Type: "Microflows$Annotation", caption, relativeMiddlePoint: { x: 0, y: i } })) } as any
            };
        });
    }
}

function setup() {
    const model = new FakeModel();
    const statuses: ScanStatus[] = [];
    const cache: TodoCache = new TodoCache(model, new Queue(), () => statuses.push(cache.getState().status));
    return { model, cache, statuses };
}

const texts = (cache: TodoCache) => cache.getState().documents.flatMap(d => d.items.map(i => `${d.name}: ${i.firstLine}`));

describe("Queue", () => {
    test("queueIsSerial", async () => {
        const q = new Queue();
        const log: string[] = [];
        const a = q.run(async () => { log.push("a start"); await new Promise(r => setTimeout(r, 20)); log.push("a end"); });
        const b = q.run(async () => { log.push("b start"); });
        await Promise.all([a, b]);
        expect(log).toEqual(["a start", "a end", "b start"]);
    });

    test("failedJobDoesNotBlock", async () => {
        const q = new Queue();
        await expect(q.run(async () => { throw new Error("x"); })).rejects.toThrow("x");
        await expect(q.run(async () => 42)).resolves.toBe(42);
    });
});

describe("TodoCache", () => {
    test("fullScanProgress", async () => {
        const { model, cache, statuses } = setup();
        for (let i = 0; i < 120; i++) model.add(`mf${i}`, { captions: i === 7 ? ["TODO: seven"] : ["plain"] });
        await cache.ensureScanned();
        expect(statuses).toEqual([
            { state: "scanning", done: 50, total: 120 },
            { state: "scanning", done: 100, total: 120 },
            { state: "scanning", done: 120, total: 120 },
            { state: "idle" }
        ]);
        expect(texts(cache)).toEqual(["mf7: seven"]);
        expect(cache.getState().totalDocuments).toBe(120);
        expect(cache.scanned).toBe(true);
    });

    test("stateReportsScanned", async () => {
        const { cache } = setup();
        expect(cache.getState().scanned).toBe(false);
        await cache.ensureScanned();
        expect(cache.getState().scanned).toBe(true);
    });

    test("scansNanoflowsToo", async () => {
        const { model, cache } = setup();
        model.add("nf1", { kind: "nanoflow", captions: ["FIXME: client"] });
        await cache.ensureScanned();
        expect(cache.getState().documents.map(d => [d.name, d.kind])).toEqual([["nf1", "nanoflow"]]);
    });

    test("ensureScannedOnlyOnce", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.ensureScanned();
        await cache.ensureScanned();
        expect(model.loaded).toEqual(["mf1"]);
    });

    test("skipsMarketplaceByDefault", async () => {
        const { model, cache } = setup();
        model.add("mine", { captions: ["TODO: mine"] });
        model.add("atlas", { module: "Atlas_Core", captions: ["TODO: atlas"] });
        await cache.ensureScanned();
        expect(model.loaded).not.toContain("atlas");
        expect(texts(cache)).toEqual(["mine: mine"]);
    });

    test("includeMarketplaceLoadsOnce", async () => {
        const { model, cache } = setup();
        model.add("atlas", { module: "Atlas_Core", captions: ["TODO: atlas"] });
        await cache.ensureScanned();
        await cache.setIncludeMarketplace(true);
        await cache.setIncludeMarketplace(true);
        expect(model.loaded.filter(id => id === "atlas")).toHaveLength(1);
        expect(texts(cache)).toEqual(["atlas: atlas"]);
        expect(cache.getState().documents[0].fromAppStore).toBe(true);
        await cache.setIncludeMarketplace(false);
        expect(texts(cache)).toEqual([]);
    });

    test("refreshUpdatesEntry", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: old"] });
        await cache.ensureScanned();
        model.add("mf1", { captions: ["TODO: new"] });
        await cache.refresh(["mf1"]);
        expect(texts(cache)).toEqual(["mf1: new"]);
    });

    test("refreshAddsNewDocument", async () => {
        const { model, cache } = setup();
        await cache.ensureScanned();
        model.add("mf2", { captions: ["HACK: added"] });
        await cache.refresh(["mf2"]);
        expect(texts(cache)).toEqual(["mf2: added"]);
        expect(cache.getState().totalDocuments).toBe(1);
    });

    test("ignoresHiddenMarketplaceEvents", async () => {
        const { model, cache } = setup();
        await cache.ensureScanned();
        model.add("atlas", { module: "Atlas_Core", captions: ["TODO: atlas"] });
        await cache.refresh(["atlas"]);
        expect(model.loaded).not.toContain("atlas");
        expect(texts(cache)).toEqual([]);
    });

    test("refreshOfVanishedDocument", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.ensureScanned();
        model.docs.delete("mf1");
        await cache.refresh(["mf1"]);
        expect(texts(cache)).toEqual([]);
        expect(cache.getState().status).toEqual({ state: "idle" });
    });

    test("syncDeletionsRemoves", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        model.add("mf2", { captions: ["TODO: b"] });
        await cache.ensureScanned();
        model.docs.delete("mf1");
        await cache.syncDeletions();
        expect(texts(cache)).toEqual(["mf2: b"]);
        expect(cache.getState().totalDocuments).toBe(1);
    });

    test("errorKeepsData", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.ensureScanned();
        model.add("mf1", { captions: ["TODO: b"] });
        model.failLoad = true;
        await cache.refresh(["mf1"]);
        expect(cache.getState().status).toEqual({ state: "error", message: "Backend failed to handle the request. Response code: 500." });
        expect(texts(cache)).toEqual(["mf1: a"]);
        model.failLoad = false;
        await cache.retry();
        expect(cache.getState().status).toEqual({ state: "idle" });
        expect(texts(cache)).toEqual(["mf1: b"]);
    });

    test("rescanAfterFailedRefreshReturnsIdle", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.ensureScanned();
        model.failLoad = true;
        await cache.refresh(["mf1"]);
        model.failLoad = false;
        await cache.rescan();
        expect(cache.getState().status).toEqual({ state: "idle" });
    });

    test("failedRefreshKeepsErrorAfterOtherSuccess", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.ensureScanned();
        model.failLoad = true;
        await cache.refresh(["mf1"]);
        model.failLoad = false;
        await cache.syncDeletions();
        expect(cache.getState().status.state).toBe("error");
    });

    test("toggleMarketplaceDuringFirstScan", async () => {
        const { model, cache } = setup();
        model.add("mine", { captions: ["TODO: mine"] });
        model.add("atlas", { module: "Atlas_Core", captions: ["TODO: atlas"] });
        let toggled: Promise<void> | undefined;
        model.onLoad = () => { toggled ??= cache.setIncludeMarketplace(true); };
        await cache.ensureScanned();
        await toggled;
        expect(texts(cache).sort()).toEqual(["atlas: atlas", "mine: mine"]);
    });

    test("eventsBeforeFirstScanAreIgnored", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.refresh(["mf1"]);
        await cache.syncDeletions();
        expect(model.loaded).toEqual([]);
        expect(model.unitsInfoCalls).toBe(0);
    });

    test("rescanClears", async () => {
        const { model, cache } = setup();
        model.add("mf1", { captions: ["TODO: a"] });
        await cache.ensureScanned();
        model.docs.delete("mf1");
        model.add("mf2", { captions: ["TODO: b"] });
        await cache.rescan();
        expect(texts(cache)).toEqual(["mf2: b"]);
    });
});
