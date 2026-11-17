"use client";

import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { Calendar, RotateCcw, Shield, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useOrgDetailStore } from "@/lib/client/org-detail";
import type { MembershipSummary, SessionUser } from "@/lib/contracts/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "./role-badge";
import { navigateTo, ROUTE_HASH } from "./router";
import { firstNameOf, formatDate } from "./shared";

const NEXT_UP: ReadonlyArray<{ milestone: string; text: string }> = [
  { milestone: "Planned M2", text: "Model gateway — connect AI models with your own API keys." },
  { milestone: "Planned M2", text: "Encrypted credential vault for your integrations." },
  { milestone: "Planned M3", text: "First AI employees, managed alongside your human team." },
];

interface OverviewProps {
  user: SessionUser;
  membership: MembershipSummary;
}

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <div className="mt-1.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

export function Overview({ user, membership }: OverviewProps) {
  const detail = useOrgDetailStore((s) => s.data);
  const loadError = useOrgDetailStore((s) => s.error);
  const loadOrg = useOrgDetailStore((s) => s.load);
  const slug = membership.organization.slug;

  useEffect(() => {
    void loadOrg(slug);
  }, [loadOrg, slug]);

  // Manual retry path: force a fresh fetch of the same slug.
  const reload = useCallback(() => loadOrg(slug, true), [loadOrg, slug]);

  const firstName = firstNameOf(user.name);
  const welcomeTitle = firstName.length > 0 ? `Good to see you, ${firstName}` : "Good to see you";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{welcomeTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Here is where your organization stands today.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {membership.organization.name}
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                {membership.organization.slug}
              </Badge>
            </CardTitle>
            <CardDescription>Your active organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadError ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <span className="min-w-0 flex-1">{loadError}</span>
                <Button variant="outline" size="sm" onClick={() => void reload()}>
                  <RotateCcw className="size-4" aria-hidden />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  icon={Users}
                  label="Members"
                  value={
                    detail ? (
                      String(detail.members.length)
                    ) : (
                      <Skeleton className="h-5 w-10" />
                    )
                  }
                />
                <StatTile icon={Shield} label="Your role" value={<RoleBadge role={membership.role} />} />
                <StatTile
                  icon={Calendar}
                  label="Created"
                  value={
                    detail ? (
                      formatDate(detail.organization.createdAt)
                    ) : (
                      <Skeleton className="h-5 w-24" />
                    )
                  }
                />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="h-11" onClick={() => navigateTo(ROUTE_HASH.settings)}>
                View settings
              </Button>
              <Button variant="secondary" className="h-11" onClick={() => navigateTo(ROUTE_HASH.settings)}>
                Manage members
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What&apos;s next</CardTitle>
            <CardDescription>Planned milestones — nothing to configure yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {NEXT_UP.map((item) => (
                <li key={item.text} className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed">{item.text}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                    {item.milestone}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">
              V1 ships the foundation — these capabilities arrive in upcoming milestones and are
              not configurable yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
