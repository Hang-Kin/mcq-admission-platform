"use client";

import { TText } from "@/app/admin/T";
import { usePhrase } from "@/app/admin/usePhrase";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { parseHongKongDateTime } from "@/lib/hongKongTime";

import { labels } from "./labels";
import {
  buildDayTimeline,
  dayBlockLabelSide,
  defaultTimelineDay,
  formatDayKey,
  hongKongDayKeyFromMs,
  hourLabel,
  shiftDayKey,
  type DayBlock,
  type SittingWindow,
} from "./sittingRules";

export function SittingDayGrid({
  slots,
  clashSlots,
  nowMs,
  draft,
}: {
  slots: SittingWindow[];
  clashSlots: SittingWindow[];
  nowMs: number;
  draft: { startsAt: string; endsAt: string } | null;
}) {
  const today = hongKongDayKeyFromMs(nowMs);
  const knownDays = useMemo(() => {
    const days: string[] = [];
    for (const slot of slots) {
      const start = parseHongKongDateTime(slot.startsAt);
      if (start != null) days.push(hongKongDayKeyFromMs(start));
    }
    return days;
  }, [slots]);
  const [day, setDay] = useState(() => defaultTimelineDay(knownDays, today));
  const draftDay = draftDayKey(draft);

  useEffect(() => {
    if (draftDay) setDay(draftDay);
  }, [draftDay]);

  const timeline = buildDayTimeline({ day, slots, clashSlots, draft });
  const tx = usePhrase();

  return (
    <section className="space-y-3" aria-label={tx(labels.dayView)}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base"><TText text={labels.dayView} /></h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setDay((current) => shiftDayKey(current, -1))}>
          <TText text={labels.previousDay} />
        </Button>
        <p className="text-sm">{formatDayKey(day)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setDay((current) => shiftDayKey(current, 1))}>
          <TText text={labels.nextDay} />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground"><TText text={labels.dayViewHelp} /></p>
      {timeline.draftOnAnotherDay ? (
        <p className="text-sm text-muted-foreground"><TText text={labels.draftOnAnotherDay} /></p>
      ) : null}
      {timeline.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground"><TText text={labels.noSittingsThisDay} /></p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[40rem] items-center gap-y-2"
            style={{ gridTemplateColumns: `8rem repeat(${timeline.hours.length}, minmax(3rem, 1fr))` }}
          >
            <div />
            {timeline.hours.map((hour) => (
              <div key={hour} className="px-1 text-xs text-muted-foreground">
                {hourLabel(hour)}
              </div>
            ))}
            {timeline.rows.map((row) => (
              <div key={row.id} className="contents">
                <div className="truncate pr-3 text-sm">{row.label}</div>
                <div
                  className="relative h-10 border-b border-border"
                  style={{ gridColumn: `2 / span ${timeline.hours.length}` }}
                >
                  {row.blocks.map((block) => (
                    <DayBlockView key={block.id} block={block} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DayBlockView({ block }: { block: DayBlock }) {
  const side = dayBlockLabelSide(block);
  const tone = block.overlaps
    ? "border-destructive bg-destructive/15 text-destructive"
    : "border-primary bg-primary/10 text-primary";
  const style = {
    left: `${block.left}%`,
    width: `${Math.max(block.width, 1.5)}%`,
  };
  const className = [
    "absolute top-1 flex h-8 items-center rounded-md border text-xs",
    block.href ? "hover:no-underline" : "border-dashed",
    side === "inside" ? "overflow-hidden px-2" : "overflow-visible",
    tone,
  ].join(" ");
  const label =
    side === "inside" ? (
      block.label
    ) : (
      <span
        className={
          side === "before"
            ? "absolute right-full top-0 flex h-8 max-w-[10rem] items-center truncate whitespace-nowrap pr-1"
            : "absolute left-full top-0 flex h-8 max-w-[10rem] items-center truncate whitespace-nowrap pl-1"
        }
      >
        {block.label}
      </span>
    );
  if (!block.href) {
    return (
      <div title={block.label} className={className} style={style}>
        {label}
      </div>
    );
  }
  return (
    <a href={block.href} title={block.label} className={className} style={style}>
      {label}
    </a>
  );
}

function draftDayKey(draft: { startsAt: string; endsAt: string } | null): string | null {
  if (!draft?.startsAt || !draft.endsAt) return null;
  const start = parseHongKongDateTime(draft.startsAt);
  const end = parseHongKongDateTime(draft.endsAt);
  if (start == null || end == null || !(end > start)) return null;
  return hongKongDayKeyFromMs(start);
}
