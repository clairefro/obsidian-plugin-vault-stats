import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { mount, register, Mounted } from "pele/core";
import pie from "pele/diagrams/pie";
import { collectStats, VaultStats } from "./stats";
import { buildSizePieSource } from "./chart";
import { formatBytes, formatDate } from "./format";

export const VIEW_TYPE = "vault-stats-view";

// Only bundle the diagram type we use (keeps main.js small)
register(pie);

type SortKey = "name" | "ext" | "size" | "mtime";

const MIN_SIZES: [string, number][] = [
  ["Any size", 0],
  ["> 10 KB", 10 * 1024],
  ["> 100 KB", 100 * 1024],
  ["> 1 MB", 1024 * 1024],
  ["> 10 MB", 10 * 1024 * 1024],
];

export class StatsView extends ItemView {
  private pie: Mounted | null = null;

  // Explorer state (survives refreshes of the view)
  private query = "";
  private ext = "all";
  private minSize = 0;
  private sortKey: SortKey = "size";
  private desc = true;
  private limit = 25;

  private updateExplorer: () => void = () => {};
  private extSelect: HTMLSelectElement | null = null;
  private explorerEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Vault statistics";
  }

  getIcon() {
    return "bar-chart-3";
  }

  async onOpen() {
    await this.renderStats();
  }

  async onClose() {
    this.pie?.destroy();
    this.pie = null;
    this.contentEl.empty();
  }

  async renderStats() {
    const el = this.contentEl;
    this.pie?.destroy();
    this.pie = null;
    el.empty();
    el.addClass("vault-stats");

    const header = el.createDiv({ cls: "vault-stats-header" });
    header.createEl("h2", { text: "Vault statistics" });
    header.createEl("button", { text: "Refresh" }).addEventListener("click", () => this.renderStats());

    const loading = el.createEl("p", { text: "Crunching numbers…" });
    const s = await collectStats(this.app);
    loading.remove();

    this.renderCards(el, s);
    const breakdown = el.createDiv({ cls: "vault-stats-breakdown" });
    this.renderPie(breakdown.createDiv({ cls: "vault-stats-breakdown-panel" }), s);
    this.renderExtensionTable(breakdown.createDiv({ cls: "vault-stats-breakdown-panel" }), s);
    this.renderExplorer(el, s);

    if (s.oldestNote) {
      el.createEl("p", {
        cls: "vault-stats-footnote",
        text: `Oldest note: ${s.oldestNote.basename} (created ${formatDate(s.oldestNote.stat.ctime)})`,
      });
    }
  }

  // ---------- summary cards ----------
  private renderCards(el: HTMLElement, s: VaultStats) {
    const cards: [string, string][] = [
      ["Files", s.files.length.toLocaleString()],
      ["Notes", s.notes.length.toLocaleString()],
      ["Folders", s.folderCount.toLocaleString()],
      ["Vault size", formatBytes(s.totalSize)],
      ["Words", s.words.toLocaleString()],
      ["Avg words / note", s.notes.length ? Math.round(s.words / s.notes.length).toLocaleString() : "0"],
      ["Links", s.links.toLocaleString()],
      ["Unresolved links", s.unresolvedLinks.toLocaleString()],
      ["Unique tags", s.tagCount.toLocaleString()],
    ];
    const grid = el.createDiv({ cls: "vault-stats-grid" });
    for (const [label, value] of cards) {
      const card = grid.createDiv({ cls: "vault-stats-card" });
      card.createDiv({ cls: "vault-stats-value", text: value });
      card.createDiv({ cls: "vault-stats-label", text: label });
    }
  }

  // ---------- pie chart (Pele) ----------
  private renderPie(el: HTMLElement, s: VaultStats) {
    el.createEl("h3", { text: "Size by extension" });
    const container = el.createDiv({ cls: "vault-stats-pie" });
    if (!s.byExtension.some((e) => e.size > 0)) {
      container.setText("No data to chart.");
      return;
    }
    this.pie = mount(container, buildSizePieSource(s.byExtension), {
      onError: (err) => console.error("[vault-stats] pie render failed", err),
    });
  }

  // ---------- extension table (click a row to filter the explorer) ----------
  private renderExtensionTable(el: HTMLElement, s: VaultStats) {
    el.createEl("h3", { text: "Files by extension" });
    const table = el.createEl("table", { cls: "vault-stats-ext-table" });
    const head = table.createEl("thead").createEl("tr");
    ["Extension", "Files", "Size"].forEach((t) => head.createEl("th", { text: t }));
    const body = table.createEl("tbody");
    for (const { ext, count, size } of s.byExtension) {
      const row = body.createEl("tr", { cls: "vault-stats-clickable", attr: { title: `Explore .${ext} files` } });
      row.createEl("td", { text: "." + ext });
      row.createEl("td", { text: count.toLocaleString() });
      row.createEl("td", { text: formatBytes(size) });
      row.addEventListener("click", () => {
        this.ext = ext;
        if (this.extSelect) this.extSelect.value = ext;
        this.limit = 25;
        this.updateExplorer();
        this.explorerEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  // ---------- file explorer ----------
  private renderExplorer(el: HTMLElement, s: VaultStats) {
    const wrap = el.createDiv({ cls: "vault-stats-explorer" });
    this.explorerEl = wrap;
    wrap.createEl("h3", { text: "Explore files" });

    const controls = wrap.createDiv({ cls: "vault-stats-controls" });

    const search = controls.createEl("input", {
      type: "search",
      placeholder: "Filter by path…",
      value: this.query,
    });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.limit = 25;
      this.updateExplorer();
    });

    const extSelect = controls.createEl("select");
    this.extSelect = extSelect;
    extSelect.createEl("option", { text: "All extensions", value: "all" });
    for (const { ext, count } of s.byExtension) {
      extSelect.createEl("option", { text: `.${ext} (${count})`, value: ext });
    }
    extSelect.value = this.ext;
    extSelect.addEventListener("change", () => {
      this.ext = extSelect.value;
      this.limit = 25;
      this.updateExplorer();
    });

    const sizeSelect = controls.createEl("select");
    for (const [label, bytes] of MIN_SIZES) {
      sizeSelect.createEl("option", { text: label, value: String(bytes) });
    }
    sizeSelect.value = String(this.minSize);
    sizeSelect.addEventListener("change", () => {
      this.minSize = Number(sizeSelect.value);
      this.limit = 25;
      this.updateExplorer();
    });

    const listEl = wrap.createDiv({ cls: "vault-stats-explorer-list" });
    const maxSize = Math.max(1, ...s.files.map((f) => f.stat.size));

    this.updateExplorer = () => {
      listEl.empty();
      const q = this.query.trim().toLowerCase();
      const matches = s.files.filter(
        (f) =>
          (this.ext === "all" || (f.extension || "(none)") === this.ext) &&
          f.stat.size >= this.minSize &&
          (!q || f.path.toLowerCase().includes(q))
      );
      matches.sort((a, b) => {
        let cmp: number;
        switch (this.sortKey) {
          case "name": cmp = a.path.localeCompare(b.path); break;
          case "ext": cmp = a.extension.localeCompare(b.extension) || a.path.localeCompare(b.path); break;
          case "mtime": cmp = a.stat.mtime - b.stat.mtime; break;
          default: cmp = a.stat.size - b.stat.size;
        }
        return this.desc ? -cmp : cmp;
      });

      const matchedSize = matches.reduce((sum, f) => sum + f.stat.size, 0);
      listEl.createDiv({
        cls: "vault-stats-muted",
        text: `${matches.length.toLocaleString()} matching files · ${formatBytes(matchedSize)}`,
      });

      const table = listEl.createEl("table", { cls: "vault-stats-files" });
      const headRow = table.createEl("thead").createEl("tr");
      const cols: [string, SortKey][] = [["Name", "name"], ["Type", "ext"], ["Size", "size"], ["Modified", "mtime"]];
      for (const [label, key] of cols) {
        const arrow = this.sortKey === key ? (this.desc ? " ↓" : " ↑") : "";
        const th = headRow.createEl("th", { text: label + arrow, cls: "vault-stats-clickable" });
        th.addEventListener("click", () => {
          if (this.sortKey === key) this.desc = !this.desc;
          else { this.sortKey = key; this.desc = key !== "name" && key !== "ext"; }
          this.updateExplorer();
        });
      }

      const body = table.createEl("tbody");
      for (const f of matches.slice(0, this.limit)) {
        const row = body.createEl("tr");
        const nameCell = row.createEl("td", { cls: "vault-stats-name" });
        nameCell.createEl("a", { text: f.path }).addEventListener("click", () => this.openFile(f));
        row.createEl("td", { text: f.extension ? "." + f.extension : "" });
        const sizeCell = row.createEl("td", { cls: "vault-stats-size" });
        sizeCell.createDiv({ text: formatBytes(f.stat.size) });
        const bar = sizeCell.createDiv({ cls: "vault-stats-bar" });
        bar.style.width = `${Math.max(1, (f.stat.size / maxSize) * 100)}%`;
        row.createEl("td", { text: formatDate(f.stat.mtime), cls: "vault-stats-muted" });
      }

      if (matches.length > this.limit) {
        const more = listEl.createEl("button", {
          text: `Show ${Math.min(25, matches.length - this.limit)} more`,
        });
        more.addEventListener("click", () => { this.limit += 25; this.updateExplorer(); });
      }
    };

    this.updateExplorer();
  }

  private openFile(f: TFile) {
    this.app.workspace.getLeaf("tab").openFile(f);
  }
}
