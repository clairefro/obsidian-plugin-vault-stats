import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { collectStats } from "./stats";
import { formatBytes, formatDate } from "./format";

export const VIEW_TYPE = "vault-stats-view";

export class StatsView extends ItemView {
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
    await this.render();
  }

  async onClose() {
    this.contentEl.empty();
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("vault-stats");

    const header = el.createDiv({ cls: "vault-stats-header" });
    header.createEl("h2", { text: "Vault statistics" });
    header.createEl("button", { text: "Refresh" }).addEventListener("click", () => this.render());

    const loading = el.createEl("p", { text: "Crunching numbers…" });
    const s = await collectStats(this.app);
    loading.remove();

    // Summary cards
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

    // Extension table
    el.createEl("h3", { text: "Files by extension" });
    const table = el.createEl("table");
    const head = table.createEl("thead").createEl("tr");
    ["Extension", "Files", "Size"].forEach((t) => head.createEl("th", { text: t }));
    const body = table.createEl("tbody");
    for (const { ext, count, size } of s.byExtension) {
      const row = body.createEl("tr");
      row.createEl("td", { text: "." + ext });
      row.createEl("td", { text: count.toLocaleString() });
      row.createEl("td", { text: formatBytes(size) });
    }

    el.createEl("h3", { text: "Largest files" });
    this.fileList(el, s.largest, (f) => formatBytes(f.stat.size));

    el.createEl("h3", { text: "Recently modified" });
    this.fileList(el, s.recent, (f) => formatDate(f.stat.mtime));

    if (s.oldestNote) {
      el.createEl("p", {
        cls: "vault-stats-footnote",
        text: `Oldest note: ${s.oldestNote.basename} (created ${formatDate(s.oldestNote.stat.ctime)})`,
      });
    }
  }

  private fileList(parent: HTMLElement, files: TFile[], rightText: (f: TFile) => string) {
    const ul = parent.createEl("ul", { cls: "vault-stats-list" });
    for (const f of files) {
      const li = ul.createEl("li");
      li.createEl("a", { text: f.path }).addEventListener("click", () =>
        this.app.workspace.getLeaf(false).openFile(f)
      );
      li.createSpan({ cls: "vault-stats-muted", text: rightText(f) });
    }
  }
}
