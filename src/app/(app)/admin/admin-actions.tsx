"use client";

import { useState } from "react";
import {
  runAiOpsAutopilotAction,
  runOddsSyncAction,
  runSettlementSweepAction,
  setMaintenanceModeAction,
  updateMemberAccessAction,
} from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/utils";

interface AdminMember {
  id: string;
  displayName: string;
  nickname: string | null;
  email: string;
  role: string;
  status: string;
}

interface AdminSettings {
  primaryBookmaker: string;
  minStakeCents: number;
  maxStakeCents: number;
  maxOpenSlipsPerUser: number;
  maintenanceMode: boolean;
}

function ConfirmActionButton({
  label,
  pendingLabel,
  variant = "secondary",
  className,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  confirmVariant = "default",
  action,
  hiddenFields,
}: {
  label: string;
  pendingLabel: string;
  variant?: "default" | "secondary";
  className?: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
  confirmVariant?: "default" | "danger";
  action: (prev: any, formData: FormData) => Promise<any>;
  hiddenFields?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        variant={confirmVariant}
        onConfirm={() => {
          const form = document.getElementById(`form-${label.replace(/\s+/g, "-").toLowerCase()}`) as HTMLFormElement;
          form?.requestSubmit();
        }}
      />
      <ActionForm action={action}>
        {(pending) => (
          <span id={`form-${label.replace(/\s+/g, "-").toLowerCase()}`} className="hidden">
            {hiddenFields && Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" disabled={pending}>
              {pending ? pendingLabel : label}
            </button>
          </span>
        )}
      </ActionForm>
    </>
  );
}

export function AdminOperations({
  mode,
  maintenanceMode,
  settings,
}: {
  mode: "demo" | "live";
  maintenanceMode: boolean;
  settings: AdminSettings;
}) {
  return (
    <div className="space-y-3">
      <ConfirmActionButton
        label="Run odds sync"
        pendingLabel="Syncing…"
        variant="default"
        className="w-full"
        confirmTitle="Run odds sync?"
        confirmDescription="This will fetch the latest odds from the configured bookmaker and update all game lines."
        confirmLabel="Run sync"
        action={runOddsSyncAction}
      />

      <ConfirmActionButton
        label="Run settlement sweep"
        pendingLabel="Settling…"
        className="w-full"
        confirmTitle="Run settlement sweep?"
        confirmDescription="This will auto-settle completed games and distribute payouts to members' wallets."
        confirmLabel="Run sweep"
        action={runSettlementSweepAction}
      />

      <ConfirmActionButton
        label="Run AI autopilot (hourly)"
        pendingLabel="Running…"
        className="w-full"
        confirmTitle="Run AI autopilot?"
        confirmDescription="This runs the hourly reliability scan, generating health scores and applying remediations."
        confirmLabel="Run autopilot"
        action={runAiOpsAutopilotAction}
        hiddenFields={{ mode: "hourly" }}
      />

      <ConfirmActionButton
        label="Run AI autopilot (nightly)"
        pendingLabel="Running…"
        className="w-full"
        confirmTitle="Run AI autopilot?"
        confirmDescription="This runs the nightly deep scan with full anomaly detection."
        confirmLabel="Run autopilot"
        action={runAiOpsAutopilotAction}
        hiddenFields={{ mode: "nightly" }}
      />

      {mode === "live" ? (
        <ConfirmActionButton
          label={maintenanceMode ? "Disable maintenance mode" : "Enable maintenance mode"}
          pendingLabel="Toggling…"
          className="w-full"
          confirmTitle={maintenanceMode ? "Disable maintenance mode?" : "Enable maintenance mode?"}
          confirmDescription={
            maintenanceMode
              ? "This will allow all members to access the app again."
              : "This will lock out all non-admin members from the app. Only admins will be able to access it."
          }
          confirmLabel={maintenanceMode ? "Disable" : "Enable"}
          confirmVariant={maintenanceMode ? "default" : "danger"}
          action={setMaintenanceModeAction}
          hiddenFields={{ enabled: maintenanceMode ? "false" : "true" }}
        />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-black/18 px-4 py-3 text-sm text-[var(--muted-foreground)]">
          Maintenance and member-access controls activate once the app is connected to the live database.
        </div>
      )}

      <div className="rounded-[28px] border border-white/10 bg-black/18 p-4 text-sm leading-7 text-[var(--muted-foreground)]">
        <div>Primary bookmaker: {settings.primaryBookmaker}</div>
        <div>
          Stakes: {formatCurrency(settings.minStakeCents)} to{" "}
          {formatCurrency(settings.maxStakeCents)}
        </div>
        <div>Max open slips: {settings.maxOpenSlipsPerUser}</div>
        <div>Maintenance mode: {settings.maintenanceMode ? "On" : "Off"}</div>
      </div>
    </div>
  );
}

export function MemberActions({
  member,
  viewerId,
  isLive,
}: {
  member: AdminMember;
  viewerId: string;
  isLive: boolean;
}) {
  if (!isLive || member.id === viewerId) return null;

  const isAdmin = member.role === "owner_admin";
  const isActive = member.status === "active";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ConfirmActionButton
        label={isAdmin ? "Demote" : "Promote"}
        pendingLabel={isAdmin ? "Demoting…" : "Promoting…"}
        confirmTitle={isAdmin ? `Demote ${member.displayName}?` : `Promote ${member.displayName}?`}
        confirmDescription={
          isAdmin
            ? `This will remove admin privileges from ${member.displayName}. They will no longer be able to access the admin panel.`
            : `This will give ${member.displayName} full admin privileges, including access to member management and operations.`
        }
        confirmLabel={isAdmin ? "Demote" : "Promote"}
        confirmVariant={isAdmin ? "danger" : "default"}
        action={updateMemberAccessAction}
        hiddenFields={{
          targetUserId: member.id,
          role: isAdmin ? "member" : "owner_admin",
        }}
      />

      <ConfirmActionButton
        label={isActive ? "Suspend" : "Approve"}
        pendingLabel={isActive ? "Suspending…" : "Approving…"}
        confirmTitle={isActive ? `Suspend ${member.displayName}?` : `Approve ${member.displayName}?`}
        confirmDescription={
          isActive
            ? `This will immediately block ${member.displayName} from accessing the app.`
            : `This will restore ${member.displayName}'s access to the app.`
        }
        confirmLabel={isActive ? "Suspend" : "Approve"}
        confirmVariant={isActive ? "danger" : "default"}
        action={updateMemberAccessAction}
        hiddenFields={{
          targetUserId: member.id,
          status: isActive ? "suspended" : "active",
        }}
      />
    </div>
  );
}
