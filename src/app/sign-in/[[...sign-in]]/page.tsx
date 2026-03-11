import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignIn } from "@clerk/nextjs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isClerkConfigured } from "@/lib/env";

export default function SignInPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Clerk setup required</CardTitle>
            <CardDescription>
              Add your Clerk publishable and secret keys to enable invitation-only sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            The rest of the app can still be explored in demo mode from the home page.
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
      <SignIn />
    </main>
  );
}
