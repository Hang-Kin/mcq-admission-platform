import { SiteFrame } from "@/components/site-frame";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteFrame pathname="/protected">{children}</SiteFrame>;
}
