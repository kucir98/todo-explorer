// styles as a string injected into <head>: the Studio Pro pane page doesn't load a separate CSS file from the bundle
export const css = `
:root[data-theme="light"] {
  --bg: #ffffff; --bg-hover: #f0f0f0; --bg-bar: #f6f6f6; --fg: #1e1e1e; --fg-muted: #6e6e6e; --border: #e0e0e0;
  --accent: #0e639c; --todo-bg: #e6f1fb; --todo-fg: #0c447c; --fixme-bg: #fcebeb; --fixme-fg: #791f1f;
  --hack-bg: #faeeda; --hack-fg: #633806; --error-bg: #fcebeb; --error-fg: #791f1f;
}
:root[data-theme="dark"] {
  --bg: #252526; --bg-hover: #2a2d2e; --bg-bar: #2d2d2d; --fg: #cccccc; --fg-muted: #9d9d9d; --border: #3c3c3c;
  --accent: #3794ff; --todo-bg: #0c447c; --todo-fg: #b5d4f4; --fixme-bg: #791f1f; --fixme-fg: #f7c1c1;
  --hack-bg: #633806; --hack-fg: #fac775; --error-bg: #501313; --error-fg: #f7c1c1;
}
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); font: 12px "Segoe UI", system-ui, sans-serif; }
#root { display: flex; flex-direction: column; height: 100%; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--border); }
.toolbar input[type=text] { width: 180px; height: 22px; padding: 0 6px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); font: inherit; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border: 1px solid var(--border); border-radius: 3px; background: none; color: var(--fg); font: inherit; cursor: pointer; }
.chip.off { color: var(--fg-muted); text-decoration: line-through; }
.chip.off .badge { opacity: .5; }
.muted { color: var(--fg-muted); }
.spacer { margin-left: auto; }
.btn { height: 22px; padding: 0 8px; border: 1px solid var(--border); background: none; color: var(--fg); font: inherit; cursor: pointer; }
.btn:hover, .row:hover { background: var(--bg-hover); }
.tree { flex: 1; overflow: auto; padding: 2px 0; }
.row { display: flex; align-items: center; gap: 6px; padding: 1px 8px; line-height: 20px; cursor: pointer; white-space: nowrap; }
.row .text { overflow: hidden; text-overflow: ellipsis; }
.chev { width: 12px; text-align: center; color: var(--fg-muted); flex: none; }
.kind { font-size: 10px; color: var(--fg-muted); border: 1px solid var(--border); border-radius: 2px; padding: 0 3px; line-height: 14px; }
.badge { font: 10px Consolas, monospace; padding: 0 4px; border-radius: 2px; line-height: 16px; flex: none; }
.badge.TODO { background: var(--todo-bg); color: var(--todo-fg); }
.badge.FIXME { background: var(--fixme-bg); color: var(--fixme-fg); }
.badge.HACK { background: var(--hack-bg); color: var(--hack-fg); }
.more { padding: 0 8px 4px 0; color: var(--fg-muted); white-space: pre-wrap; }
.status { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-top: 1px solid var(--border); background: var(--bg-bar); }
.status.error { background: var(--error-bg); color: var(--error-fg); }
.progress { width: 200px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.progress > div { height: 100%; background: var(--accent); }
.empty { padding: 16px 8px; color: var(--fg-muted); }
`;
