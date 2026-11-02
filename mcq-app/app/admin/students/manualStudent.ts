import { APPLICATION_NUMBER_RE, composeIntake } from "./intakeLabel";

export type ManualStudentFields = {
  name: string;
  chineseName: string | null;
  applicationNumber: string;
  intake: string;
};

export function parseManualStudent(
  formData: FormData,
): { error: string } | ManualStudentFields {
  const name = String(formData.get("name") ?? "").trim();
  const applicationNumber = String(formData.get("application_number") ?? "").trim();
  const intake = composeIntake(
    String(formData.get("intake_year") ?? ""),
    String(formData.get("intake_month") ?? ""),
  );
  const chineseName = String(formData.get("chinese_name") ?? "").trim();

  if (!intake) return { error: "Choose an intake." };
  if (!name) return { error: "Full English name is required." };
  if (!APPLICATION_NUMBER_RE.test(applicationNumber)) {
    return { error: "提交編號 must be 4 digits." };
  }

  return {
    name,
    chineseName: chineseName.length > 0 ? chineseName : null,
    applicationNumber,
    intake,
  };
}

export function manualStudentInsert(student: ManualStudentFields) {
  return {
    name: student.name,
    chinese_name: student.chineseName,
    application_number: student.applicationNumber,
    intake: student.intake,
  };
}
