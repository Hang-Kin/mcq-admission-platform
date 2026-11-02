// Staff is profiles.role in ('admin', 'teacher'), the same set as isStaffRole.
// Kept local so this file can be tested without the Next.js path alias.

export const STAFF_HOME_PATH = "/admin";
export const SIGN_IN_PATH = "/auth/login";
export const NON_STAFF_PATH = "/protected";

function isStaff(role: string | null | undefined): boolean {
  return role === "admin" || role === "teacher";
}

export function postSignInPath(role: string | null | undefined): string {
  return isStaff(role) ? STAFF_HOME_PATH : NON_STAFF_PATH;
}

/**
 * Where /protected should send this visitor.
 * Signed-out visitors go to sign-in. Admin and teacher go to /admin.
 * Other signed-in roles stay here. proxy.ts sends non-staff from /admin
 * back to /protected, so sending them to /admin would loop.
 */
export function protectedRedirectTarget(input: {
  signedIn: boolean;
  role: string | null | undefined;
}): string | null {
  if (!input.signedIn) return SIGN_IN_PATH;
  if (isStaff(input.role)) return STAFF_HOME_PATH;
  return null;
}
