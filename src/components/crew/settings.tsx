"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Info, LogOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { renameOrgSchema } from "@/lib/contracts/api";
import type { MembershipSummary, OrgDetailResponse, SessionUser } from "@/lib/contracts/api";
import { hasPermission } from "@/lib/contracts/rbac";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { MembersManager } from "./members-manager";
import { RoleBadge } from "./role-badge";
import { UserAvatar } from "./user-avatar";
import { navigateTo, ROUTE_HASH } from "./router";
import { ACTIVE_ORG_SLUG_KEY, fieldErrors, formatDate } from "./shared";

interface SettingsViewProps {
  user: SessionUser;
  membership: MembershipSummary;
  refresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function SettingsView({ user, membership, refresh, onSignOut }: SettingsViewProps) {
  const [detail, setDetail] = useState<OrgDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});
  const [renamePending, setRenamePending] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, setDeletePending] = useState(false);

  const slug = membership.organization.slug;
  const role = membership.role;
  const canRename = hasPermission(role, "org:update");
  const isOwner = role === "OWNER";

  const loadDetail = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await api.getOrganization(slug));
    } catch (error) {
      setDetail(null);
      setLoadError(error instanceof Error ? error.message : "Could not load organization data.");
    }
  }, [slug]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadDetail(), refresh()]);
  }, [loadDetail, refresh]);

  const organizationName = detail?.organization.name ?? membership.organization.name;

  function openRenameDialog() {
    setRenameValue(detail?.organization.name ?? membership.organization.name);
    setRenameErrors({});
    setRenameOpen(true);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (renamePending) return;
    const parsed = renameOrgSchema.safeParse({ name: renameValue });
    if (!parsed.success) {
      setRenameErrors(fieldErrors(parsed.error));
      return;
    }
    setRenameErrors({});
    setRenamePending(true);
    try {
      await api.renameOrganization(slug, parsed.data.name);
      toast.success("Organization renamed.");
      setRenameOpen(false);
      await reloadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename the organization.");
    } finally {
      setRenamePending(false);
    }
  }

  async function confirmDelete() {
    if (deletePending || !detail) return;
    setDeletePending(true);
    try {
      await api.deleteOrganization(detail.organization.slug);
      toast.success(`"${detail.organization.name}" was deleted.`);
      window.localStorage.removeItem(ACTIVE_ORG_SLUG_KEY);
      await refresh();
      navigateTo(ROUTE_HASH.landing);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the organization.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace configuration for {organizationName}.
        </p>
      </header>

      {/* 1) Organization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Identity of your workspace.</CardDescription>
          <CardAction>
            {canRename ? (
              <Button variant="outline" className="h-11" onClick={openRenameDialog}>
                Rename
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && !detail ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <span className="min-w-0 flex-1">{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => void loadDetail()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <div className="mt-1 text-sm font-medium">
                  {detail ? detail.organization.name : <Skeleton className="h-5 w-44" />}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Slug</p>
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {slug}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <div className="mt-1 text-sm font-medium">
                  {detail ? formatDate(detail.organization.createdAt) : <Skeleton className="h-5 w-28" />}
                </div>
              </div>
            </div>
          )}
          {!canRename ? (
            <p className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Organization settings are read-only for members. Only owners and admins can rename
              the organization.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 2) Members */}
      {detail ? (
        <MembersManager
          slug={slug}
          organizationName={organizationName}
          actorRole={role}
          members={detail.members}
          onChanged={reloadAll}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>People with access to {organizationName}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </CardContent>
        </Card>
      )}

      {/* 3) Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your profile and session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} email={user.email} className="size-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Separator />
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Signed in as</dt>
              <dd className="mt-0.5 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Active organization</dt>
              <dd className="mt-0.5 font-medium">
                {organizationName}{" "}
                <span className="font-mono text-xs font-normal text-muted-foreground">/{slug}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Your role</dt>
              <dd className="mt-0.5">
                <RoleBadge role={role} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Session security</dt>
              <dd className="mt-0.5 font-medium">httpOnly cookie session</dd>
            </div>
          </dl>
          <Separator />
          <Button variant="outline" className="h-11" onClick={() => void onSignOut()}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </CardContent>
      </Card>

      {/* 4) Danger zone (OWNER only) */}
      {isOwner && detail ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Permanently delete {organizationName} and every membership in it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog
              onOpenChange={(open) => {
                if (!open) setDeleteConfirmText("");
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Delete organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {organizationName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the organization and removes all{" "}
                    {detail.members.length === 1 ? "1 member" : `${detail.members.length} members`}.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="confirm-delete-slug">
                    Type &quot;{detail.organization.slug}&quot; to confirm
                  </Label>
                  <Input
                    id="confirm-delete-slug"
                    value={deleteConfirmText}
                    onChange={(event) => setDeleteConfirmText(event.target.value)}
                    placeholder={detail.organization.slug}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={deletePending}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    disabled={deletePending || deleteConfirmText !== detail.organization.slug}
                    onClick={(event) => {
                      event.preventDefault();
                      void confirmDelete();
                    }}
                  >
                    {deletePending ? "Deleting…" : "Delete forever"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}

      {/* Rename organization dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename organization</DialogTitle>
            <DialogDescription>
              This name appears across the workspace. The slug never changes.
            </DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={submitRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-org-name">Organization name</Label>
              <Input
                id="rename-org-name"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                aria-invalid={renameErrors.name ? true : undefined}
                disabled={renamePending}
              />
              {renameErrors.name ? (
                <p className="text-xs font-medium text-destructive">{renameErrors.name}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={renamePending}
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renamePending}>
                {renamePending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
