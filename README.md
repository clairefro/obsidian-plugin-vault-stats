# Vault Stats

Obsidian plugin that shows vault statistics in a custom view (ribbon icon / command palette).

## Develop

```bash
npm install
npm run dev     # esbuild watch mode -> main.js (inline sourcemaps)
npm run build   # type-check + minified production build
```

Clone/symlink this folder into `<vault>/.obsidian/plugins/vault-stats/`,
enable the plugin, and install the
[Hot Reload](https://github.com/pjeby/hot-reload) plugin (it reloads on `main.js` changes
when a `.git` folder or `.hotreload` file exists in the plugin folder):

```bash
touch .hotreload
```

## Layout

- `src/main.ts`  – plugin entry: registers view, ribbon icon, command
- `src/view.ts`  – the custom `ItemView` (rendering)
- `src/stats.ts` – stats collection (no DOM)
- `src/format.ts` – formatting helpers
