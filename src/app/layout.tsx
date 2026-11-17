import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbit Crew — Your AI workforce. Working together.",
  description:
    "Orbit Crew is a multi-tenant SaaS platform to create, manage and work with AI employees. V1: secure foundation with organizations, memberships and role-based access.",
  keywords: [
    "Orbit Crew",
    "AI workforce",
    "AI employees",
    "multi-tenant SaaS",
    "Next.js",
  ],
  authors: [{ name: "Orbit Crew" }],
  openGraph: {
    title: "Orbit Crew",
    description: "Your AI workforce. Working together.",
    siteName: "Orbit Crew",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
