"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { createOrgSchema, RESERVED_ORG_SLUGS } from "@/lib/contracts/api";
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
import { fieldErrors, slugify } from "./shared";

interface OnboardingProps {
  refresh: () => Promise<void>;
}

export function Onboarding({ refresh }: OnboardingProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);

  const parsed = createOrgSchema.safeParse({ name, slug });
  const errors = parsed.success ? null : fieldErrors(parsed.error);
  const slugReserved = slug.length > 0 && RESERVED_ORG_SLUGS.has(slug);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setAttempted(true);
    const validated = createOrgSchema.safeParse({ name, slug });
    if (!validated.success) {
      return;
    }
    setPending(true);
    try {
      const result = await api.createOrganization(validated.data);
      toast.success(`"${result.organization.name}" is ready.`);
      await refresh();
      navigateTo(ROUTE_HASH.overview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the organization.");
    } finally {
      setPending(false);
    }
  }

  const showNameError = (attempted || nameTouched) && errors?.name;
  const showSlugError = (attempted || slugEdited) && errors?.slug;

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <BrandMark />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create your organization</CardTitle>
            <CardDescription>
              Set up your first workspace — you can invite your team right after.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  name="name"
                  autoComplete="organization"
                  placeholder="Acme AI Studio"
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  onBlur={() => setNameTouched(true)}
                  aria-invalid={showNameError ? true : undefined}
                  disabled={pending}
                />
                {showNameError ? (
                  <p className="text-xs font-medium text-destructive">{showNameError}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  name="slug"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="acme-ai-studio"
                  value={slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setSlug(event.target.value);
                  }}
                  aria-invalid={showSlugError ? true : undefined}
                  aria-describedby="org-slug-hint"
                  disabled={pending}
                />
                {showSlugError ? (
                  <p className="text-xs font-medium text-destructive">{showSlugError}</p>
                ) : slugReserved ? (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
                    &quot;{slug}&quot; is reserved by the platform — choose another slug.
                  </p>
                ) : (
                  <p id="org-slug-hint" className="text-xs text-muted-foreground">
                    Lowercase letters, numbers and hyphens. Used to identify your workspace.
                  </p>
                )}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={pending}>
                {pending ? "Creating organization…" : "Create organization"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t">
            <p className="text-xs text-muted-foreground">
              You can create more organizations later and switch between them at any time.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
