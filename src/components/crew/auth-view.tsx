"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import type { SessionResponse } from "@/lib/contracts/api";
import { loginSchema, registerSchema } from "@/lib/contracts/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "./brand";
import { navigateTo, ROUTE_HASH } from "./router";
import { fieldErrors } from "./shared";

interface AuthViewProps {
  mode: "login" | "register";
  refresh: () => Promise<void>;
}

export function AuthView({ mode, refresh }: AuthViewProps) {
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  // Reset field errors when switching between login and register.
  useEffect(() => {
    setErrors({});
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    try {
      let result: SessionResponse;
      if (isRegister) {
        const parsed = registerSchema.safeParse({ email, name, password });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        result = await api.register(parsed.data);
        toast.success("Welcome to Orbit Crew.");
      } else {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          return;
        }
        setErrors({});
        setPending(true);
        result = await api.login(parsed.data);
        toast.success("Welcome back.");
      }
      await refresh();
      const hasOrganizations = "memberships" in result && result.memberships.length > 0;
      navigateTo(hasOrganizations ? ROUTE_HASH.overview : ROUTE_HASH.onboarding);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigateTo(ROUTE_HASH.landing)}
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to landing page"
          >
            <BrandMark />
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{isRegister ? "Create your account" : "Welcome back"}</CardTitle>
            <CardDescription>
              {isRegister
                ? "Start building your AI workforce in minutes."
                : "Sign in to your Orbit Crew workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              {isRegister ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={errors.name ? true : undefined}
                    disabled={pending}
                  />
                  {errors.name ? <p className="text-xs font-medium text-destructive">{errors.name}</p> : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={errors.email ? true : undefined}
                  disabled={pending}
                />
                {errors.email ? <p className="text-xs font-medium text-destructive">{errors.email}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? "At least 8 characters" : "Your password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={isRegister ? "auth-password-hint" : undefined}
                  disabled={pending}
                />
                {errors.password ? (
                  <p className="text-xs font-medium text-destructive">{errors.password}</p>
                ) : isRegister ? (
                  <p id="auth-password-hint" className="text-xs text-muted-foreground">
                    At least 8 characters.
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={pending}>
                {pending
                  ? isRegister
                    ? "Creating account…"
                    : "Signing in…"
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t">
            <p className="text-sm text-muted-foreground">
              {isRegister ? "Already have an account?" : "New to Orbit Crew?"}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => navigateTo(isRegister ? ROUTE_HASH.login : ROUTE_HASH.register)}
              >
                {isRegister ? "Sign in" : "Create an account"}
              </button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
