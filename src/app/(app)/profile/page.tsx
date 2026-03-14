import { requireViewer } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const isSetup = params.setup === "true";

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      {isSetup ? (
        <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-5 py-4 text-sm text-white">
          <strong>Welcome!</strong> Please enter your real name below so the commissioner knows who you are.
          You can also set a nickname — other members will see your nickname instead of your real name.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>
            Your real name is only visible to admins. Other members see your nickname.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm displayName={viewer.displayName} nickname={viewer.nickname} />

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Preview
            </div>
            <div className="mt-1 text-sm text-white">
              Other members see you as: <strong>{viewer.nickname ?? viewer.displayName}</strong>
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              (Updates after saving)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Email</span>
            <span className="text-white">{viewer.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Role</span>
            <span className="text-white">{viewer.role === "owner_admin" ? "Admin" : "Member"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Joined</span>
            <span className="text-white">{new Date(viewer.joinedAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
