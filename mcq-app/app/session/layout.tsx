import { SiteFrame } from "@/components/site-frame";

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteFrame pathname="/session">{children}</SiteFrame>;
}
