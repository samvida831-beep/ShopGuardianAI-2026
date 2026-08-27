import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Images, Users, Bell, Settings, Info, LogOut, ShieldCheck, User } from "lucide-react";
import { useEffect } from "react";
import { useShopConfig, formatDate, formatTime, formatWeekday, useNow } from "@/lib/shop-store";
import { Mascot } from "./Mascot";
import shopScene from "@/assets/shop-scene.png";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/customers", label: "Customer History", icon: Users },
  { to: "/alerts", label: "Alert History", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about", label: "About", icon: Info },
];

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const { cfg, user, loading, ready, logout } = useShopConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow();

  useEffect(() => {
    if (ready && !loading && (!user || !cfg.onboarded)) {
      navigate({ to: "/" });
    }
  }, [ready, loading, user, cfg.onboarded, navigate]);

  if (loading || !ready || !user || !cfg.onboarded) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-screen text-foreground">
      {/* Ambient background decor */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-purple/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-success/10 blur-3xl" />
        <ShieldCheck className="absolute left-[12%] top-[38%] h-24 w-24 text-brand/[0.04]" />
        <ShieldCheck className="absolute right-[8%] bottom-[18%] h-32 w-32 text-purple/[0.05]" />
      </div>

      <div className="relative mx-auto flex max-w-[1440px] gap-6 p-6">
        {/* Sidebar */}
        <aside className="glass-card sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col p-5 lg:flex">
          <Link to="/dashboard" className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-purple text-white shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold leading-tight">ShopGuardian</div>
              <div className="text-xs text-muted-foreground">Smart Shop Monitor</div>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-gradient-to-r from-brand to-purple text-white shadow-[0_10px_22px_-12px_oklch(0.58_0.22_262)]"
                      : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User profile summary in sidebar footer */}
          <div className="mt-auto pt-3">
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/70 p-3 backdrop-blur">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand font-bold text-sm">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground">{user?.full_name || user?.username || "Shopkeeper"}</div>
                  <div className="truncate text-[10px] text-muted-foreground">@{user?.username}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-danger transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-brand-soft/70 to-purple-soft/70 p-3 text-center">
              <img src={shopScene} alt="Your shop" className="mx-auto h-20 w-auto" />
              <p className="mt-1 text-center text-[11px] font-semibold text-foreground/80">
                &ldquo;A safer shop, a happier life.&rdquo;
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 space-y-6">
          {/* Top header */}
          <header className="glass-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5 sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-purple text-white shadow-lg lg:hidden">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                  {cfg.shopName || "ShopGuardian AI"}
                </h1>
                <p className="truncate text-sm text-muted-foreground">
                  Welcome back{user?.full_name || cfg.ownerName ? `, ${user?.full_name || cfg.ownerName}` : ""} · Smart shop monitoring
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="rounded-2xl bg-brand-soft/80 px-4 py-2 text-right">
                <div className="text-xs font-semibold text-brand">{formatWeekday(now)}</div>
                <div className="text-sm font-bold text-foreground">{formatDate(now)}</div>
              </div>
              <div className="rounded-2xl bg-purple-soft/80 px-4 py-2 text-right">
                <div className="text-xs font-semibold text-purple">Live Time</div>
                <div className="text-sm font-bold tabular-nums text-foreground">{formatTime(now)}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Logout from account"
                className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-xs font-bold text-muted-foreground transition hover:bg-danger-soft hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>

            <div className="col-span-2 hidden">
              <Mascot avatar={cfg.avatar} size={80} />
            </div>
          </header>

          {children}

          <footer className="pt-2 pb-4 text-center text-xs text-muted-foreground">
            Thank you for trusting ShopGuardian AI ·{" "}
            <span className="text-danger">♥</span> Made for small shop owners
          </footer>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border border-white/70 bg-white/80 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl lg:hidden">
        {NAV.slice(0, 5).map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`grid h-11 w-11 place-items-center rounded-full transition ${
                active ? "bg-gradient-to-br from-brand to-purple text-white" : "text-muted-foreground"
              }`}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}