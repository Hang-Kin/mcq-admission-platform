import Link from "next/link";

import { UUID_RE } from "../../results/ids";
import { loadReviewSitting } from "../../results/loadReview";
import { ReviewPaper } from "../../results/ReviewPaper";
import { requireStaff } from "../../results/staffGate";

export const instant = false;

export default async function ReviewSittingPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const staff = await requireStaff();
  if (!staff.ok) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">Review</h1>
        <p className="text-sm text-muted-foreground">{staff.error}</p>
      </main>
    );
  }

  if (!UUID_RE.test(instanceId)) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">Review</h1>
        <p className="text-sm text-muted-foreground">This sitting was not found.</p>
      </main>
    );
  }

  const loaded = await loadReviewSitting(staff.supabase, instanceId);
  if (!loaded.ok) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl">Review</h1>
        <p className="text-sm text-destructive">{loaded.error}</p>
      </main>
    );
  }

  const sitting = loaded.sitting;
  const title = sitting.studentName.trim() || sitting.submissionCode || "Student";

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm">
          <Link href="/admin/review" className="hover:underline">
            Back to results
          </Link>
        </p>
        <h1 className="text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {[sitting.submissionCode, sitting.chineseName.trim(), sitting.examName]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {sitting.status !== "submitted" ? (
          <p className="text-sm text-muted-foreground">This sitting is not submitted yet.</p>
        ) : null}
        {sitting.examId ? (
          <p className="text-sm">
            <Link
              href={`/admin/exams/${sitting.examId}/grades/${sitting.instanceId}`}
              className="hover:underline"
            >
              Open the grade page
            </Link>
          </p>
        ) : null}
      </header>
      <ReviewPaper questions={sitting.questions} />
    </main>
  );
}
