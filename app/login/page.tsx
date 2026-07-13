"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { brand } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Invalid username or password.");
      }
    } catch (err) {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#0a1c30] to-[#0f2840] text-white flex flex-col justify-between selection:bg-[#1D538C]/50 selection:text-white">
      
      {/* Top Navbar */}
      <header className="w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center h-10">
          <Image
            src={brand.logoSrc}
            alt={brand.name}
            height={38}
            width={Math.round(38 * brand.logoAspectRatio)}
            priority
            className="h-9 w-auto brightness-0 invert"
          />
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-yellow-500/25 bg-yellow-500/10 text-[11px] font-semibold text-yellow-400">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Restricted Secure Zone
          </span>
        </div>
      </header>

      {/* Login Card Grid */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
          
          <div className="relative space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400 uppercase block mb-1">
                SYSTEM PORTAL
              </span>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-white tracking-tight">
                Admin Authentication
              </h2>
              <p className="text-xs text-slate-400 font-light max-w-xs mx-auto">
                Access the CYouMedia AI-Visibility and SEO Audit command center.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-wider text-slate-400 font-bold uppercase block pl-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter administrator username"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-blue-400 transition-all font-mono"
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] tracking-wider text-slate-400 font-bold uppercase block pl-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-blue-400 transition-all font-mono"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-xl bg-white hover:bg-slate-100 py-3 text-xs tracking-wider uppercase font-bold text-[#07111F] transition-all duration-200 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-[#07111F]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Authenticate Portal</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 text-center border-t border-white/5 text-[10px] md:text-xs text-slate-500 font-light">
        © {new Date().getFullYear()} CYouMedia. All rights reserved. Secure administrator gateway.
      </footer>
    </div>
  );
}
