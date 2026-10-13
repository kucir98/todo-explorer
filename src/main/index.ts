import { IComponent, getStudioProApi } from "@mendix/extensions-api";
import type { PaneRequest, StateMessage } from "../shared/messages";
import { TodoCache, modelPortFrom } from "./cache";
import { Queue } from "./queue";

const WATCHED_TYPES = new Set(["Microflows$Microflow", "Microflows$Nanoflow"]);
const DEBOUNCE_MS = 300;

export const component: IComponent = {
    async loaded(componentContext) {
        const studioPro = getStudioProApi(componentContext);
        const messages = studioPro.ui.messagePassing;

        const cache: TodoCache = new TodoCache(modelPortFrom(studioPro), new Queue(), () =>
            void messages.sendMessage<StateMessage, never>({ type: "state", ...cache.getState() }));

        // handler przed rejestracją panelu – panel przywrócony z layoutu może od razu wysłać getState
        await messages.addMessageHandler<PaneRequest>(async ({ message }) => {
            void cache.ensureScanned();
            switch (message.type) {
                case "getState": void messages.sendMessage<StateMessage, never>({ type: "state", ...cache.getState() }); break;
                case "rescan": await cache.rescan(); break;
                case "retry": await cache.retry(); break;
                case "syncDeletions": await cache.syncDeletions(); break;
                case "setIncludeMarketplace": await cache.setIncludeMarketplace(message.include); break;
            }
        });

        const pane = await studioPro.ui.panes.register(
            { title: "TODO Explorer", initialPosition: "bottom" },
            { componentName: "extension/todo-explorer", uiEntrypoint: "pane" }
        );

        await studioPro.ui.extensionsMenu.add({
            menuId: "todo-explorer.Open",
            caption: "TODO Explorer",
            action: () => studioPro.ui.panes.open(pane)
        });

        // zmiany zbierane przez 300 ms – jedna edycja potrafi wysłać kilka zdarzeń
        let pending = new Set<string>();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onDocuments = (docs: { documentId: string; documentType: string | null }[]) => {
            for (const d of docs) if (d.documentType && WATCHED_TYPES.has(d.documentType)) pending.add(d.documentId);
            if (pending.size === 0) return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                const ids = [...pending];
                pending = new Set();
                void cache.refresh(ids).then(() => cache.syncDeletions());
            }, DEBOUNCE_MS);
        };
        studioPro.app.projectChanges.addEventListener("documentAdded", ({ document }) => onDocuments([document]));
        studioPro.app.projectChanges.addEventListener("documentsChanged", ({ documents }) => onDocuments(documents));

        if (__DEV__) (globalThis as any).todoExplorer = { studioPro, cache, openPane: () => studioPro.ui.panes.open(pane) };
    }
};
