import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { verifyPassword, hashPassword, getDummyPasswordHash } from "./password";
import { createSessionToken, hashSessionToken } from "./session";
import type {
  LoginInput,
  MembershipSummary,
  RegisterInput,
  Role,
  SessionResponse,
  SessionUser,
} from "@/lib/contracts/api";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export async function listMembershipSummaries(
  userId: string
): Promise<MembershipSummary[]> {
  const rows = await db.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
    },
    role: row.role as Role,
  }));
}

async function createDbSession(userId: string, meta: RequestMeta) {
  const { token, tokenHash, expiresAt } = createSessionToken();
  await db.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      ipAddress: meta.ipAddress?.slice(0, 64),
      userAgent: meta.userAgent?.slice(0, 255),
    },
  });
  return { token, expiresAt };
}

export interface AuthSuccess {
  payload: SessionResponse;
  token: string;
  expiresAt: Date;
}

export async function registerUser(
  input: RegisterInput,
  meta: RequestMeta
): Promise<AuthSuccess> {
  const email = input.email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await db.user.create({
      data: { email, name: input.name.trim(), passwordHash },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw ApiError.conflict("An account with this email already exists.");
    }
    throw error;
  }

  const { token, expiresAt } = await createDbSession(user.id, meta);
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
  };
  return {
    payload: { user: sessionUser, memberships: [] },
    token,
    expiresAt,
  };
}

export async function loginUser(
  input: LoginInput,
  meta: RequestMeta
): Promise<AuthSuccess> {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    // Equalize timing so unknown emails are indistinguishable from wrong
    // passwords (defends against account enumeration).
    await verifyPassword(input.password, await getDummyPasswordHash());
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const { token, expiresAt } = await createDbSession(user.id, meta);
  const memberships = await listMembershipSummaries(user.id);
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
  };
  return {
    payload: { user: sessionUser, memberships },
    token,
    expiresAt,
  };
}

export async function logoutSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
