import { SignUp } from "@clerk/nextjs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isClerkConfigured, isProduction } from "@/lib/env";

function resolveTicket(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage(props: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const invitationTicket = resolveTicket(searchParams.__clerk_ticket ?? searchParams.ticket);

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
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-8">
      <SignUp />
    </main>
  );
}
