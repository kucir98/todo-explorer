import type { DocumentEntry, ScanStatus } from "./types";

export type PaneRequest =
    | { type: "getState" }
    | { type: "rescan" }
    | { type: "retry" }
    | { type: "syncDeletions" }
    | { type: "setIncludeMarketplace"; include: boolean };

export type StateMessage = { type: "state"; documents: DocumentEntry[]; status: ScanStatus; totalDocuments: number; scanned: boolean };
