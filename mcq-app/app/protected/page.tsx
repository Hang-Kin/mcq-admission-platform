import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { Suspense } from "react";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return JSON.stringify(data.claims, null, 2);
}

export default function ProtectedPage() {
  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl">Your account</h1>
        <p className="text-sm text-muted-foreground">
          This page is only available while you are signed in.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Claims for the current sign-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted p-4 text-xs text-foreground">
            <Suspense>
              <UserDetails />
            </Suspense>
          </pre>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <h2 className="text-lg">Next steps</h2>
        <FetchDataSteps />
      </div>
    </div>
  );
}
