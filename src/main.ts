import { Plugin, WorkspaceLeaf } from "obsidian";
import { StatsView, VIEW_TYPE } from "./view";

export default class VaultStatsPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new StatsView(leaf));

    this.addRibbonIcon("bar-chart-3", "Vault statistics", () => this.activateView());

    this.addCommand({
      id: "open-vault-stats",
      name: "Open vault statistics",
      callback: () => this.activateView(),
    });
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | undefined = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
}
