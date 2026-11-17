"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Building2,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand";
import { OrbitMark } from "./orbit-mark";
import { navigateTo, ROUTE_HASH } from "./router";

interface Milestone {
  tag: string;
  title: string;
  description: string;
  icon: LucideIcon;
  live: boolean;
}

const MILESTONES: ReadonlyArray<Milestone> = [
  {
    tag: "M1",
    title: "Foundation",
    description: "Secure sign-up, organizations, memberships and role-based access.",
    icon: Rocket,
    live: true,
  },
  {
    tag: "M2",
    title: "Model connection",
    description: "Connect AI models with your own API keys.",
    icon: Plug,
    live: false,
  },
  {
    tag: "M3",
    title: "AI employees",
    description: "Create and manage your AI workforce.",
    icon: UsersRound,
    live: false,
  },
  {
    tag: "M4",
    title: "Task execution",
    description: "Delegate real work to your crew.",
    icon: ListChecks,
    live: false,
  },
  {
    tag: "M5",
    title: "Memory and files",
    description: "Shared knowledge for every employee.",
    icon: Brain,
    live: false,
  },
  {
    tag: "M6",
    title: "Tools and browser",
    description: "Give employees tools and web access.",
    icon: Wrench,
    live: false,
  },
  {
    tag: "M7",
    title: "Approvals and launch",
    description: "Human approval flows before go-live.",
    icon: BadgeCheck,
    live: false,
  },
];

interface SecurityFeature {
  icon: LucideIcon;
  title: string;
  description: string;
  planned?: string;
}

const SECURITY_FEATURES: ReadonlyArray<SecurityFeature> = [
  {
    icon: KeyRound,
    title: "Session security",
    description: "httpOnly session cookies — no tokens in browser storage.",
  },
  {
    icon: LockKeyhole,
    title: "Encrypted credentials",
    description: "A per-tenant vault for the API keys your crew will use.",
    planned: "Planned M2",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description: "Owner, admin and member permissions enforced end to end.",
  },
  {
    icon: Building2,
    title: "Tenant isolation",
    description: "Every organization's data is strictly scoped and separated.",
  },
];

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const Icon = milestone.icon;
  return (
    <Card
      className={cn(
        "gap-0 py-5",
        milestone.live ? "border-primary/40 bg-primary/[0.04]" : "text-muted-foreground"
      )}
    >
      <CardContent className="space-y-3 px-5">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              milestone.live ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <Badge variant={milestone.live ? "default" : "outline"} className={milestone.live ? undefined : "text-muted-foreground"}>
            {milestone.live ? "Live now" : "Planned"}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {milestone.tag}
          </p>
          <h3 className={cn("mt-1 text-sm font-semibold", !milestone.live && "text-foreground")}>
            {milestone.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{milestone.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function Landing() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-11 px-3" onClick={() => navigateTo(ROUTE_HASH.login)}>
              Sign in
            </Button>
            <Button className="h-11 px-4" onClick={() => navigateTo(ROUTE_HASH.register)}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-10rem] -z-10 size-[32rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:pb-24">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="space-y-6"
              >
                <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                  <Rocket className="size-3" aria-hidden />
                  V1 · M1 Project Foundation is live
                </Badge>
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                    Orbit Crew
                  </h1>
                  <p className="text-xl font-medium text-muted-foreground sm:text-2xl">
                    Your AI workforce. <span className="text-foreground">Working together.</span>
                  </p>
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Orbit Crew is a multi-tenant platform to create, manage and work with AI
                    employees. Version 1 delivers the secure foundation — organizations,
                    memberships and role-based access — ready for everything that comes next.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" className="h-11 px-6" onClick={() => navigateTo(ROUTE_HASH.register)}>
                    Create your crew
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                  <Button size="lg" variant="outline" className="h-11 px-6" onClick={() => navigateTo(ROUTE_HASH.login)}>
                    Sign in
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto"
              >
                <OrbitMark size={300} />
              </motion.div>
            </div>
          </div>
        </section>

        <section aria-labelledby="roadmap-heading" className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="roadmap-heading" className="text-2xl font-semibold tracking-tight">
                The road to a full crew
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                M1 is live today. Each following milestone unlocks a new capability — planned,
                not yet available.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MILESTONES.map((milestone) => (
                <MilestoneCard key={milestone.tag} milestone={milestone} />
              ))}
              <Card className="gap-0 border-dashed bg-transparent py-5 text-muted-foreground">
                <CardContent className="flex h-full flex-col justify-center space-y-2 px-5">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-dashed">
                    <Sparkles className="size-4" aria-hidden />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">And more</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The crew grows with every milestone, shaped by early feedback.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section aria-labelledby="security-heading" className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="security-heading" className="text-2xl font-semibold tracking-tight">
                Security from day one
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The foundation is built for multi-tenant trust.
              </p>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <p className="text-sm font-semibold">{feature.title}</p>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                    {feature.planned ? (
                      <Badge variant="outline" className="mt-2.5 text-[10px] text-muted-foreground">
                        {feature.planned}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
