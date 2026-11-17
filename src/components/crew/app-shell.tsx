"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Blocks,
  Building2,
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Network,
  Settings,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MembershipSummary, SessionUser } from "@/lib/contracts/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandIcon, BrandMark } from "./brand";
import { Overview } from "./overview";
import { PlaceholderSection, type PlaceholderSectionProps } from "./placeholder-section";
import { navigateTo, ROUTE_HASH, type RouteName } from "./router";
import { SettingsView } from "./settings";
import { ACTIVE_ORG_SLUG_KEY } from "./shared";
import { ThemeToggle } from "./theme-toggle";
import { UserAvatar } from "./user-avatar";

const NAV_ITEMS: ReadonlyArray<{ name: RouteName; label: string; icon: LucideIcon }> = [
  { name: "overview", label: "Overview", icon: LayoutDashboard },
  { name: "crew", label: "My Crew", icon: UsersRound },
  { name: "teams", label: "Teams", icon: Network },
  { name: "tasks", label: "Tasks", icon: ListChecks },
  { name: "integrations", label: "Integrations", icon: Blocks },
  { name: "settings", label: "Settings", icon: Settings },
];

const PLACEHOLDERS: Record<"crew" | "teams" | "tasks" | "integrations", PlaceholderSectionProps> = {
  crew: {
    icon: UsersRound,
    title: "My Crew",
    description:
      "Your AI employees will live here — create them, configure their roles and assign work.",
    chip: "Coming in M3 — AI employees",
    buttonLabel: "Available after M3",
  },
  teams: {
    icon: Network,
    title: "Teams",
    description:
      "Group employees into teams with shared goals, coordinated by an AI Coordinator.",
    chip: "Coming in V2 — AI Coordinator and teams",
    buttonLabel: "Available in V2",
  },
  tasks: {
    icon: ListChecks,
    title: "Tasks",
    description: "Delegate, track and review work across your organization.",
    chip: "Coming in M4 — Task execution",
    buttonLabel: "Available after M4",
  },
  integrations: {
    icon: Blocks,
    title: "Integrations",
    description:
      "Bring your own model keys and connect the tools your crew will use.",
    chip: "Coming in M2 — Model gateway (BYOK)",
    buttonLabel: "Available after M2",
  },
};

function navItemClass(active: boolean): string {
  return cn(
    "flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  );
}

interface OrgSwitcherProps {
  memberships: MembershipSummary[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

function OrgSwitcher({ memberships, activeSlug, onSelect }: OrgSwitcherProps) {
  const active =
    memberships.find((membership) => membership.organization.slug === activeSlug) ?? memberships[0];
  if (!active) return null;

  const identity = (
    <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
      <span className="w-full truncate text-sm font-medium">{active.organization.name}</span>
      <span className="hidden w-full truncate text-xs text-muted-foreground sm:block">
        {active.organization.slug}
      </span>
    </span>
  );

  if (memberships.length <= 1) {
    return (
      <div
        className="flex h-11 min-w-0 max-w-[220px] items-center gap-2.5 rounded-md border bg-background px-3"
        title={active.organization.name}
      >
        <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
        {identity}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="Switch organization"
          className="h-11 min-w-0 max-w-[220px] justify-start gap-2.5 px-3"
        >
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
          {identity}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((membership) => {
          const isActive = membership.organization.slug === activeSlug;
          return (
            <DropdownMenuItem
              key={membership.organization.id}
              className="items-start gap-2 py-2"
              onSelect={() => onSelect(membership.organization.slug)}
            >
              <Check
                className={cn("mt-0.5 size-4 shrink-0", isActive ? "text-primary" : "text-transparent")}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{membership.organization.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {membership.organization.slug}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface UserMenuProps {
  user: SessionUser;
  onSignOut: () => Promise<void>;
}

function UserMenu({ user, onSignOut }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Open account menu" className="size-11 gap-2 px-1.5">
          <UserAvatar name={user.name} email={user.email} className="size-8" />
          <span className="hidden min-w-0 max-w-[140px] truncate text-sm font-medium lg:inline">
            {user.name}
          </span>
          <ChevronsUpDown className="hidden size-4 shrink-0 text-muted-foreground lg:inline" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => void onSignOut()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface AppShellProps {
  user: SessionUser;
  memberships: MembershipSummary[];
  route: RouteName;
  onSignOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function AppShell({ user, memberships, route, onSignOut, refresh }: AppShellProps) {
  const [storedSlug, setStoredSlug] = useState<string>(() => {
    const stored = window.localStorage.getItem(ACTIVE_ORG_SLUG_KEY);
    if (stored && memberships.some((membership) => membership.organization.slug === stored)) {
      return stored;
    }
    return memberships[0]?.organization.slug ?? "";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Derive a valid active slug at render time instead of correcting state
  // inside an effect: stale entries (e.g. an organization deleted elsewhere)
  // fall back to the first membership.
  const slugIsValid = memberships.some(
    (membership) => membership.organization.slug === storedSlug
  );
  const activeSlug = slugIsValid
    ? storedSlug
    : (memberships[0]?.organization.slug ?? "");

  // Persist the effective slug — a pure external-system side effect.
  useEffect(() => {
    if (slugIsValid && activeSlug) {
      window.localStorage.setItem(ACTIVE_ORG_SLUG_KEY, activeSlug);
    }
  }, [slugIsValid, activeSlug]);

  const selectOrg = useCallback((slug: string) => {
    setStoredSlug(slug);
    setMobileNavOpen(false);
  }, []);

  const activeMembership =
    memberships.find((membership) => membership.organization.slug === activeSlug) ?? memberships[0];
  if (!activeMembership) return null;

  const goTo = (hash: string) => {
    navigateTo(hash);
    setMobileNavOpen(false);
  };

  const renderView = (): ReactNode => {
    switch (route) {
      case "overview":
        return <Overview user={user} membership={activeMembership} />;
      case "crew":
        return <PlaceholderSection {...PLACEHOLDERS.crew} />;
      case "teams":
        return <PlaceholderSection {...PLACEHOLDERS.teams} />;
      case "tasks":
        return <PlaceholderSection {...PLACEHOLDERS.tasks} />;
      case "integrations":
        return <PlaceholderSection {...PLACEHOLDERS.integrations} />;
      case "settings":
        return (
          <SettingsView
            user={user}
            membership={activeMembership}
            refresh={refresh}
            onSignOut={onSignOut}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <BrandMark />
          <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            V1
          </span>
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.name === route;
            return (
              <button
                key={item.name}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => navigateTo(ROUTE_HASH[item.name])}
                className={navItemClass(active)}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">V1 · M1 Project Foundation</p>
        </div>
      </aside>

      {/* Mobile navigation */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <BrandIcon className="size-7" />
              Orbit Crew
            </SheetTitle>
            <SheetDescription className="sr-only">
              Primary navigation and organization switcher.
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.name === route;
              return (
                <button
                  key={item.name}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(ROUTE_HASH[item.name])}
                  className={navItemClass(active)}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>
          {memberships.length > 1 ? (
            <div className="border-t p-3">
              <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Organizations
              </p>
              <div className="space-y-1">
                {memberships.map((membership) => {
                  const active = membership.organization.slug === activeSlug;
                  return (
                    <button
                      key={membership.organization.id}
                      type="button"
                      onClick={() => selectOrg(membership.organization.slug)}
                      className={cn(
                        "flex h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-sm",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span className="min-w-0 truncate">{membership.organization.name}</span>
                      {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="border-t p-4 text-xs text-muted-foreground">V1 · M1 Project Foundation</div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:gap-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <span className="md:hidden">
            <BrandMark />
          </span>
          <OrgSwitcher memberships={memberships} activeSlug={activeSlug} onSelect={selectOrg} />
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu user={user} onSignOut={onSignOut} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {renderView()}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
