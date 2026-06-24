export interface Theme {
  key: string;
  emoji: string;
  primary: string;
  primaryDark: string;
  bg: string;
  panel: string;
  text: string;
  muted: string;
  heroFrom: string;
  heroTo: string;
}

const THEMES: Record<string, Theme> = {
  meadow: {
    key: "meadow", emoji: "🌾",
    primary: "#3f8f4f", primaryDark: "#2f6e3c",
    bg: "#f7faf4", panel: "#ffffff", text: "#1f2a1f", muted: "#5e7460",
    heroFrom: "#dff0d8", heroTo: "#b7dcb0",
  },
  harvest: {
    key: "harvest", emoji: "🌽",
    primary: "#c9802b", primaryDark: "#a9661c",
    bg: "#fdf8f0", panel: "#ffffff", text: "#2c2113", muted: "#7c6a53",
    heroFrom: "#fbe7c6", heroTo: "#f3cd92",
  },
  berry: {
    key: "berry", emoji: "🍓",
    primary: "#b03a5b", primaryDark: "#8c2c47",
    bg: "#fdf4f6", panel: "#ffffff", text: "#2a1620", muted: "#7e5c67",
    heroFrom: "#f6d6de", heroTo: "#e9aebd",
  },
  coastal: {
    key: "coastal", emoji: "🐚",
    primary: "#2f7d8f", primaryDark: "#235f6e",
    bg: "#f3fafb", panel: "#ffffff", text: "#142428", muted: "#557078",
    heroFrom: "#cfeaef", heroTo: "#a3d6df",
  },
};

export function getTheme(key: string): Theme {
  return THEMES[key] ?? THEMES.meadow;
}
