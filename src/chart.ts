import { ExtensionStats } from "./stats";
import { formatBytes } from "./format";

/**
 * Builds Mermaid `pie` source (rendered by Pele) of vault size per extension.
 * The biggest `maxSlices` extensions get their own slice; the rest become "other".
 */
export function buildSizePieSource(byExtension: ExtensionStats[], maxSlices = 8): string {
  const sorted = byExtension.filter((e) => e.size > 0).sort((a, b) => b.size - a.size);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);

  const slices = top.map((e) => ({ label: "." + e.ext, size: e.size }));
  if (rest.length) {
    slices.push({
      label: `other (${rest.length} types)`,
      size: rest.reduce((sum, e) => sum + e.size, 0),
    });
  }

  const lines = slices.map((s) => {
    const label = `${s.label} · ${formatBytes(s.size)}`.replace(/"/g, "'");
    return `  "${label}" : ${s.size}`;
  });
  return ["pie title Vault size by extension", ...lines].join("\n");
}
