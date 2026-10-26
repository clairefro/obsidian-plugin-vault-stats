import { App, TFile, TFolder, getAllTags } from "obsidian";

export interface ExtensionStats {
  ext: string;
  count: number;
  size: number;
}

export interface VaultStats {
  files: TFile[];
  notes: TFile[];
  folderCount: number;
  totalSize: number;
  byExtension: ExtensionStats[];
  words: number;
  links: number;
  unresolvedLinks: number;
  tagCount: number;
  largest: TFile[];
  recent: TFile[];
  oldestNote: TFile | null;
}

export async function collectStats(app: App): Promise<VaultStats> {
  const { vault, metadataCache } = app;
  const files = vault.getFiles();
  const notes = files.filter((f) => f.extension === "md");
  const folderCount = vault
    .getAllLoadedFiles()
    .filter((f) => f instanceof TFolder && !f.isRoot()).length;

  // Totals + extension breakdown
  let totalSize = 0;
  const extMap = new Map<string, ExtensionStats>();
  for (const f of files) {
    totalSize += f.stat.size;
    const ext = f.extension || "(none)";
    const entry = extMap.get(ext) ?? { ext, count: 0, size: 0 };
    entry.count++;
    entry.size += f.stat.size;
    extMap.set(ext, entry);
  }
  const byExtension = [...extMap.values()].sort((a, b) => b.count - a.count);

  // Word count (notes only)
  let words = 0;
  for (const f of notes) {
    const text = await vault.cachedRead(f);
    words += (text.match(/\S+/g) ?? []).length;
  }

  // Links
  let links = 0;
  for (const targets of Object.values(metadataCache.resolvedLinks)) {
    for (const n of Object.values(targets)) links += n;
  }
  let unresolvedLinks = 0;
  for (const targets of Object.values(metadataCache.unresolvedLinks)) {
    unresolvedLinks += Object.keys(targets).length;
  }

  // Tags
  const tags = new Set<string>();
  for (const f of notes) {
    const cache = metadataCache.getFileCache(f);
    if (cache) getAllTags(cache)?.forEach((t) => tags.add(t));
  }

  const largest = [...files].sort((a, b) => b.stat.size - a.stat.size).slice(0, 5);
  const recent = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 5);
  const oldestNote = notes.length
    ? [...notes].sort((a, b) => a.stat.ctime - b.stat.ctime)[0]
    : null;

  return {
    files,
    notes,
    folderCount,
    totalSize,
    byExtension,
    words,
    links,
    unresolvedLinks,
    tagCount: tags.size,
    largest,
    recent,
    oldestNote,
  };
}
