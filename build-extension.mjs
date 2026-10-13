import * as esbuild from 'esbuild'
import {copyToAppPlugin, copyManifestPlugin, commonConfig} from "./build.helpers.mjs"
import parseArgs from "minimist"
import fs from "node:fs/promises"
import { existsSync } from "node:fs"

const outDir = `dist/todo-explorer`
const extensionDirectoryName = "extensions"

const entryPoints = [
    {
        in: 'src/main/index.ts',
        out: 'main'
    }
]

entryPoints.push({
    in: 'src/ui/index.tsx',
    out: 'pane'
})

const args = parseArgs(process.argv.slice(2))
// esbuild nie czyści outDir – stare chunki trafiłyby do aplikacji i do pakietu
await fs.rm(outDir, { recursive: true, force: true })
// target app: --app "C:\path\to\app" or "appDir" in local.config.json (see local.config.example.json);
// without either, the build only goes to dist/
const localConfig = existsSync("local.config.json") ? JSON.parse(await fs.readFile("local.config.json", "utf8")) : {}
const appDir = args.app ?? localConfig.appDir ?? ""
const buildContext = await esbuild.context({
  ...commonConfig,
  outdir: outDir,
  plugins: [copyManifestPlugin(outDir), copyToAppPlugin(appDir, outDir, extensionDirectoryName)],
  entryPoints,
  define: { __DEV__: String(!('release' in args)), ...('release' in args && { "process.env.NODE_ENV": '"production"' }) },
  minifySyntax: 'release' in args, // usuwa martwe gałęzie if (__DEV__)
  sourcemap: !('release' in args) // pakiet na Marketplace bez map źródeł
})

if('watch' in args) {
    await buildContext.watch();
}
else {
    await buildContext.rebuild();
    await buildContext.dispose();
}


