import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, UserPlus, Store, WifiOff, Play, Square } from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { getAlerts, type AlertRecord } from "@/lib/api";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alert History · ShopGuardian AI" },
      { name: "description", content: "All alerts from your shop: customers, camera status and monitoring events." },
      { property: "og:title", content: "ShopGuardian AI · Alerts" },
      { property: "og:description", content: "All alerts from your shop: customers, camera status and monitoring events." },
    ],
  }),
  component: AlertHistory,
});

const toneMap = {
  success: "bg-success-soft text-success",
  brand: "bg-brand-soft text-brand",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  muted: "bg-secondary text-muted-foreground",
};

const iconMap: Record<string, React.ReactNode> = {
  detected: <UserPlus className="h-5 w-5" />,
  started: <Play className="h-5 w-5" />,
  empty: <Store className="h-5 w-5" />,
  offline: <WifiOff className="h-5 w-5" />,
  stopped: <Square className="h-5 w-5" />,
};

function AlertHistory() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAlerts();
        setAlerts(data);
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, []);

  return (
    <ShopLayout>
      <section className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Alert History</h2>
            <p className="text-sm text-muted-foreground">All events your ShopGuardian noticed today.</p>
          </div>
          <span className="pill bg-brand-soft text-brand"><Bell className="h-3.5 w-3.5" /> {alerts.length} alerts</span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-4 rounded-2xl border border-border bg-background p-4">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneMap[a.alert_type as keyof typeof toneMap] ?? toneMap.muted}`}>{iconMap[a.alert_type] ?? <Bell className="h-5 w-5" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-extrabold">{a.title}</div>
                  <span className="text-xs font-semibold text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.message}</div>
                <div className="mt-1 text-xs text-muted-foreground">Source: Camera {a.camera_number ?? "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </ShopLayout>
  );
}