"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Crown, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { addMemberSchema } from "@/lib/contracts/api";
import type { MemberDto, Role } from "@/lib/contracts/api";
import { canActOn, hasPermission } from "@/lib/contracts/rbac";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadge } from "./role-badge";
import { UserAvatar } from "./user-avatar";
import { fieldErrors, formatDate } from "./shared";

interface RoleAction {
  to: Role;
  label: string;
  requiresConfirm: boolean;
}

interface MembersManagerProps {
  slug: string;
  organizationName: string;
  actorRole: Role;
  members: MemberDto[];
  /** Refetches org detail and session after every mutation. */
  onChanged: () => Promise<void>;
}

function displayName(member: MemberDto): string {
  const name = member.user.name?.trim();
  return name && name.length > 0 ? name : member.user.email;
}

/** Role changes the actor may offer for this target, per RBAC matrix. */
function roleActionsFor(actorRole: Role, target: MemberDto): RoleAction[] {
  if (!canActOn(actorRole, target.role)) return [];
  const actions: RoleAction[] = [];
  if (target.role === "MEMBER" && hasPermission(actorRole, "member:update:member")) {
    actions.push({ to: "ADMIN", label: "Make admin", requiresConfirm: false });
  }
  if (target.role === "ADMIN" && hasPermission(actorRole, "member:update:admin")) {
    actions.push({ to: "MEMBER", label: "Set as member", requiresConfirm: false });
  }
  if (hasPermission(actorRole, "ownership:transfer")) {
    actions.push({ to: "OWNER", label: "Transfer ownership", requiresConfirm: true });
  }
  return actions;
}

function canRemove(actorRole: Role, target: MemberDto): boolean {
  if (!canActOn(actorRole, target.role)) return false;
  const permission = target.role === "MEMBER" ? "member:remove:member" : "member:remove:admin";
  return hasPermission(actorRole, permission);
}

export function MembersManager({ slug, organizationName, actorRole, members, onChanged }: MembersManagerProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addPending, setAddPending] = useState(false);

  const [rolePendingId, setRolePendingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberDto | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [transferTarget, setTransferTarget] = useState<MemberDto | null>(null);
  const [transferPending, setTransferPending] = useState(false);

  const canAdd = hasPermission(actorRole, "member:add");
  const showAdminOption = hasPermission(actorRole, "member:add:admin");

  function openAddDialog() {
    setAddEmail("");
    setAddRole("MEMBER");
    setAddErrors({});
    setAddOpen(true);
  }

  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addPending) return;
    const parsed = addMemberSchema.safeParse({ email: addEmail, role: addRole });
    if (!parsed.success) {
      setAddErrors(fieldErrors(parsed.error));
      return;
    }
    setAddErrors({});
    setAddPending(true);
    try {
      const result = await api.addMember(slug, parsed.data);
      toast.success(`${displayName(result.member)} added as ${result.member.role.toLowerCase()}.`);
      setAddOpen(false);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the member.");
    } finally {
      setAddPending(false);
    }
  }

  async function applyRoleChange(target: MemberDto, to: Role) {
    if (rolePendingId) return;
    setRolePendingId(target.id);
    try {
      await api.updateMemberRole(slug, target.id, { role: to });
      toast.success(
        to === "OWNER"
          ? `${displayName(target)} is now the owner.`
          : `${displayName(target)} is now ${to.toLowerCase()}.`
      );
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the role.");
    } finally {
      setRolePendingId(null);
    }
  }

  async function confirmRemove() {
    const target = removeTarget;
    if (!target || removePending) return;
    setRemovePending(true);
    try {
      await api.removeMember(slug, target.id);
      toast.success(`${displayName(target)} was removed.`);
      setRemoveTarget(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the member.");
    } finally {
      setRemovePending(false);
    }
  }

  async function confirmTransfer() {
    const target = transferTarget;
    if (!target || transferPending) return;
    setTransferPending(true);
    try {
      await api.updateMemberRole(slug, target.id, { role: "OWNER" });
      toast.success(`${displayName(target)} is now the owner. You continue as an admin.`);
      setTransferTarget(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transfer ownership.");
    } finally {
      setTransferPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members</CardTitle>
        <CardDescription>
          {members.length === 1 ? "1 member" : `${members.length} members`} in {organizationName}.
        </CardDescription>
        <CardAction>
          {canAdd ? (
            <Button className="h-11" onClick={openAddDialog}>
              <Plus className="size-4" aria-hidden />
              Add member
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No members yet.
          </p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-lg border [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const roleActions = roleActionsFor(actorRole, member);
                  const removable = canRemove(actorRole, member);
                  const busy = rolePendingId === member.id;
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={member.user.name} email={member.user.email} className="size-9" />
                          <span className="min-w-0">
                            <span className="block max-w-[200px] truncate text-sm font-medium">
                              {displayName(member)}
                            </span>
                            <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
                              {member.user.email}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(member.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {roleActions.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-9"
                                  aria-label={`Change role for ${displayName(member)}`}
                                  disabled={busy}
                                >
                                  <MoreHorizontal className="size-4" aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {roleActions
                                  .filter((action) => !action.requiresConfirm)
                                  .map((action) => (
                                    <DropdownMenuItem
                                      key={action.to}
                                      onSelect={() => void applyRoleChange(member, action.to)}
                                    >
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                {roleActions.some((action) => action.requiresConfirm) ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-primary focus:text-primary"
                                      onSelect={() => setTransferTarget(member)}
                                    >
                                      <Crown className="size-4" aria-hidden />
                                      Transfer ownership
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                          {removable ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${displayName(member)}`}
                              disabled={busy}
                              onClick={() => setRemoveTarget(member)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add member */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Add a person to {organizationName}. They must have an Orbit Crew account.
            </DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={submitAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-member-email">Email</Label>
              <Input
                id="add-member-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="teammate@company.com"
                value={addEmail}
                onChange={(event) => setAddEmail(event.target.value)}
                aria-invalid={addErrors.email ? true : undefined}
                disabled={addPending}
              />
              {addErrors.email ? (
                <p className="text-xs font-medium text-destructive">{addErrors.email}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-member-role">Role</Label>
              <Select
                value={addRole}
                onValueChange={(value: string) => {
                  if (value === "ADMIN" || value === "MEMBER") setAddRole(value);
                }}
                disabled={addPending}
              >
                <SelectTrigger id="add-member-role" className="w-full">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  {showAdminOption ? <SelectItem value="ADMIN">ADMIN (owner only)</SelectItem> : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins can add members, update member roles and rename the organization.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={addPending} onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addPending}>
                {addPending ? "Adding…" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${displayName(removeTarget)} will immediately lose access to ${organizationName}.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={removePending}
              onClick={(event) => {
                event.preventDefault();
                void confirmRemove();
              }}
            >
              {removePending ? "Removing…" : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer ownership */}
      <AlertDialog
        open={transferTarget !== null}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {transferTarget
                ? `${displayName(transferTarget)} will become the OWNER of ${organizationName}. You will continue as an ADMIN and can no longer manage admins or transfer ownership again.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={transferPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmTransfer();
              }}
            >
              {transferPending ? "Transferring…" : "Transfer ownership"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
