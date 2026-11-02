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
  },
  contrast: {
    background: "0 0% 0%",
    foreground: "52 100% 50%",
    card: "0 0% 0%",
    "card-foreground": "52 100% 50%",
    popover: "0 0% 0%",
    "popover-foreground": "52 100% 50%",
    primary: "52 100% 50%",
    "primary-foreground": "0 0% 0%",
    secondary: "0 0% 0%",
    "secondary-foreground": "52 100% 50%",
    muted: "0 0% 0%",
    "muted-foreground": "52 100% 50%",
    accent: "52 100% 50%",
    "accent-foreground": "0 0% 0%",
    destructive: "0 100% 50%",
    "destructive-foreground": "0 0% 0%",
    border: "52 100% 50%",
    input: "52 100% 50%",
    ring: "52 100% 50%",
    "chart-1": "52 100% 50%",
    "chart-2": "48 100% 50%",
    "chart-3": "45 100% 50%",
    "chart-4": "0 0% 100%",
    "chart-5": "0 100% 50%",
  },
} as const;

export type ThemeVariableName = keyof typeof themeVariables.normal;

export const TEXT_CONTRAST_MINIMUM = 4.5;

/** Text (or link) colour on its background. Both themes must clear 4.5:1. */
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
