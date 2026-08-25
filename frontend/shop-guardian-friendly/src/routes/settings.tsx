import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShopLayout } from "@/components/ShopLayout";
import { Mascot, mascotOptions } from "@/components/Mascot";
import { useShopConfig, type Avatar } from "@/lib/shop-store";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getSettings, saveSetting, getShopDetails, setupShop } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · ShopGuardian AI" },
      { name: "description", content: "Personalise ShopGuardian AI — sounds, snapshots, theme and your ShopGuardian avatar." },
      { property: "og:title", content: "ShopGuardian AI · Settings" },
      { property: "og:description", content: "Personalise ShopGuardian AI — sounds, snapshots, theme and your ShopGuardian avatar." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { cfg, setCfg } = useShopConfig();
  const [alertSound, setAlertSound] = useState(true);
  const [saveSnaps, setSaveSnaps] = useState(true);
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSettings();
        setAlertSound(data.alert_sound === "true");
        setSaveSnaps(data.save_snapshots !== "false");
        setAutoStart(data.auto_start === "true");
        const shop = await getShopDetails();
        if (shop.shop_name || shop.owner_name || shop.shop_type) {
          setCfg({ ...cfg, shopName: shop.shop_name || cfg.shopName, ownerName: shop.owner_name || cfg.ownerName, shopType: shop.shop_type || cfg.shopType });
        }
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, []);

  const persistToggle = async (key: string, value: boolean) => {
    await saveSetting(key, value ? "true" : "false");
  };

  return (
    <ShopLayout>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-6">
          <h2 className="text-xl font-extrabold">Preferences</h2>
          <p className="text-sm text-muted-foreground">Simple controls, no tech setup needed.</p>
          <div className="mt-5 space-y-2">
            <ToggleRow label="Alert Sound" desc="Play a soft chime when something important happens." value={alertSound} onChange={async (value) => { setAlertSound(value); await persistToggle("alert_sound", value); }} />
            <ToggleRow label="Save Snapshots" desc="Automatically save a photo when a customer is detected." value={saveSnaps} onChange={async (value) => { setSaveSnaps(value); await persistToggle("save_snapshots", value); }} />
            <ToggleRow label="Auto Start Monitoring" desc="Start watching automatically when the app opens." value={autoStart} onChange={async (value) => { setAutoStart(value); await persistToggle("auto_start", value); }} />
          </div>

          <div className="mt-6 rounded-2xl bg-brand-soft/60 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-brand">Theme</div>
            <div className="mt-2 flex gap-2">
              {["Light", "System"].map((t, i) => (
                <button key={t} className={`flex-1 rounded-2xl border-2 py-3 text-sm font-bold ${i === 0 ? "border-brand bg-white text-brand" : "border-transparent bg-white/60 text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
          </div>

          <button onClick={() => toast("Defaults restored")} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-danger">
            <RotateCcw className="h-4 w-4" /> Restore Defaults
          </button>
        </section>

        <section className="glass-card p-6">
          <h2 className="text-xl font-extrabold">Your ShopGuardian</h2>
          <p className="text-sm text-muted-foreground">Change your friendly avatar anytime.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {mascotOptions.map((o) => {
              const selected = cfg.avatar === o.key;
              return (
                <button key={o.key} onClick={() => setCfg({ ...cfg, avatar: o.key as Avatar })}
                  className={`relative rounded-2xl border-2 p-3 text-center transition ${selected ? "border-brand bg-brand-soft" : "border-border hover:border-brand/40"}`}>
                  {selected && (
                    <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-white">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <Mascot avatar={o.key} size={90} />
                  <div className="mt-1 text-xs font-bold">{o.label}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-3">
            <TextRow label="Shop Name" value={cfg.shopName} onChange={async (v) => { const next = { ...cfg, shopName: v }; setCfg(next); await setupShop({ shop_name: v, owner_name: next.ownerName, shop_type: next.shopType || "Grocery" }); }} />
            <TextRow label="Owner Name" value={cfg.ownerName} onChange={async (v) => { const next = { ...cfg, ownerName: v }; setCfg(next); await setupShop({ shop_name: next.shopName, owner_name: v, shop_type: next.shopType || "Grocery" }); }} />
          </div>
        </section>
      </div>
    </ShopLayout>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/60 p-4">
      <div>
        <div className="font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <button onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-brand" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${value ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function TextRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
    </label>
  );
}