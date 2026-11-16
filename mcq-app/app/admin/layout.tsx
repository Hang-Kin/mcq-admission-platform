import { connection } from "next/server";

import { SiteFrame } from "@/components/site-frame";

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
  return <SiteFrame pathname="/admin">{children}</SiteFrame>;
}
