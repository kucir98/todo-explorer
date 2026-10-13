import type { Microflows } from "@mendix/extensions-api";
import type { DocumentEntry, ScanStatus } from "../shared/types";
import type { Queue } from "./queue";
import { extractTodos } from "./scanner";

type Kind = "microflow" | "nanoflow";
type StudioPro = ReturnType<typeof import("@mendix/extensions-api").getStudioProApi>;

const BATCH = 50;
const KINDS: Kind[] = ["microflow", "nanoflow"];

export interface ModelPort {
    getModules(): Promise<{ name: string; fromAppStore: boolean }[]>;
    unitsInfo(kind: Kind): Promise<{ $ID: string; name?: string; moduleName?: string }[]>;
    load(kind: Kind, ids: string[]): Promise<{ $ID: string; name: string; objectCollection: Microflows.MicroflowObjectCollection }[]>;
}

export function modelPortFrom(studioPro: StudioPro): ModelPort {
    const access = (kind: Kind) =>
        (kind === "microflow" ? studioPro.app.model.microflows : studioPro.app.model.nanoflows) as typeof studioPro.app.model.microflows;
    return {
        getModules: async () => (await studioPro.app.model.modules.getModules()).map(m => ({ name: m.name, fromAppStore: m.fromAppStore })),
        unitsInfo: async kind => [...(await access(kind).getUnitsInfo())],
        load: (kind, ids) => {
            const wanted = new Set(ids);
            // drugi argument obowiązkowy, domyślnie ładuje tylko 10 jednostek
            return access(kind).loadAll(u => wanted.has(u.$ID), ids.length);
        }
    };
}

interface Candidate { id: string; kind: Kind; module: string }

export class TodoCache {
    private entries = new Map<string, DocumentEntry>();
    private appStoreModules = new Map<string, boolean>();
    private includeMarketplace = false;
    private marketplaceScanned = false;
    private status: ScanStatus = { state: "idle" };
    private lastFailed: (() => Promise<void>) | null = null;
    private lastError = "";
    private scanPromise: Promise<void> | null = null;
    scanned = false;

    constructor(private port: ModelPort, private queue: Queue, private onChange: () => void) {}

    getState(): { documents: DocumentEntry[]; status: ScanStatus; totalDocuments: number; scanned: boolean } {
        const documents = [...this.entries.values()].filter(d => d.items.length > 0 && (this.includeMarketplace || !d.fromAppStore));
        return { documents, status: this.status, totalDocuments: this.entries.size, scanned: this.scanned };
    }

    ensureScanned(): Promise<void> {
        this.scanPromise ??= this.exec(this.fullScan);
        return this.scanPromise;
    }

    rescan(): Promise<void> {
        return this.exec(this.fullScan);
    }

    refresh(documentIds: string[]): Promise<void> {
        const op = () => this.reload(documentIds);
        return this.exec(op);
    }

    syncDeletions(): Promise<void> {
        return this.exec(this.removeDeleted);
    }

    setIncludeMarketplace(include: boolean): Promise<void> {
        this.includeMarketplace = include;
        return this.exec(this.scanMarketplaceIfNeeded);
    }

    retry(): Promise<void> {
        return this.lastFailed ? this.exec(this.lastFailed) : Promise.resolve();
    }

    // wszystkie operacje przez kolejkę; błąd → status error, dane bez zmian, bez rzucania dalej
    private exec(op: () => Promise<void>): Promise<void> {
        return this.queue.run(async () => {
            try {
                await op.call(this);
                // udany pełny skan zastępuje każdą wcześniejszą nieudaną operację
                if (this.lastFailed === op || op === this.fullScan) this.lastFailed = null;
            } catch (e) {
                console.error("TODO Explorer:", e);
                this.lastFailed = op;
                this.lastError = e instanceof Error ? e.message : String(e);
            }
            this.status = this.lastFailed ? { state: "error", message: this.lastError } : { state: "idle" };
            this.onChange();
        });
    }

    private async loadModules() {
        this.appStoreModules = new Map((await this.port.getModules()).map(m => [m.name, m.fromAppStore]));
    }

    private isAppStore(module: string) {
        return this.appStoreModules.get(module) ?? false;
    }

    private async candidates(): Promise<Candidate[]> {
        const all: Candidate[] = [];
        for (const kind of KINDS)
            for (const u of await this.port.unitsInfo(kind)) all.push({ id: u.$ID, kind, module: u.moduleName ?? "" });
        return all;
    }

    // ładuje kandydatów paczkami; postęp tylko gdy podano total (pełny skan)
    private async loadInto(target: Map<string, DocumentEntry>, list: Candidate[], progress?: { done: number; total: number }) {
        for (const kind of KINDS) {
            const ofKind = list.filter(c => c.kind === kind);
            for (let i = 0; i < ofKind.length; i += BATCH) {
                const batch = ofKind.slice(i, i + BATCH);
                const byId = new Map(batch.map(c => [c.id, c]));
                for (const u of await this.port.load(kind, batch.map(c => c.id))) {
                    const c = byId.get(u.$ID)!;
                    target.set(u.$ID, {
                        documentId: u.$ID, kind, module: c.module, name: u.name,
                        fromAppStore: this.isAppStore(c.module), items: extractTodos(u.objectCollection)
                    });
                }
                if (progress) {
                    progress.done += batch.length;
                    this.status = { state: "scanning", done: progress.done, total: progress.total };
                    this.onChange();
                }
            }
        }
    }

    private async fullScan() {
        // includeMarketplace może się zmienić w trakcie skanu – zapamiętujemy wartość, z którą skanujemy
        const include = this.includeMarketplace;
        await this.loadModules();
        const list = (await this.candidates()).filter(c => include || !this.isAppStore(c.module));
        const fresh = new Map<string, DocumentEntry>();
        await this.loadInto(fresh, list, { done: 0, total: list.length });
        this.entries = fresh;
        this.marketplaceScanned = include;
        this.scanned = true;
    }

    // przed pierwszym skanem zdarzenia ignorujemy – pełny skan i tak je pokryje, a nie obciążamy backendu
    // u użytkowników, którzy panelu nie otwierają
    private async reload(ids: string[]) {
        if (!this.scanned) return;
        const wanted = new Set(ids);
        const existing = (await this.candidates()).filter(c => wanted.has(c.id));
        if (existing.some(c => !this.appStoreModules.has(c.module))) await this.loadModules();
        const visible = existing.filter(c => this.marketplaceScanned || !this.isAppStore(c.module));
        const fresh = new Map<string, DocumentEntry>();
        await this.loadInto(fresh, visible);
        for (const id of ids) {
            const entry = fresh.get(id);
            if (entry) this.entries.set(id, entry);
            else this.entries.delete(id);
        }
    }

    private async removeDeleted() {
        if (!this.scanned) return;
        const present = new Set((await this.candidates()).map(c => c.id));
        for (const id of [...this.entries.keys()]) if (!present.has(id)) this.entries.delete(id);
    }

    private async scanMarketplaceIfNeeded() {
        if (!this.includeMarketplace || this.marketplaceScanned || !this.scanned) return;
        const list = (await this.candidates()).filter(c => this.isAppStore(c.module));
        await this.loadInto(this.entries, list);
        this.marketplaceScanned = true;
    }
}
