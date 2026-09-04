import type { TournamentConfig } from "./config";

/** Black or white, whichever reads better on the given colour. */
export function contrastColor(hex: string) {
  const value = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(value)) return "#ffffff";
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(value >> 16) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255);
  return luminance > 0.4 ? "#161511" : "#ffffff";
}

/**
 * Pushes the configured look onto the document: the accent colour feeds the
 * whole `accent-*` palette.
 */
export function applyTheme(config: TournamentConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent", config.accentColor);
  root.style.setProperty("--accent-contrast", contrastColor(config.accentColor));
}
