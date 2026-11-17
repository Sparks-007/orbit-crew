import { useCallback, useEffect, useState } from "react";

export type RouteName =
  | "landing"
  | "login"
  | "register"
  | "onboarding"
  | "overview"
  | "crew"
  | "teams"
  | "tasks"
  | "integrations"
  | "settings";

const PATH_TO_ROUTE: Record<string, RouteName> = {
  "": "landing",
  login: "login",
  register: "register",
  onboarding: "onboarding",
  overview: "overview",
  crew: "crew",
  teams: "teams",
  tasks: "tasks",
  integrations: "integrations",
  settings: "settings",
};

export const ROUTE_HASH: Record<RouteName, string> = {
  landing: "",
  login: "#/login",
  register: "#/register",
  onboarding: "#/onboarding",
  overview: "#/overview",
  crew: "#/crew",
  teams: "#/teams",
  tasks: "#/tasks",
  integrations: "#/integrations",
  settings: "#/settings",
};

const ROUTE_TITLES: Record<RouteName, string> = {
  landing: "Orbit Crew — Your AI workforce. Working together.",
  login: "Sign in — Orbit Crew",
  register: "Create your crew — Orbit Crew",
  onboarding: "Create your organization — Orbit Crew",
  overview: "Overview — Orbit Crew",
  crew: "My Crew — Orbit Crew",
  teams: "Teams — Orbit Crew",
  tasks: "Tasks — Orbit Crew",
  integrations: "Integrations — Orbit Crew",
  settings: "Settings — Orbit Crew",
};

const NAV_EVENT = "orbit-crew:navigate";

export function routeTitle(route: RouteName): string {
  return ROUTE_TITLES[route];
}

/** Maps a raw location.hash to a route. Unknown paths fall back to landing. */
export function parseHash(rawHash: string): RouteName {
  const path = rawHash.replace(/^#\/?/, "").replace(/\/+$/, "");
  return PATH_TO_ROUTE[path] ?? "landing";
}

/**
 * Client-side hash navigation. An empty target clears the hash (landing).
 * `replace: true` swaps the current history entry instead of pushing a new
 * one — used for auth/redirect flows so back buttons behave sensibly.
 */
export function navigateTo(hash: string, options?: { replace?: boolean }): void {
  if (typeof window === "undefined") return;
  const replace = options?.replace === true;
  const history = window.history;
  const state = history.state;
  const baseUrl = window.location.pathname + window.location.search;

  if (hash === "" || hash === "#") {
    if (replace) history.replaceState(state, "", baseUrl);
    else history.pushState(state, "", baseUrl);
    window.dispatchEvent(new Event(NAV_EVENT));
    return;
  }

  const normalized = hash.startsWith("#") ? hash : `#${hash}`;

  if (replace) {
    history.replaceState(state, "", baseUrl + normalized);
    window.dispatchEvent(new Event(NAV_EVENT));
    return;
  }

  if (window.location.hash === normalized) {
    window.dispatchEvent(new Event(NAV_EVENT));
    return;
  }
  window.location.hash = normalized;
}

/**
 * Tracks the current route derived from window.location.hash.
 * Returns null until the client has read the location — keeps SSR and
 * hydration consistent (callers render a loading skeleton meanwhile).
 */
export function useHashRoute(): RouteName | null {
  const [route, setRoute] = useState<RouteName | null>(null);

  useEffect(() => {
    const update = () => setRoute(parseHash(window.location.hash));
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener(NAV_EVENT, update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);

  return route;
}
