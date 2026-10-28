"use server";

import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/staffRole";
import { createClient } from "@/lib/supabase/server";

import {
  drawErrorMessage,
  isMissingSchema,
  parseSittingId,
} from "./scheduleModel";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are not signed in. Refresh and log in again." } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isStaffRole(profile?.role)) {
    return { error: "You do not have permission to prepare questions." } as const;
  }

  return { supabase } as const;
}

export async function prepareSitting(formData: FormData) {
  const sittingId = parseSittingId(String(formData.get("sitting_id") ?? ""));
  if (!sittingId) return { error: "This sitting could not be found." };

  const force = String(formData.get("force") ?? "") === "1";
  const auth = await requireStaff();
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await auth.supabase.rpc("draw_timeslot_questions", {
    p_timeslot_id: sittingId,
    p_force: force,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return {
        error: "Preparing questions is waiting for a database update. Nothing was changed.",
      };
    }
    return { error: "Could not prepare questions. Try again." };
  }

  const result = readResult(data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/schedule");
}

function readResult(data: unknown): { ok: true } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Could not prepare questions." };
  }
  const record = data as { ok?: unknown; error?: unknown };
  if (record.ok === true) return { ok: true };
  const message = typeof record.error === "string" ? record.error : "Could not prepare questions.";
  return { ok: false, error: drawErrorMessage(message) };
}
