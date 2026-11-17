"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { api, ApiClientError } from "./api";
import type { SessionResponse } from "@/lib/contracts/api";

/**
 * Session store (Zustand).
 *
 * The session is a small external system; components subscribe to it via
 * selectors. Load/refresh actions mutate the store directly (no component
 * setState in effects — compliant with the react-hooks v6 rules and free of
 * cascading-render warnings).
 */

interface SessionStoreState {
  /** True only until the first session check settles (drives the boot skeleton). */
  loading: boolean;
  /** True while a background refresh is in flight. */
  refreshing: boolean;
  session: SessionResponse | null;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useSessionStore = create<SessionStoreState>()((set, get) => ({
  loading: true,
  refreshing: false,
  session: null,
  error: null,

  load: async () => {
    try {
      const session = await api.getSession();
      set({ loading: false, refreshing: false, session, error: null });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        set({
          loading: false,
          refreshing: false,
          session: { user: null },
          error: null,
        });
      } else {
        set({
          loading: false,
          refreshing: false,
          session: { user: null },
          error:
            error instanceof Error
              ? error.message
              : "Failed to load your session.",
        });
      }
    }
  },

  /** Background refresh (post-mutation, post-login): no boot-skeleton flash. */
  refresh: async () => {
    set({ refreshing: true, error: null });
    await get().load();
  },
}));

/**
 * Same public shape as before: { loading, session, error, refresh }.
 * The first session check is kicked off once here (useSession is mounted
 * exactly once, at the app root).
 */
export function useSession() {
  const loading = useSessionStore((s) => s.loading);
  const session = useSessionStore((s) => s.session);
  const error = useSessionStore((s) => s.error);
  const load = useSessionStore((s) => s.load);
  const refresh = useSessionStore((s) => s.refresh);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, session, error, refresh };
}
