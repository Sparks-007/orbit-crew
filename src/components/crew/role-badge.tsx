import { Crown, Shield, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/contracts/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RoleMeta {
  label: string;
  icon: LucideIcon;
  className: string;
}

const ROLE_META: Record<Role, RoleMeta> = {
  OWNER: {
    label: "Owner",
    icon: Crown,
    className:
      "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400",
  },
  ADMIN: {
    label: "Admin",
    icon: Shield,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  MEMBER: {
    label: "Member",
    icon: User,
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", meta.className, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}
