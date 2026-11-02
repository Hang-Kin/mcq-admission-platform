import { redirect } from "next/navigation";

export const instant = false;

export default async function ExamTimeslotsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  redirect(`/admin/schedule?exam=${encodeURIComponent(examId)}`);
}
