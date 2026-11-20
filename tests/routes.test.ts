import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Structural regression tests for the App Router route tree.
 *
 * Background: the membership PATCH/DELETE handler was once believed to live
 * in a mistyped directory (`embershipId]` instead of `[membershipId]`).
 * Byte-level verification proved the tree was correct, but the episode
 * exposed a real gap: behavior tests import route handlers directly, so a
 * malformed dynamic segment would be invisible to them — URL routing only
 * breaks in a running server. These checks pin the route tree structure
 * itself, independent of any database or HTTP layer.
 */

const APP_ROOT = join(process.cwd(), "src", "app");
const API_ROOT = join(APP_ROOT, "api");
const CLIENT_API = join(process.cwd(), "src", "lib", "client", "api.ts");

/** Well-formed Next.js dynamic segment: [paramName] */
const DYNAMIC_SEGMENT = /^\[[a-zA-Z_][a-zA-Z0-9_]*\]$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(full, ...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe("route tree integrity", () => {
  it("every bracketed directory segment under src/app is a well-formed [param]", () => {
    const offenders: string[] = [];
    for (const dir of walk(APP_ROOT)) {
      const segment = dir.split("/").pop() as string;
      if (segment.includes("[") || segment.includes("]")) {
        if (!DYNAMIC_SEGMENT.test(segment)) {
          offenders.push(relative(APP_ROOT, dir));
        }
      }
    }
    expect(offenders, `malformed dynamic segments: ${offenders.join(", ")}`).toEqual([]);
  });

  it("membership role/removal route exists at orgs/[slug]/members/[membershipId]", () => {
    const routeFile = join(API_ROOT, "orgs", "[slug]", "members", "[membershipId]", "route.ts");
    expect(existsSync(routeFile), `${routeFile} must exist`).toBe(true);
  });

  it("every route.ts handler params type matches the dynamic segments of its path", () => {
    const mismatches: string[] = [];
    for (const file of walk(API_ROOT)) {
      if (!file.endsWith("route.ts")) continue;
      const rel = relative(API_ROOT, file);
      const dirSegments = rel.split("/").slice(0, -1); // drop route.ts
      const pathParams = dirSegments
        .filter((segment) => DYNAMIC_SEGMENT.test(segment))
        .map((segment) => segment.slice(1, -1))
        .sort();
      const source = readFileSync(file, "utf8");
      const paramsMatch = source.match(/params:\s*Promise<\{([^}]*)\}>/);
      if (!paramsMatch) {
        if (pathParams.length > 0) {
          mismatches.push(
            `${rel}: path declares [${pathParams.join(", ")}] but no handler params type`
          );
        }
        continue;
      }
      const declared = Array.from(
        paramsMatch[1].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)
      )
        .map((m) => m[1])
        .sort();
      if (declared.join(",") !== pathParams.join(",")) {
        mismatches.push(
          `${rel}: params {${declared.join(", ")}} do not match path [${pathParams.join(", ")}]`
        );
      }
    }
    expect(mismatches, mismatches.join("; ")).toEqual([]);
  });

  it("client API member mutations target the parameterized /members/[membershipId] URL", () => {
    const source = readFileSync(CLIENT_API, "utf8");
    // updateMemberRole (PATCH) and removeMember (DELETE) both build
    // /api/orgs/<slug>/members/<membershipId> — the URL served by
    // orgs/[slug]/members/[membershipId]/route.ts.
    const parameterizedUrls = source.match(
      /members\/\$\{encodeURIComponent\(membershipId\)\}/g
    );
    expect(parameterizedUrls, "client must use the parameterized membership URL").not.toBeNull();
    expect(parameterizedUrls?.length).toBeGreaterThanOrEqual(2);
    // No mistyped literal segment may appear anywhere in the client.
    expect(source).not.toMatch(/members\/embershipId/);
  });
});
