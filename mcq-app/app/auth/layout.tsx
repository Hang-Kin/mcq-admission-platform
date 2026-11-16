import { SiteFrame } from "@/components/site-frame";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteFrame pathname="/auth/login">{children}</SiteFrame>;
}
