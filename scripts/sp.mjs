// Drives Studio Pro from the command line over CDP (WebView2 remote debugging).
//   node scripts/sp.mjs start            – starts Studio Pro with dev flags and the CDP port (refuses if Studio Pro is already running)
//   node scripts/sp.mjs stop             – closes the instance started by `start` (gracefully, no /F); never touches other instances
//   node scripts/sp.mjs wait             – waits until the extension is ready
//   node scripts/sp.mjs targets          – lists CDP targets
//   node scripts/sp.mjs eval "<expression>" – runs JS in the extension context (await allowed), prints JSON
//   node scripts/sp.mjs logs [seconds]   – collects console.* from the extension for N seconds (default 10)
//   node scripts/sp.mjs shot <URL part> <file.png> – screenshot of a page, e.g. the pane (uiEntryPoint=pane)
// Handle exposed by the extension (dev build only): todoExplorer = { studioPro, cache, openPane }
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9222;
// Studio Pro version and app: env SP_VERSION / SP_MPR, otherwise local.config.json (see local.config.example.json)
const localConfig = existsSync("local.config.json") ? JSON.parse(readFileSync("local.config.json", "utf8")) : {};
const SP_VERSION = process.env.SP_VERSION ?? localConfig.studioProVersion ?? "11.12.1";
const STUDIO_PRO = `C:\\Program Files\\Mendix\\${SP_VERSION}\\modeler\\studiopro.exe`;
const MPR = process.env.SP_MPR ?? localConfig.mpr;

const PID_FILE = join(tmpdir(), "todo-explorer-sp.pid");

const [cmd, ...rest] = process.argv.slice(2);

function runningPids() {
    return execSync('tasklist /FI "IMAGENAME eq studiopro.exe" /FO CSV /NH').toString()
        .split(/\r?\n/).map(l => l.trim().split('","')[1]).filter(Boolean).map(Number);
}

async function targets() {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    return res.json();
}

function connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        } else listeners.forEach(l => l(msg));
    };
    return new Promise((resolve, reject) => {
        ws.onerror = reject;
        ws.onopen = () => resolve({
            send: (method, params = {}, sessionId, timeoutMs = 0) => new Promise((r, rej) => {
                const id = nextId++;
                pending.set(id, r);
                ws.send(JSON.stringify({ id, method, params, sessionId }));
                if (timeoutMs) setTimeout(() => pending.has(id) && (pending.delete(id), rej(new Error(`timeout: ${method}`))), timeoutMs);
            }),
            on: l => listeners.push(l),
            close: () => ws.close()
        });
    });
}

// extension main.js runs in a dedicated worker of the component-host page (mode=main);
// workers don't answer direct connections, so we attach through the page (flatten)
async function extensionTarget() {
    const host = (await targets()).find(t => t.type === "page" && t.url.includes("component-host"));
    if (!host) throw new Error("No component-host page – is Studio Pro running (node scripts/sp.mjs start)?");
    const c = await connect(host.webSocketDebuggerUrl);
    const sessions = [];
    c.on(m => m.method === "Target.attachedToTarget" && sessions.push(m.params.sessionId));
    await c.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    await new Promise(r => setTimeout(r, 500));
    for (const s of sessions) {
        const r = await c.send("Runtime.evaluate", { expression: "typeof globalThis.todoExplorer", returnByValue: true }, s, 3000).catch(() => null);
        if (r?.result?.result?.value === "object") return { ...c, sessionId: s, send: (m, p, _s, t) => c.send(m, p, s, t) };
    }
    c.close();
    throw new Error("No worker with globalThis.todoExplorer found (is the extension loaded?)");
}

switch (cmd) {
    case "start": {
        if (!MPR) {
            console.error('Set SP_MPR or "mpr" in local.config.json (see local.config.example.json).');
            process.exit(1);
        }
        // never touch other instances: if Studio Pro is already running (e.g. F5 from VS Code), stop here
        const running = runningPids();
        if (running.length) {
            console.error(`Studio Pro is already running (pid ${running.join(", ")}) – close it yourself; sp.mjs never closes other instances.`);
            process.exit(1);
        }
        // SP_NODEV=1: no dev flags, like a user who installed the extension from the Marketplace
        const flags = process.env.SP_NODEV ? [] : ["--enable-extension-development", "--enable-web-extensions"];
        const child = spawn(STUDIO_PRO, [MPR, ...flags], {
            detached: true,
            stdio: "ignore",
            env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` }
        });
        child.unref();
        writeFileSync(PID_FILE, String(child.pid));
        console.log(`Studio Pro ${SP_VERSION} started (pid ${child.pid}), CDP on port ${PORT}`);
        break;
    }
    case "stop": {
        // closes only the instance started by `sp.mjs start`; no /F, a normal window close
        const pid = existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, "utf8")) : 0;
        if (!pid || !runningPids().includes(pid)) {
            rmSync(PID_FILE, { force: true });
            console.log("No instance started by sp.mjs");
            break;
        }
        try { execSync(`taskkill /PID ${pid}`, { stdio: "ignore" }); } catch { /* already closed */ }
        for (let i = 0; i < 60 && runningPids().includes(pid); i++) await new Promise(r => setTimeout(r, 1000));
        rmSync(PID_FILE, { force: true });
        console.log("Studio Pro closed");
        break;
    }
    case "wait": {
        // waits until the extension exposes globalThis.todoExplorer
        for (let i = 0; ; i++) {
            try { (await extensionTarget()).close(); break; }
            catch (e) { if (i > 60) throw e; await new Promise(r => setTimeout(r, 2000)); }
        }
        console.log("Extension ready");
        break;
    }
    case "shot": {
        // page screenshot (e.g. the pane): node scripts/sp.mjs shot uiEntryPoint=pane out.png
        const [needle, file] = rest;
        const page = (await targets()).find(t => t.type === "page" && t.url.includes(needle));
        if (!page) throw new Error(`No page with "${needle}" in its URL`);
        const c = await connect(page.webSocketDebuggerUrl);
        const r = await c.send("Page.captureScreenshot", { format: "png" });
        c.close();
        writeFileSync(file, Buffer.from(r.result.data, "base64"));
        console.log(`Saved ${file}`);
        break;
    }
    case "targets":
        for (const t of await targets()) console.log(`${t.type}\t${t.title}\t${t.url.slice(0, 120)}`);
        break;
    case "eval": {
        const c = await extensionTarget();
        const r = await c.send("Runtime.evaluate", {
            expression: `(async () => (${rest.join(" ")}))()`,
            awaitPromise: true,
            returnByValue: true
        });
        c.close();
        const { result, exceptionDetails } = r.result;
        if (exceptionDetails) {
            console.error(exceptionDetails.exception?.description ?? exceptionDetails.text);
            process.exit(1);
        }
        console.log(JSON.stringify(result.value, null, 1));
        break;
    }
    case "logs": {
        const c = await extensionTarget();
        c.on(m => {
            if (m.method === "Runtime.consoleAPICalled" && m.sessionId === c.sessionId) {
                const args = m.params.args.map(a => a.value ?? a.description ?? a.type);
                console.log(`[${m.params.type}]`, ...args);
            }
        });
        await c.send("Runtime.enable");
        await new Promise(r => setTimeout(r, (Number(rest[0]) || 10) * 1000));
        c.close();
        break;
    }
    default:
        console.log("Usage: node scripts/sp.mjs start|stop|wait|targets|eval <expression>|logs [s]|shot <url> <png>");
}
