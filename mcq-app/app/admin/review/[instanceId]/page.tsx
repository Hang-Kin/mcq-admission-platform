import { TText } from "@/app/admin/T";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatHongKongDateTime } from "@/lib/hongKongTime";
import { isStaffRole } from "@/lib/staffRole";

import { isGradeStale, scoreResponses } from "../../exams/gradeScore";
import { labels } from "../../results/labels";
import { UUID_RE } from "../../results/ids";
import { loadReviewSitting } from "../../results/loadReview";
import { ReviewPaper } from "../../results/ReviewPaper";
import { requireStaff } from "../../results/staffGate";
import { FinalizeControl } from "../MarkControls";

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
        <h1 className="text-2xl"><TText text={labels.review} /></h1>
        <p className="text-sm text-muted-foreground">{staff.error}</p>
      </main>
    );
  }

  if (!UUID_RE.test(instanceId)) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl"><TText text={labels.review} /></h1>
        <p className="text-sm text-muted-foreground"><TText text={labels.sittingNotFound} /></p>
      </main>
    );
  }

  const loaded = await loadReviewSitting(staff.supabase, instanceId);
  if (!loaded.ok) {
    return (
      <main className="space-y-2">
        <h1 className="text-2xl"><TText text={labels.review} /></h1>
        <p className="text-sm text-destructive">{loaded.error}</p>
      </main>
    );
  }

  const sitting = loaded.sitting;
  const title = sitting.studentName.trim() || sitting.submissionCode || labels.student;
  const {
    data: { user },
  } = await staff.supabase.auth.getUser();
  const { data: profile } = user
    ? await staff.supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = isStaffRole(profile?.role) && profile?.role === "admin";

  const answered = sitting.questions.filter((question) => question.responseId);
  const score = scoreResponses(
    answered.map((question) => ({
      is_correct: question.finalCorrect,
      needs_review: question.needsReview,
    })),
    sitting.assignedCount,
  );
  const unanswered = Math.max(0, score.total - answered.length);
  const stale =
    sitting.finalizedPercent != null && isGradeStale(sitting.finalizedPercent, score);
  const finalizedWhen = formatHongKongDateTime(sitting.finalizedAt);

  const header = (
    <>
      <header className="space-y-2">
        <p className="text-sm">
          <Link href="/admin/review" className="hover:underline">
            <TText text={labels.backToResults} />
          </Link>
        </p>
        <h1 className="text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {[sitting.submissionCode, sitting.chineseName.trim(), sitting.examName]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {sitting.status !== "submitted" ? (
          <p className="text-sm text-muted-foreground"><TText text={labels.notSubmitted} /></p>
        ) : null}
      </header>

      <section className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-lg"><TText text={labels.score} /></h2>
        <p><TText text={labels.scoreLine(score.correct, score.total, score.percent)} /></p>
        <p className="text-sm text-muted-foreground"><TText text={labels.scoreDetail} /></p>
        {unanswered > 0 ? (
          <p className="text-sm text-muted-foreground"><TText text={labels.unanswered(unanswered)} /></p>
        ) : null}
        {score.pendingReview > 0 ? (
          <p className="text-sm text-destructive"><TText text={labels.pendingReview(score.pendingReview)} /></p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {sitting.finalizedPercent != null ? (
            <Badge><TText text={labels.finalizedBadge(sitting.finalizedPercent, finalizedWhen)} /></Badge>
          ) : (
            <Badge variant="secondary"><TText text={labels.notFinalized} /></Badge>
          )}
          {stale ? <Badge variant="destructive"><TText text={labels.changedSinceFinalize} /></Badge> : null}
        </div>
        {isAdmin && sitting.status === "submitted" && sitting.examId ? (
          <FinalizeControl
            examId={sitting.examId}
            instanceId={sitting.instanceId}
            alreadyFinalized={sitting.finalizedPercent != null}
          />
        ) : null}
      </section>
    </>
  );

  return (
    <main>
      <ReviewPaper
        questions={sitting.questions}
        instanceId={sitting.instanceId}
        markingReady={sitting.markingReady}
        header={header}
      />
    </main>
  );
}
