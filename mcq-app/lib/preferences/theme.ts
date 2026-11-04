/** HSL channels consumed as `hsl(var(--token))` in Tailwind. */
export const themeVariables = {
  normal: {
    background: "0 0% 100%",
    foreground: "0 0% 18%",
    card: "0 0% 100%",
    "card-foreground": "0 0% 18%",
    popover: "0 0% 100%",
    "popover-foreground": "0 0% 18%",
    primary: "212 100% 18.6%",
    "primary-foreground": "0 0% 100%",
    secondary: "0 0% 96%",
    "secondary-foreground": "212 100% 18.6%",
    muted: "0 0% 96%",
    "muted-foreground": "0 0% 40%",
    accent: "0 0% 96%",
    "accent-foreground": "212 100% 18.6%",
    destructive: "0 72% 42%",
    "destructive-foreground": "0 0% 100%",
    border: "0 0% 86%",
    input: "0 0% 86%",
    ring: "212 100% 18.6%",
    "chart-1": "212 100% 18.6%",
    "chart-2": "212 35% 36%",
    "chart-3": "0 0% 45%",
    "chart-4": "0 0% 70%",
    "chart-5": "0 72% 42%",
    success: "142.03 78.05% 20.54%",
    warning: "36.49 99.2% 24.07%",
    "menu-border": "214.46 23.90% 40.05%",
    "menu-highlight": "212.79 76.48% 91.03%",
    "menu-highlight-foreground": "0 0% 18%",
    scrim: "0 0% 0%",
  },
  dark: {
    background: "217.4 50.24% 8.28%",
    foreground: "207 38% 95.93%",
    card: "217.72 46.36% 13.58%",
    "card-foreground": "207 38% 95.93%",
    popover: "217.72 46.36% 13.58%",
    "popover-foreground": "207 38% 95.93%",
    primary: "214.22 99.25% 74.36%",
    "primary-foreground": "216.2 69.93% 8.48%",
    secondary: "216.98 41.09% 21.03%",
    "secondary-foreground": "207 38% 95.93%",
    muted: "217.72 46.36% 13.58%",
    "muted-foreground": "215.07 26% 76.52%",
    accent: "217.62 40.25% 27.3%",
    "accent-foreground": "207 38% 95.93%",
    destructive: "359.45 99.3% 80.24%",
    "destructive-foreground": "216.2 69.93% 8.48%",
    border: "217.47 19.97% 44.36%",
    input: "217.47 19.97% 44.36%",
    ring: "41.76 99.8% 70.05%",
    "chart-1": "214.22 99.25% 74.36%",
    "chart-2": "144.39 71.8% 67.01%",
    "chart-3": "215.07 26% 76.52%",
    "chart-4": "217.47 19.97% 44.36%",
    "chart-5": "359.45 99.3% 80.24%",
    success: "144.39 71.8% 67.01%",
    warning: "41.76 99.8% 70.05%",
    "menu-border": "217.47 19.97% 44.36%",
    "menu-highlight": "215.25 40.43% 33.97%",
    "menu-highlight-foreground": "207 38% 95.93%",
    scrim: "0 0% 0%",
  },
  "light-contrast": {
    background: "0 0% 100%",
    foreground: "0 0% 3.92%",
    card: "214.5 48% 96.71%",
    "card-foreground": "0 0% 3.92%",
    popover: "214.5 48% 96.71%",
    "popover-foreground": "0 0% 3.92%",
    primary: "216.93 87.65% 30.24%",
    "primary-foreground": "0 0% 100%",
    secondary: "212.29 52.84% 93.77%",
    "secondary-foreground": "0 0% 3.92%",
    muted: "214.5 48% 96.71%",
    "muted-foreground": "214.53 19.69% 28.09%",
    accent: "214.53 57.68% 90.44%",
    "accent-foreground": "0 0% 3.92%",
    destructive: "359.6 80.56% 35.34%",
    "destructive-foreground": "0 0% 100%",
    border: "216.2 33.11% 17.89%",
    input: "216.2 33.11% 17.89%",
    ring: "17.22 87.9% 40.44%",
    "chart-1": "216.93 87.65% 30.24%",
    "chart-2": "142.03 78.05% 20.54%",
    "chart-3": "214.53 19.69% 28.09%",
    "chart-4": "216.2 33.11% 17.89%",
    "chart-5": "359.6 80.56% 35.34%",
    success: "142.03 78.05% 20.54%",
    // #794900. Specified #7A4B00 is 6.84:1 on the card, short of 7:1.
    warning: "35.75 99.45% 23.88%",
    "menu-border": "216.2 33.11% 17.89%",
    "menu-highlight": "215.51 67.15% 90.05%",
    "menu-highlight-foreground": "0 0% 3.92%",
    scrim: "0 0% 0%",
  },
} as const;

export type ThemeVariableName = keyof typeof themeVariables.normal;

export const TEXT_CONTRAST_MINIMUM = 4.5;
export const HIGH_CONTRAST_TEXT_MINIMUM = 7;
export const CONTROL_CONTRAST_MINIMUM = 3;

/** Text (or link) colour on its background. Normal must clear 4.5:1. */
export const textPairs: ReadonlyArray<{
  fg: ThemeVariableName;
  bg: ThemeVariableName;
}> = [
  { fg: "foreground", bg: "background" },
  { fg: "muted-foreground", bg: "background" },
  { fg: "muted-foreground", bg: "muted" },
  { fg: "primary-foreground", bg: "primary" },
  { fg: "primary", bg: "background" },
  { fg: "secondary-foreground", bg: "secondary" },
  { fg: "accent-foreground", bg: "accent" },
  { fg: "destructive-foreground", bg: "destructive" },
  { fg: "destructive", bg: "background" },
  { fg: "card-foreground", bg: "card" },
  { fg: "popover-foreground", bg: "popover" },
  { fg: "menu-highlight-foreground", bg: "menu-highlight" },
];

/** Text pairs for Dark and Light high contrast. Both must clear 7:1. */
export const highContrastTextPairs: ReadonlyArray<{
  fg: ThemeVariableName;
  bg: ThemeVariableName;
}> = [
  ...textPairs,
  { fg: "foreground", bg: "card" },
  { fg: "muted-foreground", bg: "card" },
  { fg: "primary", bg: "card" },
  { fg: "success", bg: "background" },
  { fg: "success", bg: "card" },
  { fg: "warning", bg: "background" },
  { fg: "warning", bg: "card" },
  { fg: "destructive", bg: "card" },
];

/** Borders and focus rings. High contrast themes must clear 3:1. */
export const controlPairs: ReadonlyArray<{
  fg: ThemeVariableName;
  bg: ThemeVariableName;
}> = [
  { fg: "border", bg: "background" },
  { fg: "border", bg: "card" },
  { fg: "input", bg: "background" },
  { fg: "ring", bg: "background" },
  { fg: "ring", bg: "card" },
  { fg: "menu-border", bg: "background" },
  { fg: "menu-border", bg: "card" },
];

export function hslChannelsToRgb(channels: string): [number, number, number] {
  const [hue, saturation, lightness] = channels.replaceAll("%", "").trim().split(/\s+/).map(Number);
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = l - c / 2;
  return [r, g, b].map((channel) => Math.round((channel + m) * 255)) as [number, number, number];
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(hslChannelsToRgb(foreground)), luminance(hslChannelsToRgb(background)));
  const darker = Math.min(luminance(hslChannelsToRgb(foreground)), luminance(hslChannelsToRgb(background)));
  return (lighter + 0.05) / (darker + 0.05);
}
