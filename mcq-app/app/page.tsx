import Link from "next/link";

import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <SiteFrame pathname="/">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl">MCQ Admission</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Staff sign in to run the admission exam.
        </p>
        <Button asChild>
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    </SiteFrame>
  );
}
