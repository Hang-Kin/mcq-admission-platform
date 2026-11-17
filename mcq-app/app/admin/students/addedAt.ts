import { formatHongKongStamp } from "@/lib/hongKongTime";

export function formatAddedAt(value: string, locale: "en" | "zh-Hant" = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatHongKongStamp(date.getTime(), locale);
}
