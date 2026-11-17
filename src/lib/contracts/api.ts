import { z } from "zod";

/**
 * Shared API contracts (Zod schemas + TypeScript types) used by both the
 * server routes and the client UI. This is the single source of truth for
 * request validation and response shapes.
 */

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

/* ------------------------------------------------------------------ */
/* Error envelope                                                      */
/* ------------------------------------------------------------------ */

export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const registerSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  name: z.string().trim().min(1, "Name is required.").max(80),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters."),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Password is required.").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface MembershipSummary {
  organization: { id: string; name: string; slug: string };
  role: Role;
}

/**
 * `{ user: null }` means signed out. `{ user, memberships }` means signed in.
 */
export type SessionResponse =
  | { user: SessionUser; memberships: MembershipSummary[] }
  | { user: null };

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

/**
 * Slugs that can never be claimed by an organization because they collide
 * with platform routes / well-known paths.
 */
export const RESERVED_ORG_SLUGS: ReadonlySet<string> = new Set([
  "api", "app", "admin", "administrator", "root", "www", "mail", "ftp",
  "blog", "docs", "help", "support", "status", "auth", "login", "logout",
  "register", "signup", "signin", "settings", "account", "profile",
  "org", "orgs", "organization", "organizations", "overview", "crew",
  "teams", "team", "tasks", "task", "integrations", "approvals", "inbox",
  "memory", "files", "tools", "billing", "pricing", "plans", "dashboard",
  "static", "assets", "public", "_next", "health", "new", "edit", "delete",
  "users", "user", "members", "member", "orbit", "orbitcrew", "orbit-crew",
  "coordinator", "marketplace", "templates", "search", "explore", "about",
  "contact", "legal", "privacy", "terms", "security",
]);

export const orgSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters.")
  .max(40, "Slug must be at most 40 characters.")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers and hyphens (no leading or trailing hyphen)."
  );

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
  slug: orgSlugSchema,
});

export const renameOrgSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
});

export const addMemberSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  // OWNER role is never assignable here; ownership transfers via role update.
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ROLES),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type RenameOrgInput = z.infer<typeof renameOrgSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  createdAt: string;
  memberCount: number;
}

export interface MemberDto {
  id: string;
  user: { id: string; name: string | null; email: string };
  role: Role;
  createdAt: string;
}

export interface OrgDetailResponse {
  organization: { id: string; name: string; slug: string; createdAt: string };
  membership: { role: Role };
  members: MemberDto[];
}

export interface CreateOrgResponse {
  organization: { id: string; name: string; slug: string; createdAt: string };
  role: Role;
}
