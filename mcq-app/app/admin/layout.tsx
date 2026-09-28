import { connection } from "next/server";

export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cacheComponents rejects `dynamic = "force-dynamic"`. connection() is the
  // supported way to refuse a prerendered shell and wait for a real request,
  // so the CDN cannot serve /admin without the proxy role check.
  await connection();
  return children;
}
