export type InstanceStatus = "none" | "pending" | "in_progress" | "submitted";

export type QrStudent = {
  id: string;
  name: string | null;
  application_number: string;
  instanceStatus: InstanceStatus;
};

export type QuestionSetOption = {
  name: string;
  count: number;
};

export function normalizeInstanceStatus(status: string | null | undefined): InstanceStatus {
  if (status === "pending" || status === "in_progress" || status === "submitted") {
    return status;
  }
  if (!status) return "none";
  return "in_progress";
}
