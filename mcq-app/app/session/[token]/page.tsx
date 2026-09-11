import { SessionExam } from "./SessionExam";

export const instant = false;

export default async function SessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <SessionExam token={token} />;
}
