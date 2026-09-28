// public.is_staff() is applied in the database (migration_001_role_rls.sql
// is not in this repo). Its check is profiles.role in ('admin', 'teacher'),
// which is the set every staff RLS policy relies on.

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "teacher";
}
