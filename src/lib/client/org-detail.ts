"use client";

import { create } from "zustand";
import { api } from "./api";
import type { OrgDetailResponse } from "@/lib/contracts/api";

/**
 * Organization-detail store (Zustand).
 *
 * Holds the currently loaded organization (slug-keyed) so views can refresh
 * it after membership mutations. State mutations happen in store actions —
 * never in component effects.
 */

interface OrgDetailState {
  slug: string | null;
  data: OrgDetailResponse | null;
  loading: boolean;
  error: string | null;
  /** Loads org detail for a slug. force=true re-fetches an already-loaded slug. */
  load: (slug: string, force?: boolean) => Promise<void>;
  clear: () => void;
}

export const useOrgDetailStore = create<OrgDetailState>()((set, get) => ({
  slug: null,
  data: null,
  loading: false,
  error: null,

  clear: () => set({ slug: null, data: null, loading: false, error: null }),

  load: async (slug, force = false) => {
    if (force || get().slug !== slug) {
      set({ slug, data: null, loading: true, error: null });
    } else {
      set({ loading: true, error: null });
    }
    try {
      const data = await api.getOrganization(slug);
      if (get().slug === slug) set({ data, loading: false, error: null });
    } catch (error) {
      if (get().slug === slug) {
        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load organization data.",
        });
      }
    }
  },
}));
