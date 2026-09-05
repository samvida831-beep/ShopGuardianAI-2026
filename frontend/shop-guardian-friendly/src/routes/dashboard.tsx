import ZoneEditor from "@/components/ZoneEditor";
import { createFileRoute, Link } from "@tanstack/react-router";
import { saveZone, loadZone, getCameraInfo, getSnapshotImageUrl } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getStatus,
  getActivity,
  getCameraFrameUrl,
  buildCameraFrameSrc,
  getAlerts,
  getSnapshots,
  type ShopStatus,
  type CameraInfo,
} from "@/lib/api";
import {
  Camera as CameraIcon, Users, Bell, Images, Store, Timer, Play, Square, RotateCcw, FolderOpen,
  WifiOff, ArrowRight, Clock, ShieldCheck,
} from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { Mascot, AiRobot } from "@/components/Mascot";
import { useShopConfig, formatDate, formatTime, useNow } from "@/lib/shop-store";
import { cameraEntrance, cameraInside, snapshots } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · ShopGuardian AI" },
      { name: "description", content: "Live cameras, customer count, snapshots and alerts for your shop." },
      { property: "og:title", content: "ShopGuardian AI Dashboard" },
      { property: "og:description", content: "Live cameras, customer count, snapshots and alerts for your shop." },
    ],
  }),
  component: Dashboard,
});

type SystemState = "running" | "empty" | "detected" | "offline" | "stopped";

const stateBadge: Record<SystemState, { label: string; wrap: string; dot: string }> = {
  running:  { label: "System Running",     wrap: "bg-success-soft text-success", dot: "bg-success" },
  empty:    { label: "Shop Empty",         wrap: "bg-warning-soft text-warning", dot: "bg-warning" },
  detected: { label: "Customer Detected!", wrap: "bg-success-soft text-success", dot: "bg-success" },
  offline:  { label: "Camera Offline",     wrap: "bg-danger-soft text-danger",   dot: "bg-danger" },
  stopped:  { label: "Monitoring Stopped", wrap: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const mascotLine: Record<SystemState, { emoji: string; text: string }> = {
  running:  { emoji: "😊", text: "Everything looks good. Both cameras are connected and your shop is safe." },
  empty:    { emoji: "😴", text: "Shop is empty right now. Waiting for customers." },
  detected: { emoji: "😃", text: "Welcome! A new customer just entered your shop." },
  offline:  { emoji: "😟", text: "Entrance camera is offline. Please check the connection." },
  stopped:  { emoji: "🙂", text: "Monitoring is paused. Tap Start Monitoring when you&apos;re ready." },
};

function Dashboard() {
  const { cfg } = useShopConfig();
  const now = useNow();
  const [shopData, setShopData] = useState<ShopStatus | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [state, setState] = useState<SystemState>("running");
  const [customers, setCustomers] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [runtimeStart] = useState(() => Date.now() - 2 * 3600 * 1000 - 15 * 60 * 1000);
  const [zoneCamera, setZoneCamera] = useState<1 | 2>(1);
  const [zoneShape, setZoneShape] = useState<"rectangle" | "circle" | "polygon">("rectangle");
  const [selectedCamera, setSelectedCamera] = useState<1 | 2 | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zonePoints, setZonePoints] = useState<number[]>([]);
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [zoneHistory, setZoneHistory] = useState<number[][]>([]);

  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const data = await getStatus();

        setShopData(data);
        const activity = await getActivity();
        setActivities(activity);
        setCustomers(data.customer_count);

        if (data.occupied) {
          setState("detected");
        } else {
          setState("empty");
        }

        try {
          const [alerts, snaps] = await Promise.all([getAlerts(), getSnapshots()]);
          setAlertsCount(alerts.length);
          setSnapCount(snaps.length);
        } catch (countsErr) {
          console.error(countsErr);
        }
      } catch (error) {
        console.error(error);
        setState("offline");
      }
    }

    loadStatus();

    const interval = setInterval(loadStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadCameraMetadata() {
      try {
        const info = await getCameraInfo();
        setCameraInfo(info);
      } catch (error) {
        console.error(error);
      }
    }

    loadCameraMetadata();
  }, []);

  useEffect(() => {
    async function loadSavedZone() {
      try {
        const loaded = await loadZone(zoneCamera);
        if (loaded?.points?.length) {
          setZonePoints(loaded.points);
          setZoneShape((loaded.shape as "rectangle" | "circle" | "polygon") || "rectangle");
          setZoneHistory((history) => history.length ? history : [loaded.points]);
        } else {
          setZonePoints([]);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadSavedZone();
  }, [zoneCamera]);

function getMousePos(
  e: React.MouseEvent<HTMLCanvasElement>
) {
  const rect = e.currentTarget.getBoundingClientRect();

  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function handleMouseDown(
  e: React.MouseEvent<HTMLCanvasElement>
) {
  const p = getMousePos(e);

  setStartPoint(p);
  setEndPoint(p);
  setDrawing(true);
}

function handleMouseMove(
  e: React.MouseEvent<HTMLCanvasElement>
) {
  if (!drawing) return;

  setEndPoint(getMousePos(e));
}

function handleMouseUp() {
  setDrawing(false);
}

  /*useEffect(() => {
    // demo: occasionally simulate a "detected" pulse when running
    if (state !== "running") return;
    const id = setInterval(() => {
      if (Math.random() < 0.15) {
        setState("detected");
        setCustomers((c) => c + 1);
        setSnapCount((s) => s + 1);
        setTimeout(() => setState("running"), 3500);
      }
    }, 8000);
    return () => clearInterval(id);
  }, [state]);*/

  const runtime = useMemo(() => {
    if (state === "stopped") return "00:00:00";
    const elapsed = Math.floor((now.getTime() - runtimeStart) / 1000);
    const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(elapsed % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [now, runtimeStart, state]);

  const camera1Offline = state === "offline";
  const dim = state === "stopped";

  return (
    <ShopLayout>
      {/* Premium hero banner */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-brand-soft via-purple-soft to-success-soft p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/40 blur-2xl" />
            <div className="absolute bottom-[-3rem] left-1/3 h-40 w-40 rounded-full bg-white/30 blur-2xl" />
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <div className="animate-fade-up">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`pill ${stateBadge[state].wrap}`}>
                  <span className={`h-2 w-2 rounded-full ${stateBadge[state].dot} animate-pulse-dot`} />
                  {stateBadge[state].label}
                </span>
                <span className="pill bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  🟢 DEMO MODE — Prerecorded CCTV
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                ShopGuardian AI
              </h2>
              <p className="mt-1 text-base font-bold text-brand">
                Smart AI Protection for Your Family Business
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                ShopGuardian continuously watches your shop, detects customers, saves snapshots, and keeps your family informed in real time.
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 inline-block">
                ℹ️ Running in offline Demo Mode. Uses prerecorded CCTV feeds so you can evaluate the complete YOLOv8 AI pipeline without connecting physical cameras.
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground/70">
                Hello {cfg.ownerName || "there"} 👋 · your {cfg.shopType?.toLowerCase() || "shop"} is protected.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <StateChip label="System Running" onClick={() => setState("running")} active={state === "running"} tone="success" />
                <StateChip label="Shop Empty" onClick={() => setState("empty")} active={state === "empty"} tone="warning" />
                <StateChip label="Customer Detected" onClick={() => { setState("detected"); setCustomers((c) => c + 1); setSnapCount((s) => s + 1); }} active={state === "detected"} tone="brand" />
                <StateChip label="Camera Offline" onClick={() => setState("offline")} active={state === "offline"} tone="danger" />
                <StateChip label="Stopped" onClick={() => setState("stopped")} active={state === "stopped"} tone="muted" />
              </div>
            </div>
            <Mascot avatar={cfg.avatar} size={190} float className="hidden shrink-0 sm:block" />
          </div>
        </div>

        {/* Assistant card */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3">
            <AiRobot size={48} float={false} />
            <div>
              <div className="text-sm font-bold">ShopGuardian Assistant</div>
              <div className="text-xs text-muted-foreground">Speaks up when something changes</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div key={state} className="flex items-start gap-3 rounded-2xl rounded-tl-md bg-brand-soft/70 p-4 animate-pop-in">
              <div className="text-2xl">{mascotLine[state].emoji}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {mascotLine[state].text.replace("&apos;", "'")}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{shopData?.last_detection ? shopData.last_detection: `Just now · ${formatTime(now)}`}</div>
              </div>
            </div>
            <div className="ml-6 rounded-2xl rounded-tl-md bg-secondary/80 px-4 py-2.5 text-sm font-medium">
              📷 Snapshot captured and saved safely.
            </div>
            <div className="ml-6 rounded-2xl rounded-tl-md bg-success-soft/70 px-4 py-2.5 text-sm font-medium text-foreground">
              🟢 Shop is secure.
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MiniStat label="Today" value={String(customers)} caption="customers" />
            <MiniStat label="Alerts" value={String(alertsCount)} caption="today" />
          </div>
        </div>
      </section>

      {/* Cameras */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div
          className="cursor-pointer"
          onClick={() => setSelectedCamera(1)}
        >
          <CameraCard
            title="Entrance View"
            subtitle={`Camera 1 (${shopData?.camera1 ?? "Loading"})`}
            src={`${getCameraFrameUrl(1)}&t=${Date.now()}`}
            offline={camera1Offline}
            dim={dim}
            onRetry={() => setState("running")}
          />
        </div>
        <div
            className="cursor-pointer"
            onClick={() => setSelectedCamera(2)}
          >
            <CameraCard
            title="Shop Inside View"
            subtitle={`Camera 2 (${shopData?.camera2 ?? "Loading"})`}
            src={`${getCameraFrameUrl(2)}&t=${Date.now()}`}
            dim={dim}
          />
        </div>
      </section>

      {/* Entry Zone Configuration */}
      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-extrabold">Entry Zone Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Configure the customer entry region for both cameras
            </p>
          </div>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
            Admin
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Camera Selection */}
          <div className="rounded-2xl border border-border p-4">
            <h4 className="mb-3 font-bold">Select Camera</h4>
            <select
              value={zoneCamera}
              onChange={(e) => setZoneCamera(Number(e.target.value) as 1 | 2)}
              className="w-full rounded-xl border border-border bg-background p-3"
            >
              <option value={1}>Camera 1 - Entrance</option>
              <option value={2}>Camera 2 - Inside Shop</option>
            </select>
          </div>

          {/* Shape Selection */}
          <div className="rounded-2xl border border-border p-4">
            <h4 className="mb-3 font-bold">Zone Shape</h4>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setZoneShape("rectangle")}
                className={`rounded-xl px-4 py-2 font-semibold ${
                  zoneShape === "rectangle"
                    ? "bg-brand text-white"
                    : "bg-secondary text-foreground"
                }`}
              >
                Rectangle
              </button>

              <button
                onClick={() => setZoneShape("circle")}
                className={`rounded-xl px-4 py-2 font-semibold ${
                zoneShape === "circle"
                  ? "bg-brand text-white"
                  : "bg-secondary text-foreground"
              }`}
            >
              Circle
            </button>

            <button
              onClick={() => setZoneShape("polygon")}
              className={`rounded-xl px-4 py-2 font-semibold ${
                zoneShape === "polygon"
                  ? "bg-brand text-white"
                  : "bg-secondary text-foreground"
              }`}
            >
              Polygon
            </button>
          </div>
        </div>
      </div>

      {/* Live Camera Preview */}
      <div className="mt-6 rounded-2xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-bold">
            {zoneCamera === 1 ? "Camera 1 Live View" : "Camera 2 Live View"}
          </h4>
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            Live
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl">
          <ZoneEditor
            image={`${getCameraFrameUrl(zoneCamera)}&t=${Date.now()}`}
            shape={zoneShape}
            value={zonePoints}
            originalWidth={cameraInfo?.[zoneCamera === 1 ? "camera1" : "camera2"].width ?? 1280}
            originalHeight={cameraInfo?.[zoneCamera === 1 ? "camera1" : "camera2"].height ?? 720}
            onZoneChange={(points) => {
              setZonePoints(points);
              setZoneHistory((history) => [...history, points]);
            }}
          />
        </div>
      </div>


      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => {
            setZonePoints([]);
            setZoneHistory([]);
          }}
          className="rounded-xl bg-red-500 px-5 py-3 font-semibold text-white hover:bg-red-600"
        >
          Clear
        </button>

        <button
          onClick={() => {
            setZoneHistory((history) => {
              if (!history.length) return history;
              const nextHistory = [...history];
              const previous = nextHistory.pop();
              if (previous) {
                setZonePoints(previous);
              }
              return nextHistory;
            });
          }}
          className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-white hover:bg-yellow-600"
        >
          Undo
        </button>

        <button
          onClick={async () => {
            console.log("SAVE CLICKED");
            console.log("Camera:", zoneCamera);
            console.log("Shape:", zoneShape);
            console.log("Points:", zonePoints);

            try {
              const result = await saveZone(zoneCamera, zoneShape, zonePoints);
              console.log("SAVE RESULT:", result);
              toast.success(`Camera ${zoneCamera} zone saved successfully!`);
            } catch (err) {
              console.error("SAVE ERROR:", err);
              toast.error("Failed to save zone configuration.");
            }
          }}
          className="rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand/90 transition shadow"
        >
          Save Zone
        </button>
      </div>
    </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={<Users className="h-5 w-5" />} tone="brand"    label="Today's Customers" value={String(customers)} sub={`${customers - 12} more than yesterday`} />
        <StatCard icon={<Bell className="h-5 w-5" />}  tone="warning"  label="Alerts Today"     value={String(alertsCount)}   sub="All acknowledged" />
        <StatCard icon={<Images className="h-5 w-5" />} tone="purple"  label="Snapshots Saved"  value={String(snapCount)}   sub={`Latest: ${formatTime(now)}`} />
        <StatCard icon={<Store className="h-5 w-5" />} tone="success"  label="Shop Status"    value={shopData?.shop_status ?? "Loading..."}  sub={shopData?.occupied ? "Customer detected" : "Waiting for customers"}/>
        <StatCard icon={<Timer className="h-5 w-5" />}  tone="pink"    label="System Runtime"   value={runtime} sub={state === "stopped" ? "Paused" : "Running smoothly"} />
      </section>

      {/* Latest snapshot + summary + tips */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold">Latest Snapshot</h3>
            <span className="pill bg-success-soft text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Saved
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <img src={shopData?.latest_snapshot ? getSnapshotImageUrl(shopData.latest_snapshot) : snapshots[0].src} alt="Latest snapshot" className="h-48 w-full object-cover" loading="lazy"/>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <div className="font-bold">{formatDate(now)}</div>
              <div className="text-xs text-muted-foreground">{formatTime(now)} · Inside Shop</div>
            </div>
            <a href="/gallery" className="inline-flex items-center gap-1 rounded-xl bg-brand-soft px-3 py-2 text-xs font-bold text-brand hover:brightness-95">
              View gallery <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="text-base font-extrabold">Today&apos;s Summary</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <SummaryRow icon={<Users className="h-4 w-4" />} tone="brand" label="Customers" value={String(customers)} />
            <SummaryRow icon={<Bell className="h-4 w-4" />} tone="warning" label="Alerts" value={String(alertsCount)} />
            <SummaryRow icon={<Images className="h-4 w-4" />} tone="purple" label="Snapshots" value={String(snapCount)} />
            <SummaryRow icon={<Timer className="h-4 w-4" />} tone="success" label="Uptime" value={runtime} />
          </ul>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-extrabold">
              <Clock className="h-4 w-4 text-brand" /> Recent Activity
            </h3>
            <span className="text-xs font-semibold text-muted-foreground">{activities.length} events</span>
          </div>

          {activities.length > 0 ? (
            <ol className="mt-4 space-y-3.5 border-l-2 border-brand-soft pl-4 text-sm max-h-56 overflow-y-auto">
              {activities.map((act, idx) => {
                const isEntry = act.toLowerCase().includes("entered") || act.toLowerCase().includes("detected");
                const isEmpty = act.toLowerCase().includes("empty") || act.toLowerCase().includes("reset");
                const tone = isEntry ? "bg-brand" : isEmpty ? "bg-warning" : "bg-success";
                return (
                  <li key={idx} className="relative animate-fade-up">
                    <span className={`absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full ${tone} ring-4 ring-background`} />
                    <div className="text-xs font-medium text-foreground">{act}</div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
              <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-semibold">No recent events</p>
              <p className="text-[11px] text-muted-foreground/70">Activity will appear when customers enter.</p>
            </div>
          )}
        </div>
      </section>

      {/* System Health & Active Alerts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand" /> System Health Status
            </h3>
            <span className="pill bg-success-soft text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" /> All Systems Operational
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-secondary/70 p-3.5">
              <span className="text-xs font-bold text-muted-foreground">Backend API</span>
              <span className="text-xs font-extrabold text-success">Online (8000)</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-secondary/70 p-3.5">
              <span className="text-xs font-bold text-muted-foreground">AI Engine</span>
              <span className="text-xs font-extrabold text-brand">YOLOv8 Active</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-secondary/70 p-3.5">
              <span className="text-xs font-bold text-muted-foreground">Entrance Camera</span>
              <span className={`text-xs font-extrabold ${shopData?.camera1 === "Online" ? "text-success" : "text-danger"}`}>
                {shopData?.camera1 ?? "Online"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-secondary/70 p-3.5">
              <span className="text-xs font-bold text-muted-foreground">Inside Camera</span>
              <span className={`text-xs font-extrabold ${shopData?.camera2 === "Online" ? "text-success" : "text-danger"}`}>
                {shopData?.camera2 ?? "Online"}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning" /> Active Security Alerts
            </h3>
            <Link to="/alerts" className="text-xs font-bold text-brand hover:underline">
              View All Alerts ({alertsCount})
            </Link>
          </div>
          {alertsCount > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 rounded-2xl bg-warning-soft/70 p-3.5 text-xs text-foreground font-semibold">
                <Bell className="h-4 w-4 text-warning shrink-0" />
                <span>{alertsCount} active notifications recorded today. Check alert history for full log.</span>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-success-soft text-success mb-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">No active alerts — your shop is secure.</p>
              <p className="text-[11px] text-muted-foreground">Both entrance and interior zones are actively monitored.</p>
            </div>
          )}
        </div>
      </section>

      {/* Action buttons */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionButton tone="success" icon={<Play className="h-5 w-5" />} label="Start Monitoring" active={state === "stopped"} onClick={() => { setState("running"); toast.success("Monitoring started"); }} />
        <ActionButton tone="danger" icon={<Square className="h-5 w-5" />} label="Stop Monitoring" onClick={() => { setState("stopped"); toast("Monitoring stopped"); }} />
        <ActionButton tone="warning" icon={<RotateCcw className="h-5 w-5" />} label="Reset Counter" onClick={() => { setCustomers(0); toast("Counter reset"); }} />
        <ActionButton tone="brand" icon={<FolderOpen className="h-5 w-5" />} label="Open Gallery" onClick={() => (window.location.href = "/gallery")} />
      </section>
      {selectedCamera && (
        <ModalCamera camera={selectedCamera as 1 | 2} onClose={() => setSelectedCamera(null)} />
      )}

    </ShopLayout>
  );
}

function ModalCamera({ camera, onClose }: { camera: 1 | 2; onClose: () => void }) {
  const [imgSrc, setImgSrc] = useState(buildCameraFrameSrc(camera));

  useEffect(() => {
    setImgSrc(buildCameraFrameSrc(camera));
    const id = window.setInterval(() => {
      setImgSrc(buildCameraFrameSrc(camera));
    }, 150);
    return () => window.clearInterval(id);
  }, [camera]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-6xl rounded-3xl bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 rounded-lg bg-red-500 px-3 py-1 text-white"
          onClick={onClose}
        >
          ✕ Close
        </button>

        <h2 className="mb-4 text-xl font-bold">
          {camera === 1 ? "Entrance Camera" : "Inside Shop Camera"}
        </h2>

        <img
          src={imgSrc}
          alt="Live Camera"
          className="w-full rounded-2xl object-contain"
        />
      </div>
    </div>
  );
}

function StateChip({ label, active, tone, onClick }: { label: string; active: boolean; tone: "success" | "warning" | "brand" | "danger" | "muted"; onClick: () => void }) {
  const cls = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    brand: "bg-brand-soft text-brand",
    danger: "bg-danger-soft text-danger",
    muted: "bg-secondary text-muted-foreground",
  }[tone];
  return (
    <button onClick={onClick} className={`pill transition ${active ? `${cls} ring-2 ring-foreground/20` : "bg-white/70 text-muted-foreground hover:bg-white"}`}>
      {label}
    </button>
  );
}

function MiniStat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-extrabold">{value}</div>
      <div className="text-xs text-muted-foreground">{caption}</div>
    </div>
  );
}

function CameraCard({ title, subtitle, src, offline, dim, onRetry }: { title: string; subtitle: string; src: string; offline?: boolean; dim?: boolean; onRetry?: () => void }) {
  const cameraNumber: 1 | 2 = src.includes("camera=1") ? 1 : 2;
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setImgSrc(buildCameraFrameSrc(cameraNumber));
    }, 150);
    return () => window.clearInterval(id);
  }, [cameraNumber]);

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="text-base font-extrabold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {offline ? (
          <span className="pill bg-danger-soft text-danger">
            <WifiOff className="h-3.5 w-3.5" /> Offline
          </span>
        ) : (
          <span className="pill bg-success-soft text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" /> Live
          </span>
        )}
      </div>
      <div className="relative mx-4 mb-4 overflow-hidden rounded-2xl border border-border">
        <img src={imgSrc} alt={title} className={`h-64 w-full object-contain transition ${dim ? "opacity-40 grayscale" : ""}`} loading="lazy" />
        {offline && (
          <div className="absolute inset-0 grid place-items-center bg-danger-soft/95 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-danger">
                <WifiOff className="h-8 w-8" />
              </div>
              <div className="mt-3 text-base font-extrabold text-danger">Camera Offline</div>
              <div className="text-xs text-danger/70">Unable to connect</div>
              <button onClick={onRetry} className="mt-3 rounded-full bg-danger px-4 py-2 text-xs font-bold text-white shadow">Retry</button>
            </div>
          </div>
        )}
        {dim && !offline && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="rounded-2xl bg-white/90 px-4 py-3 text-center shadow">
              <div className="text-sm font-extrabold">Monitoring Stopped</div>
              <div className="text-xs text-muted-foreground">Click Start to resume</div>
            </div>
          </div>
        )}
        <span className="absolute bottom-3 left-3 pill bg-white/90 text-foreground backdrop-blur">
          <CameraIcon className="h-3 w-3" /> {subtitle} · {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
        </span>
      </div>
    </div>
  );
}

function StatCard({ icon, tone, label, value, sub }: { icon: React.ReactNode; tone: "brand" | "success" | "warning" | "purple" | "pink"; label: string; value: string; sub: string }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    purple: "bg-purple-soft text-purple",
    pink: "bg-pink-soft text-danger",
  }[tone];
  return (
    <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tones}`}>{icon}</div>
      </div>
      <div className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function SummaryRow({ icon, tone, label, value }: { icon: React.ReactNode; tone: "brand" | "success" | "warning" | "purple"; label: string; value: string }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    purple: "bg-purple-soft text-purple",
  }[tone];
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-3">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${tones}`}>{icon}</span>
        <span className="font-semibold">{label}</span>
      </span>
      <span className="font-extrabold tabular-nums">{value}</span>
    </li>
  );
}

function ActionButton({ tone, icon, label, active, onClick }: { tone: "success" | "danger" | "warning" | "brand"; icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  const tones = {
    success: "bg-success-soft text-success hover:bg-success hover:text-white",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
    warning: "bg-warning-soft text-warning hover:bg-warning hover:text-white",
    brand: "bg-brand-soft text-brand hover:bg-brand hover:text-white",
  }[tone];
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-extrabold transition ${tones} ${active ? "ring-4 ring-foreground/10" : ""}`}>
      {icon}
      {label}
    </button>
  );
}