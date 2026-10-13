// Sample data for a test app (no loops: unconfigured loops cause errors CE0099/CE0104/CE0105).
// Run: node scripts/sp.mjs eval "$(cat scripts/seed-test-data.js)"
// Idempotent: skips microflows that already exist.
(async () => {
    const sp = todoExplorer.studioPro, mf = sp.app.model.microflows;
    const mod = await sp.app.model.modules.getModule("MyFirstModule");
    const have = new Set((await mf.getUnitsInfo()).map(u => u.moduleName + "." + u.name));
    const samples = {
        TodoSamples: [
            "TODO: zwykła adnotacja",
            "FIXME: wieloliniowa\r\nautor: Jan\r\ndata: 2026-10-13",
            "zwykły komentarz bez markera",
            "todo małymi literami (nie powinno być znalezione)"
        ],
        TodoSamples_Second: [
            "TODO: drugi dokument do grupowania",
            "HACK: marker spoza domyślnej listy"
        ]
    };
    const created = [];
    for (const [name, captions] of Object.entries(samples)) {
        if (have.has("MyFirstModule." + name)) continue;
        const objects = await Promise.all(captions.map((caption, i) =>
            mf.createElement("Microflows$Annotation", { caption, x: 100 + i * 250, y: 250 })));
        await mf.addMicroflow(mod.$ID, { name, objects }, true);
        created.push(name);
    }
    return { created };
})()
