"use client";

import { TText } from "@/app/admin/T";
import { usePhrase } from "@/app/admin/usePhrase";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { parseHongKongDateTime } from "@/lib/hongKongTime";

import { labels } from "./labels";
import {
  buildDayTimeline,
  defaultTimelineDay,
  formatDayKey,
  hongKongDayKeyFromMs,
  hourLabel,
  shiftDayKey,
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
                  {row.blocks.map((block) => {
                    const className = block.overlaps
                      ? "border-destructive bg-destructive/15 text-destructive"
                      : "border-primary bg-primary/10 text-primary";
                    const style = {
                      left: `${block.left}%`,
                      width: `${Math.max(block.width, 1.5)}%`,
                    };
                    if (!block.href) {
                      return (
                        <div
                          key={block.id}
                          title={block.label}
                          className={`absolute top-1 flex h-8 items-center overflow-hidden rounded-md border border-dashed px-2 text-xs ${className}`}
                          style={style}
                        >
                          {block.label}
                        </div>
                      );
                    }
                    return (
                      <a
                        key={block.id}
                        href={block.href}
                        title={block.label}
                        className={`absolute top-1 flex h-8 items-center overflow-hidden rounded-md border px-2 text-xs hover:no-underline ${className}`}
                        style={style}
                      >
                        {block.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function draftDayKey(draft: { startsAt: string; endsAt: string } | null): string | null {
  if (!draft?.startsAt || !draft.endsAt) return null;
  const start = parseHongKongDateTime(draft.startsAt);
  const end = parseHongKongDateTime(draft.endsAt);
  if (start == null || end == null || !(end > start)) return null;
  return hongKongDayKeyFromMs(start);
}
