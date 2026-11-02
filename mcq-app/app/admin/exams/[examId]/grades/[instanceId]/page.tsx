import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { labels } from "../../../../results/labels";
import { UUID_RE } from "../../../../results/ids";

export const instant = false;

export default async function StudentGradePage({
  params,
}: {
  params: Promise<{ examId: string; instanceId: string }>;
}) {
  const { examId, instanceId } = await params;
  if (!UUID_RE.test(examId) || !UUID_RE.test(instanceId)) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">{labels.studentSittingNotFound}</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("test_instances")
    .select("id")
    .eq("id", instanceId)
    .eq("exam_id", examId)
    .maybeSingle();

  if (!data) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">{labels.studentSittingNotFound}</h1>
      </main>
    );
  }

  redirect(`/admin/review/${instanceId}`);
}
