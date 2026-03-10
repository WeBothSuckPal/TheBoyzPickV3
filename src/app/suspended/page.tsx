import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Awaiting approval</CardTitle>
          <CardDescription>
            Your account is pending commissioner approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          You&apos;ll get access as soon as the commissioner approves your account. Reach out to them directly if you need in sooner.
        </CardContent>
      </Card>
    </main>
  );
}
