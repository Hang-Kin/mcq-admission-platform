import { isStaffRole } from "@/lib/staffRole";

/**
 * The older questions list and editor. Teachers delete here the same way they
 * do on the bank. The bank list does not hide the button by role.
 */
export function olderQuestionDeleteVisible(role: string | null | undefined): boolean {
  return isStaffRole(role);
}
