import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  Camera,
  Bell,
  Users,
  Heart,
  Mail,
  Phone,
  Cpu,
  Layers,
  Database,
  Code2,
  Lock,
  HardDrive,
  Workflow,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  MonitorCheck,
  Eye,
  Zap,
} from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { Mascot } from "@/components/Mascot";
import { useShopConfig } from "@/lib/shop-store";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Architecture · ShopGuardian AI" },
      { name: "description", content: "Learn about ShopGuardian AI — an intelligent, privacy-first CCTV monitoring and customer analytics system." },
      { property: "og:title", content: "About ShopGuardian AI" },
      { property: "og:description", content: "Learn about ShopGuardian AI — an intelligent, privacy-first CCTV monitoring and customer analytics system." },
    ],
  }),
  component: About,
});

function About() {
  const { cfg } = useShopConfig();

  const pipelineSteps = [
    {
      step: "01",
      title: "RTSP / CCTV Video Ingestion",
      desc: "Connects to physical DVR RTSP streams or local offline video feeds at 30 FPS.",
      icon: <Camera className="h-5 w-5 text-brand" />,
    },
    {
      step: "02",
      title: "YOLOv8 Person Detection",
      desc: "Executes lightweight Ultralytics neural network inference filtering class 0 (Person).",
      icon: <Cpu className="h-5 w-5 text-purple" />,
    },
    {
      step: "03",
      title: "Foot-Point Zone Intersection",
      desc: "Calculates bottom-center coordinate (x_center, y2) intersection with polygon entry zones.",
      icon: <Layers className="h-5 w-5 text-success" />,
    },
    {
      step: "04",
      title: "State Machine & Snapshot",
      desc: "Locks occupancy state, triggers non-blocking sound chime, and captures high-res evidence.",
      icon: <Zap className="h-5 w-5 text-warning" />,
    },
    {
      step: "05",
      title: "FastAPI REST & SQLite Log",
      desc: "Records event metadata with automatic rolling retention policies and rolling disk cleanup.",
      icon: <Database className="h-5 w-5 text-brand" />,
    },
    {
      step: "06",
      title: "Responsive React UI",
      desc: "Real-time interactive dashboard with TanStack Router, live camera cards, and evidence gallery.",
      icon: <MonitorCheck className="h-5 w-5 text-purple" />,
    },
  ];

  const features = [
    {
      title: "Dual Camera Fusion",
      desc: "Simultaneous monitoring of entrance and interior retail areas with distinct zone logic.",
      icon: <Camera className="h-5 w-5 text-brand" />,
    },
    {
      title: "Foot-Point Accuracy",
      desc: "Uses customer foot-ground contact math to prevent false triggers from heads or shadows.",
      icon: <Layers className="h-5 w-5 text-success" />,
    },
    {
      title: "Non-Blocking Audio Alerts",
      desc: "Gentle entry chime alerts shopkeepers without interrupting customer conversations.",
      icon: <Bell className="h-5 w-5 text-warning" />,
    },
    {
      title: "Privacy First & Local Storage",
      desc: "Counts customers without storing biometric identities or uploading data to third parties.",
      icon: <Lock className="h-5 w-5 text-purple" />,
    },
    {
      title: "Rolling Disk Retention",
      desc: "Automated 6-hour background jobs prevent disk exhaustion with 7-day snapshot windows.",
      icon: <HardDrive className="h-5 w-5 text-danger" />,
    },
    {
      title: "Mobile First Ergonomics",
      desc: "Full responsiveness across smartphones (320px+), tablets, and desktop displays.",
      icon: <MonitorCheck className="h-5 w-5 text-brand" />,
    },
  ];

  const techStack = [
    { category: "Artificial Intelligence", techs: "Ultralytics YOLOv8, PyTorch, TorchVision" },
    { category: "Computer Vision", techs: "OpenCV (cv2), Pillow, NumPy" },
    { category: "Backend Engine", techs: "Python 3.12, FastAPI, Uvicorn, SQLite3" },
    { category: "Security & Auth", techs: "PBKDF2-HMAC-SHA256, HMAC Bearer Tokens" },
    { category: "Frontend Core", techs: "React 18, TypeScript, Vite, TanStack Router" },
    { category: "State & Styling", techs: "TanStack Query, TailwindCSS, Radix UI, Lucide Icons" },
  ];

  return (
    <ShopLayout>
      <div className="space-y-6">
        {/* Hero Section */}
        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-brand-soft via-purple-soft to-success-soft p-8 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3.5">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-purple text-white shadow-lg">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
                  ShopGuardian AI
                </h2>
                <div className="text-xs font-bold text-muted-foreground">
                  Version 1.0.0 · Intelligent AI CCTV Security & Analytics
                </div>
              </div>
            </div>

            <p className="mt-5 text-sm text-foreground/80 leading-relaxed">
              <strong>ShopGuardian AI</strong> is a modern, lightweight AI CCTV monitoring system purpose-built for local retail shops and family businesses. Combining Ultralytics YOLOv8 real-time person detection with custom foot-point coordinate geometry, ShopGuardian watches your shop, sounds friendly non-blocking chimes when customers arrive, logs visitor counts, and preserves evidence snapshots — completely offline and privacy-first.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="pill bg-brand text-white text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" /> 100% Local-First
              </span>
              <span className="pill bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold">
                🟢 Prerecorded CCTV Demo Ready
              </span>
              <span className="pill bg-purple-soft text-purple text-xs font-bold">
                <Lock className="h-3.5 w-3.5" /> Privacy Centric
              </span>
            </div>
          </div>

          <div className="glass-card flex flex-col items-center justify-center p-8 text-center">
            <Mascot avatar={cfg.avatar} size={180} float />
            <h3 className="mt-4 text-base font-extrabold text-foreground">
              &ldquo;A safer shop, a happier life.&rdquo;
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              Designed with care for shopkeepers, ensuring complete peace of mind throughout the working day.
            </p>
          </div>
        </section>

        {/* What is ShopGuardian AI */}
        <section className="glass-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5">
            <Eye className="h-6 w-6 text-brand" />
            <h3 className="text-xl font-extrabold text-foreground">What is ShopGuardian AI?</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Most commercial CCTV systems are passive: they record hundreds of gigabytes of video to hard drives that no one watches until something goes wrong. Small shop owners cannot afford dedicated security staff or expensive cloud subscriptions.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>ShopGuardian AI</strong> turns standard existing CCTV cameras into active, intelligent assistants. By applying computer vision at the edge, it monitors entrance and interior zones simultaneously. When a customer steps over the entrance threshold, the system immediately recognizes the event, plays a soft non-intrusive sound to alert the shopkeeper, increments the daily visitor tally, and stores an evidence snapshot.
          </p>
        </section>

        {/* Architecture & AI Pipeline Flow */}
        <section className="glass-card p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2.5">
              <Workflow className="h-6 w-6 text-brand" /> How It Works — End-to-End AI Pipeline
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Step-by-step visual processing flow from raw video pixels to real-time shop analytics.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pipelineSteps.map((p) => (
              <div key={p.step} className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-brand/40 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80">
                      {p.icon}
                    </div>
                    <span className="text-xs font-extrabold text-brand tabular-nums">STEP {p.step}</span>
                  </div>
                  <h4 className="mt-3 font-extrabold text-sm text-foreground">{p.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key Features Grid */}
        <section className="glass-card p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2.5">
              <Sparkles className="h-6 w-6 text-brand" /> Key System Capabilities
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Engineered specifically for practical real-world shopkeeper workflows.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5 rounded-2xl border border-border bg-secondary/40 p-4.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card shadow-xs">
                  {f.icon}
                </div>
                <div>
                  <div className="font-extrabold text-sm text-foreground">{f.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Technology Stack & Specs */}
        <section className="glass-card p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2.5">
              <Code2 className="h-6 w-6 text-brand" /> Technology Stack & Specifications
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Production-tested open-source libraries and frameworks powering ShopGuardian AI.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techStack.map((item) => (
              <div key={item.category} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand">{item.category}</div>
                <div className="mt-1 font-extrabold text-sm text-foreground">{item.techs}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Demo Mode Guide for Evaluators */}
        <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500 text-white font-bold text-xs">
              ✓
            </span>
            <h3 className="text-lg font-extrabold text-foreground">
              Demo Mode & Offline Evaluation Guide
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            To make ShopGuardian AI instantly evaluable during hackathons, classroom presentations, and academic evaluations without needing physical RTSP IP cameras or DVR wiring, the system includes an automatic <strong>Offline Demo Mode</strong>.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In Demo Mode, the OpenCV video worker loops prerecorded CCTV footage (<code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">sample_cctv_entrance.mp4</code> and <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">sample_cctv_inside.mp4</code>). The YOLOv8 model, zone collision math, snapshot capture, database persistence, and frontend live view execute with 100% real inference logic.
          </p>
        </section>

        {/* Support & Contact Card */}
        <section className="glass-card p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-base font-extrabold text-foreground">Need Technical Support or Deployment Assistance?</div>
            <div className="text-xs text-muted-foreground">ShopGuardian AI is built with pride for local businesses.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-foreground">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2">
              <Mail className="h-4 w-4 text-brand" /> hello@shopguardian.ai
            </span>
            <span className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2">
              <Phone className="h-4 w-4 text-brand" /> +91 98765 43210
            </span>
          </div>
        </section>
      </div>
    </ShopLayout>
  );
}