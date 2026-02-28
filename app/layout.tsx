// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { CommandBar } from "@/components/command-bar";
import ConditionalShell from "@/components/conditional-shell";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";

import SessionHandler from "./session-handler";

export const metadata: Metadata = {
  title: "ClientHub",
  description: "Client Onboarding Platform",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {/* 🔥 Auto Logout After 2 Hours */}
        <SessionHandler />

        {/* App Core */}
        <ThemeProvider>
          <ConditionalShell>{children}</ConditionalShell>
          <CommandBar />
          <Toaster />
        </ThemeProvider>

        <Analytics />
      </body>
    </html>
  );
}
