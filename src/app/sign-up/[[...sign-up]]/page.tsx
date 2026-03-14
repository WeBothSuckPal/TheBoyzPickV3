import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignUp } from "@clerk/nextjs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isClerkConfigured } from "@/lib/env";

export default async function SignUpPage() {

  if (!isClerkConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invitation flow lives in Clerk</CardTitle>
            <CardDescription>
              Enable Clerk and use its built-in invitations to restrict who can join.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Until then, use the seeded demo account flow from the landing page.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 py-8">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>
      <SignUp path="/sign-up" />
    </main>
  );
}
