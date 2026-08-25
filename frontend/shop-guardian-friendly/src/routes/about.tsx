import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Camera, Bell, Users, Heart, Mail, Phone } from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { Mascot } from "@/components/Mascot";
import { useShopConfig } from "@/lib/shop-store";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · ShopGuardian AI" },
      { name: "description", content: "ShopGuardian AI — a friendly smart shop monitoring system for small shop owners." },
      { property: "og:title", content: "About ShopGuardian AI" },
      { property: "og:description", content: "ShopGuardian AI — a friendly smart shop monitoring system for small shop owners." },
    ],
  }),
  component: About,
});

function About() {
  const { cfg } = useShopConfig();
  return (
    <ShopLayout>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <div className="text-xl font-extrabold">ShopGuardian AI</div>
              <div className="text-xs text-muted-foreground">Version 1.0.0 · Made with <Heart className="inline h-3 w-3 text-danger" /> for shop owners</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            ShopGuardian AI is a friendly smart shop monitoring system that helps small shop owners
            keep their store safe. Watch live cameras, count customers, capture snapshots and get
            simple alerts — no technical skills required.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { icon: <Camera className="h-4 w-4" />, label: "AI Powered Monitoring", tone: "bg-brand-soft text-brand" },
              { icon: <Users className="h-4 w-4" />, label: "Customer Detection", tone: "bg-success-soft text-success" },
              { icon: <Bell className="h-4 w-4" />, label: "Real-time Alerts", tone: "bg-warning-soft text-warning" },
              { icon: <ShieldCheck className="h-4 w-4" />, label: "Secure & Reliable", tone: "bg-purple-soft text-purple" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <div className={`grid h-9 w-9 place-items-center rounded-xl ${f.tone}`}>{f.icon}</div>
                <div className="font-semibold">{f.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-secondary p-4 text-sm">
            <div className="font-bold">Need help?</div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> +91 12345 67890</span>
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> hello@shopguardian.ai</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-brand-soft via-purple-soft to-pink-soft p-8 text-center">
          <Mascot avatar={cfg.avatar} size={220} float />
          <div className="mt-4 text-lg font-extrabold">Thank you for trusting ShopGuardian AI</div>
          <div className="mt-1 text-sm text-muted-foreground">A safer shop, a happier life.</div>
        </div>
      </section>
    </ShopLayout>
  );
}