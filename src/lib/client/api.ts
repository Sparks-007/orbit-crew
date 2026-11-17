import type {
  AddMemberInput,
  ApiErrorBody,
  CreateOrgInput,
  CreateOrgResponse,
  LoginInput,
  MemberDto,
  OrgDetailResponse,
  RegisterInput,
  Role,
  SessionResponse,
  UpdateMemberRoleInput,
} from "@/lib/contracts/api";

/**
 * Typed same-origin API client for the Orbit Crew control plane.
 *
 * Security notes:
 * - Session state lives in an httpOnly cookie; this client never stores or
 *   sends tokens manually (nothing in browser storage).
 * - All requests are same-origin relative paths.
 */

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
      0
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiClientError(
      errorBody?.error?.code ?? "INTERNAL_ERROR",
      errorBody?.error?.message ?? "Request failed. Please try again.",
      res.status
    );
  }

  return body as T;
}

export const api = {
  /* ---- auth ---- */
  getSession: () => request<SessionResponse>("/api/auth/session"),

  register: (input: RegisterInput) =>
    request<SessionResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: LoginInput) =>
    request<SessionResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  logout: () =>
    request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  /* ---- organizations ---- */
  listOrganizations: () =>
    request<{ organizations: Array<{
      id: string;
      name: string;
      slug: string;
      role: Role;
      createdAt: string;
      memberCount: number;
    }> }>("/api/orgs"),

  createOrganization: (input: CreateOrgInput) =>
    request<CreateOrgResponse>("/api/orgs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getOrganization: (slug: string) =>
    request<OrgDetailResponse>(`/api/orgs/${encodeURIComponent(slug)}`),

  renameOrganization: (slug: string, name: string) =>
    request<{ organization: { id: string; name: string; slug: string } }>(
      `/api/orgs/${encodeURIComponent(slug)}`,
      { method: "PATCH", body: JSON.stringify({ name }) }
    ),

  deleteOrganization: (slug: string) =>
    request<{ ok: true }>(`/api/orgs/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }),

  /* ---- members ---- */
  addMember: (slug: string, input: AddMemberInput) =>
    request<{ member: MemberDto }>(
      `/api/orgs/${encodeURIComponent(slug)}/members`,
      { method: "POST", body: JSON.stringify(input) }
    ),

  updateMemberRole: (slug: string, membershipId: string, input: UpdateMemberRoleInput) =>
    request<{ member: MemberDto }>(
      `/api/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    ),

  removeMember: (slug: string, membershipId: string) =>
    request<{ ok: true }>(
      `/api/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
      { method: "DELETE" }
    ),
};
