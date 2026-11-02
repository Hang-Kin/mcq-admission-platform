"use client";

import { useState, type ReactNode } from "react";

import { AddTimeForm } from "./SittingsForms";
import { SittingDayGrid } from "./SittingDayGrid";
import type { SittingWindow } from "./sittingRules";

export function SittingSchedule({
  examId,
  examMinutes,
  prominent,
  canAdd,
  gridSlots,
  clashSlots,
  nowMs,
  children,
}: {
  examId: string;
  examMinutes: number;
  prominent: boolean;
  canAdd: boolean;
  gridSlots: SittingWindow[];
  clashSlots: SittingWindow[];
  nowMs: number;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState({ startsAt: "", endsAt: "" });

  return (
    <div className="space-y-4">
      <SittingDayGrid slots={gridSlots} clashSlots={clashSlots} nowMs={nowMs} draft={draft} />
      {children}
      {canAdd ? (
        <AddTimeForm
          examId={examId}
          prominent={prominent}
          examMinutes={examMinutes}
          peers={clashSlots}
          onDraftChange={setDraft}
        />
      ) : null}
    </div>
  );
}
