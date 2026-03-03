
//app/login/page.tsx
"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Zustand role setter
  const setUIRole = useUIStore((state) => state.setRole);
  const setCurrentClientId = useUIStore((state) => state.setCurrentClientId);
  const setCurrentServiceCenterId = useUIStore((state) => state.setCurrentServiceCenterId);
  const setCurrentCpaId = useUIStore((state) => state.setCurrentCpaId);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log("🔍 LOGIN API RESPONSE:", data);

      if (!data.success) {
        const msg = data.message || "Invalid credentials";
        setErrorMsg(msg);
        toast({
          title: "Login Failed",
          description: msg,
          variant: "destructive",
        });
        return;
      }

      const role = data.user.role;
      const clientId = data.user.clientId;
      const serviceCenterId = data.user.serviceCenterId;
      const cpaId = data.user.cpaId;

      console.log("🔍 LOGIN - role:", role);
      console.log("🔍 LOGIN - clientId from API:", clientId);
      console.log("🔍 LOGIN - serviceCenterId from API:", serviceCenterId);
      console.log("🔍 LOGIN - cpaId from API:", cpaId);

      // 🔥 RESET STORE FIRST
      setUIRole(null);
      setCurrentClientId(undefined);
      setCurrentServiceCenterId(undefined);
      setCurrentCpaId(undefined);

      // 🔥 SET ROLE
      setUIRole(role);

      // 🔥 SET CLIENT ID FOR CLIENT ROLE
      if (role === "CLIENT" && clientId) {
        console.log("🔍 LOGIN - Setting currentClientId to:", clientId.toString());
        setCurrentClientId(clientId.toString());
      }

      // 🔥 SET SERVICE CENTER ID FOR SERVICE_CENTER ROLE
      if (role === "SERVICE_CENTER" && serviceCenterId) {
        console.log("🔍 LOGIN - Setting currentServiceCenterId to:", serviceCenterId.toString());
        setCurrentServiceCenterId(serviceCenterId.toString());
      }

      // 🔥 SET CPA ID FOR CPA ROLE
      if (role === "CPA" && cpaId) {
        console.log("🔍 LOGIN - Setting currentCpaId to:", cpaId.toString());
        setCurrentCpaId(cpaId.toString());
      }

      const dashboardMap: Record<string, string> = {
        ADMIN: "/admin",
        CLIENT: "/client",
        SERVICE_CENTER: "/service-center",
        CPA: "/cpa",
      };

      // Small delay to ensure Zustand persists to localStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      const normalizedRole = role ? role.toUpperCase() : "ADMIN";
      const targetPath = dashboardMap[normalizedRole] || "/admin";

      console.log("🔍 LOGIN - Navigating to:", targetPath);
      router.push(targetPath);
    } catch (error) {
      setErrorMsg("Something went wrong. Try again later.");
      toast({
        title: "Error",
        description: "Something went wrong. Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  /* 
  // OLD LOGIN UI (Commented out)
  return (
    <div className="login-page">
      <div className="logo-wrapper">
        <img
          src="/images/legacytest.png"
          alt="mySAGE Logo"
          className="mysage-logo"
        />
      </div>

      <div className="login-box">
        <img
          src="/images/clienthublogin.png"
          alt="AccountsHub"
          className="login-logo-img"
        />

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <label>Email Address</label>
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="password-visibility-btn"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {errorMsg && (
            <p style={{ color: "red", textAlign: "center", marginBottom: "10px", fontSize: "14px" }}>
              {errorMsg}
            </p>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "LOG IN"}
          </button>
        </form>
      </div>

      <div className="powered-by-text">POWERED BY HUBONE SYSTEMS</div>
      <p className="footer-text">
        © 2014–{new Date().getFullYear()} HubOne Systems Inc. – All Rights Reserved
      </p>
    </div>
  );
  */

  // NEW LOGIN UI with Tailwind
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-background font-sans p-5">
      {/* TITLE */}
      <h1 className="font-serif text-5xl md:text-6xl text-foreground font-semibold mb-8 tracking-tight text-center">
        Client Portal
      </h1>

      {/* FORM CARD */}
      <div className="w-full max-w-[440px] bg-surface p-8 md:p-12 rounded-lg shadow-sm border border-border/50">
        {/* LOGO HEADER */}
        <div className="flex justify-center w-full mb-8">
          <Logo />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground text-left">Email Address</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-md border border-input text-base text-foreground bg-background outline-none transition-all duration-200 focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground text-left">Password</label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-md border border-input text-base text-foreground bg-background outline-none transition-all duration-200 focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted/50 flex items-center justify-center"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-destructive text-center mt-2 text-sm font-medium">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-primary text-primary-foreground border-none rounded-full font-bold text-sm tracking-wide cursor-pointer mt-4 transition-all duration-200 shadow-sm hover:translate-y-[-1px] hover:shadow-md hover:bg-primary/90 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Logging in..." : "LOG IN"}
          </button>
        </form>
      </div>

      {/* FOOTER */}
      <div className="mt-12 text-center text-xs text-muted-foreground">
        <div className="font-bold uppercase mb-2 tracking-widest text-[10px] text-foreground">POWERED BY HUBONE SYSTEMS</div>
        <p>
          © 2014–{new Date().getFullYear()} HubOne Systems Inc. – All Rights Reserved
        </p>
      </div>
    </div>
  );
}