import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MaintenancePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Maintenance mode</CardTitle>
          <CardDescription>
            Clubhouse Lines is temporarily paused while the commissioner performs maintenance.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Member actions are disabled until maintenance mode is lifted.
        </CardContent>
      </Card>
    </main>
  );
}
