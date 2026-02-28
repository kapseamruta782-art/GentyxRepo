// "use client";

// import { usePathname } from "next/navigation";
// import AppShell from "@/components/shell/app-shell";

// export default function ConditionalShell({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname();
//   const noShellRoutes = ["/login"];

//   if (noShellRoutes.includes(pathname)) {
//     return <>{children}</>;
//   }

//   return <AppShell>{children}</AppShell>;
// }
"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/components/shell/app-shell";

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShellRoutes = ["/login"];

  if (noShellRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}