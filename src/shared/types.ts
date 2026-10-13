export type Marker = "TODO" | "FIXME" | "HACK";

export interface TodoItem {
    elementId: string;
    marker: Marker;
    firstLine: string;
    fullText: string;
    extraLines: number;
}

export interface DocumentEntry {
    documentId: string;
    kind: "microflow" | "nanoflow";
    module: string;
    name: string;
    fromAppStore: boolean;
    items: TodoItem[];
}

export type ScanStatus =
    | { state: "idle" }
    | { state: "scanning"; done: number; total: number }
    | { state: "error"; message: string };
