import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getCurrentSettings, syncViewer } from "@/lib/clubhouse";
import { isClerkConfigured, isProduction } from "@/lib/env";
import type { ViewerProfile } from "@/lib/types";

export async function getOptionalViewer(): Promise<ViewerProfile | null> {
  if (!isClerkConfigured()) {
    if (isProduction()) {
      return null;
    }

    return await syncViewer({
      clerkUserId: "demo-admin",
      email: "commissioner@example.com",
      displayName: "Commissioner",
      role: "owner_admin",
    });
  }

  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const user = await currentUser();
  const primaryEmail =
    user?.emailAddresses.find(
      (entry) => entry.id === user.primaryEmailAddressId,
    )?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;

  if (!user || !primaryEmail) {
    return null;
  }

  return await syncViewer({
    clerkUserId: user.id,
    email: primaryEmail,
    displayName:
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.username ||
      "Club Member",
    imageUrl: user.imageUrl,
    role: "member",
  });
}

export async function requireViewer() {
  const viewer = await getOptionalViewer();
  if (!viewer) {
    redirect("/sign-in");
  }

  if (viewer.status === "suspended") {
    redirect("/suspended");
  }

  const settings = await getCurrentSettings();
  if (settings.maintenanceMode && viewer.role !== "owner_admin") {
    redirect("/maintenance");
  }

  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "owner_admin") {
    redirect("/today");
  }

  return viewer;
}
