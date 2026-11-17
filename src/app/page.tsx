"use client";

import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/hooks";
import { AppShell } from "@/components/crew/app-shell";
import { AuthView } from "@/components/crew/auth-view";
import { Landing } from "@/components/crew/landing";
import { Onboarding } from "@/components/crew/onboarding";
import { navigateTo, routeTitle, ROUTE_HASH, useHashRoute } from "@/components/crew/router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { loading, session, error, refresh } = useSession();
  const route = useHashRoute();

  const user = session?.user ?? null;
  const memberships = session && "memberships" in session ? session.memberships : [];

  // Route guards: derive the correct view from auth state and redirect.
  useEffect(() => {
    if (route === null || loading) return;
    const isPublic = route === "landing" || route === "login" || route === "register";
    const isAppView =
      route === "overview" ||
      route === "crew" ||
      route === "teams" ||
      route === "tasks" ||
      route === "integrations" ||
      route === "settings";

    if (!user) {
      if (!isPublic) navigateTo(ROUTE_HASH.login, { replace: true });
      return;
    }
    if (isPublic) {
      navigateTo(memberships.length > 0 ? ROUTE_HASH.overview : ROUTE_HASH.onboarding, {
        replace: true,
      });
      return;
    }
    if (route === "onboarding" && memberships.length > 0) {
      navigateTo(ROUTE_HASH.overview, { replace: true });
      return;
    }
    if (isAppView && memberships.length === 0) {
      navigateTo(ROUTE_HASH.onboarding, { replace: true });
    }
  }, [route, loading, user, memberships.length]);

  // Keep the document title in sync with the active view.
  useEffect(() => {
    if (route !== null) document.title = routeTitle(route);
  }, [route]);

  const handleSignOut = useCallback(async () => {
    try {
      await api.logout();
      await refresh();
      navigateTo(ROUTE_HASH.landing);
      toast.success("Signed out.");
    } catch (signOutError) {
      toast.error(
        signOutError instanceof Error
          ? signOutError.message
          : "Sign out failed. Please try again."
      );
    }
  }, [refresh]);

  if (loading || route === null) {
    return <FullPageSkeleton />;
  }

  if (error && !user && route !== "login" && route !== "register") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
          <CircleAlert className="mx-auto size-8 text-destructive" aria-hidden />
          <h1 className="mt-3 text-base font-semibold">Could not load your session</h1>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void refresh()}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      </main>
    );
  }

  let view: ReactNode;
  if (!user) {
    if (route === "login") view = <AuthView mode="login" refresh={refresh} />;
    else if (route === "register") view = <AuthView mode="register" refresh={refresh} />;
    else view = <Landing />;
  } else if (route === "onboarding" || memberships.length === 0) {
    view = <Onboarding refresh={refresh} />;
  } else {
    view = (
      <AppShell
        user={user}
        memberships={memberships}
        route={route}
        refresh={refresh}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex w-full flex-1 flex-col">{view}</div>
      <AppFooter />
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:flex-row">
        <p>Orbit Crew — V1 · M1 Project Foundation</p>
        <p>© {new Date().getFullYear()} Orbit Crew</p>
      </div>
    </footer>
  );
}

function FullPageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading Orbit Crew"
      className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6"
    >
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
