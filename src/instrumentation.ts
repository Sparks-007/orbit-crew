/**
 * Next.js instrumentation hook — runs once when the server process starts.
 *
 * Fail-fast policy: in production a missing/placeholder AUTH_SECRET or a
 * broken DATABASE_URL aborts the process at boot (exit code 1) instead of
 * surfacing as a 500 on the first request that touches a secret. Next.js
 * only logs instrumentation errors, so an explicit process.exit(1) is
 * required for a clean, safe stop (see src/lib/env.ts).
 */
export async function register(): Promise<void> {
  // process.exit is Node-runtime-only; the Edge build must skip this hook.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    // Imported lazily so the instrumentation bundle stays minimal.
    const { getEnv } = await import("@/lib/env");
    getEnv();
  } catch (error) {
    console.error(
      "[startup] aborting due to invalid environment configuration:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}
