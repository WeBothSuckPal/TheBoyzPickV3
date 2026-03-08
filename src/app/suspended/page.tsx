import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Access paused</CardTitle>
          <CardDescription>
            This account is currently suspended from the club.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Contact the commissioner if you think this is a mistake.
        </CardContent>
      </Card>
    </main>
  );
}
