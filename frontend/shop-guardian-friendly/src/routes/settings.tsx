import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShopLayout } from "@/components/ShopLayout";
import { Mascot, mascotOptions } from "@/components/Mascot";
import {
  useShopConfig,
  accentColorMap,
  type Avatar,
  type ThemeMode,
  type AccentColor,
  type DensityMode,
} from "@/lib/shop-store";
import {
  Store,
  Palette,
  Bell,
  Sliders,
  Camera,
  HardDrive,
  UserCheck,
  Check,
  RotateCcw,
  Trash2,
  Lock,
  Moon,
  Sun,
  Laptop,
  Volume2,
  VolumeX,
  Shield,
  Clock,
  Sparkles,
  Info,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSettings,
  saveSetting,
  getShopDetails,
  setupShop,
  getStorageStatus,
  deleteSnapshot,
  clearCustomerVisits,
  clearAlerts,
  changePassword,
  type StorageStatus,
} from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & System Control · ShopGuardian AI" },
      { name: "description", content: "Configure shop profile, themes, sound alerts, detection sensitivity, cameras, and data retention." },
      { property: "og:title", content: "ShopGuardian AI · Settings" },
      { property: "og:description", content: "Configure shop profile, themes, sound alerts, detection sensitivity, cameras, and data retention." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { cfg, setCfg, user, logout } = useShopConfig();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  // Tab state
  const [activeTab, setActiveTab] = useState("profile");

  // Shop Profile state
  const [shopName, setShopName] = useState(cfg.shopName);
  const [ownerName, setOwnerName] = useState(cfg.ownerName);
  const [shopType, setShopType] = useState(cfg.shopType || "General Retail");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("Main Market Road, Sector 4");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Storage status
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Danger Dialogs
  const [wipeSnapshotsOpen, setWipeSnapshotsOpen] = useState(false);
  const [wipeCustomersOpen, setWipeCustomersOpen] = useState(false);
  const [wipeAlertsOpen, setWipeAlertsOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSettings();
        const shop = await getShopDetails();
        if (shop.shop_name || shop.owner_name || shop.shop_type) {
          setShopName(shop.shop_name || cfg.shopName);
          setOwnerName(shop.owner_name || cfg.ownerName);
          setShopType(shop.shop_type || cfg.shopType);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }

    load();

    async function loadStorage() {
      try {
        setStorage(await getStorageStatus());
      } catch (error) {
        console.error("Failed to load storage status:", error);
      }
    }

    loadStorage();
    const storageInterval = setInterval(loadStorage, 60000);
    return () => clearInterval(storageInterval);
  }, []);

  // Save Shop Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await setupShop({
        shop_name: shopName,
        owner_name: ownerName,
        shop_type: shopType,
      });
      setCfg({
        ...cfg,
        shopName,
        ownerName,
        shopType,
      });
      toast.success("Shop profile updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update shop profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (res.success) {
        toast.success("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.message || "Password change failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Request browser notifications
  const handleRequestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setCfg({ ...cfg, browserNotifications: true });
        toast.success("Browser notifications enabled.");
      } else {
        setCfg({ ...cfg, browserNotifications: false });
        toast.error("Notification permission was denied.");
      }
    } else {
      toast.error("Browser notifications are not supported in this environment.");
    }
  };

  // Danger Wipe Actions
  const handleWipeCustomerHistory = async () => {
    setIsWiping(true);
    try {
      await clearCustomerVisits();
      toast.success("Customer visit history cleared.");
      setStorage((prev) => (prev ? { ...prev, customer_visit_records: 0 } : null));
    } catch {
      toast.error("Failed to clear customer history.");
    } finally {
      setIsWiping(false);
      setWipeCustomersOpen(false);
    }
  };

  const handleWipeAlertHistory = async () => {
    setIsWiping(true);
    try {
      await clearAlerts();
      toast.success("Alert history cleared.");
      setStorage((prev) => (prev ? { ...prev, alert_records: 0 } : null));
    } catch {
      toast.error("Failed to clear alert history.");
    } finally {
      setIsWiping(false);
      setWipeAlertsOpen(false);
    }
  };

  return (
    <ShopLayout>
      <div className="space-y-6">
        {/* Header */}
        <section className="glass-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Settings & System Preferences</h2>
              <p className="text-sm text-muted-foreground">
                Manage your shop profile, theme colors, notification sounds, detection rules, and storage.
              </p>
            </div>
            <button
              onClick={() => {
                toast.success("All preferences reset to default settings.");
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"
            >
              <RotateCcw className="h-4 w-4" /> Reset Defaults
            </button>
          </div>
        </section>

        {/* Tabbed Navigation Structure */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="flex h-auto w-max gap-1.5 rounded-2xl bg-secondary/80 p-1.5 backdrop-blur">
              <TabsTrigger value="profile" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <Store className="h-4 w-4" /> Shop Profile
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <Palette className="h-4 w-4" /> Appearance & Theme
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <Bell className="h-4 w-4" /> Notifications & Sound
              </TabsTrigger>
              <TabsTrigger value="detection" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <Sliders className="h-4 w-4" /> AI Detection
              </TabsTrigger>
              <TabsTrigger value="cameras" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <Camera className="h-4 w-4" /> Cameras & Zones
              </TabsTrigger>
              <TabsTrigger value="storage" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <HardDrive className="h-4 w-4" /> Storage & Retention
              </TabsTrigger>
              <TabsTrigger value="account" className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold">
                <UserCheck className="h-4 w-4" /> Account & Security
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Shop Profile Tab */}
          <TabsContent value="profile" className="space-y-6 animate-fade-up">
            <div className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={handleSaveProfile} className="glass-card p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Store className="h-5 w-5 text-brand" /> Shop Information
                </h3>
                <p className="text-xs text-muted-foreground">
                  Update your shop branding and commercial address.
                </p>

                <div className="space-y-3.5">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Shop Name</span>
                    <input
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      placeholder="e.g. Mahalakshmi Steel Traders"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Owner Name</span>
                    <input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Shop Type / Category</span>
                    <select
                      value={shopType}
                      onChange={(e) => setShopType(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand"
                    >
                      <option value="Steel & Hardware">Steel & Hardware Trading</option>
                      <option value="Grocery & Supermarket">Grocery & Supermarket</option>
                      <option value="Jewellery & Valuables">Jewellery & Valuables</option>
                      <option value="Textiles & Garments">Textiles & Garments</option>
                      <option value="Electronics & Mobile">Electronics & Mobile</option>
                      <option value="General Retail">General Retail</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Contact Phone</span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Location City</span>
                      <input
                        value="Mumbai, India"
                        disabled
                        className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-2.5 text-sm font-semibold text-muted-foreground"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-2xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-brand/90 transition disabled:opacity-50"
                  >
                    {isSavingProfile ? "Saving..." : "Save Shop Profile"}
                  </button>
                </div>
              </form>

              {/* Avatar Selector */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand" /> Mascot Avatar
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select the friendly AI assistant avatar displayed on your dashboard.
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3.5">
                  {mascotOptions.map((o) => {
                    const selected = cfg.avatar === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => {
                          setCfg({ ...cfg, avatar: o.key as Avatar });
                          toast.success(`Mascot set to ${o.label}`);
                        }}
                        className={`relative rounded-3xl border-2 p-3 text-center transition ${
                          selected
                            ? "border-brand bg-brand-soft/40 shadow-sm"
                            : "border-border bg-card hover:border-brand/40"
                        }`}
                      >
                        {selected && (
                          <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-white">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <Mascot avatar={o.key} size={80} />
                        <div className="mt-2 text-xs font-extrabold text-foreground">{o.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 2. Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6 animate-fade-up">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Theme Mode Card */}
              <div className="glass-card p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-extrabold flex items-center gap-2">
                    <Palette className="h-5 w-5 text-brand" /> Theme Mode
                  </h3>
                  <p className="text-xs text-muted-foreground">Choose your preferred application color theme.</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { mode: "light" as ThemeMode, label: "Light Mode", icon: <Sun className="h-5 w-5" /> },
                    { mode: "dark" as ThemeMode, label: "Dark Mode", icon: <Moon className="h-5 w-5" /> },
                    { mode: "system" as ThemeMode, label: "System Sync", icon: <Laptop className="h-5 w-5" /> },
                  ].map((t) => {
                    const selected = cfg.theme === t.mode;
                    return (
                      <button
                        key={t.mode}
                        onClick={() => {
                          setCfg({ ...cfg, theme: t.mode });
                          toast.success(`Theme set to ${t.label}`);
                        }}
                        className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-4 font-bold text-xs transition ${
                          selected
                            ? "border-brand bg-brand-soft text-brand shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Presets */}
              <div className="glass-card p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-extrabold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-brand" /> Brand Accent Color
                  </h3>
                  <p className="text-xs text-muted-foreground">Select a vibrant accent palette for buttons and badges.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.keys(accentColorMap) as AccentColor[]).map((key) => {
                    const item = accentColorMap[key];
                    const selected = cfg.accentColor === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setCfg({ ...cfg, accentColor: key });
                          toast.success(`Accent color set to ${item.label}`);
                        }}
                        className={`flex items-center gap-2.5 rounded-2xl border-2 p-3 font-bold text-xs transition ${
                          selected
                            ? "border-brand bg-secondary shadow-sm text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ backgroundColor: item.brand }}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UI Density & Animation Settings */}
              <div className="glass-card p-6 space-y-4 lg:col-span-2">
                <h3 className="text-lg font-extrabold">Layout & Animations</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Smooth Interface Animations</div>
                      <div className="text-xs text-muted-foreground">Enable subtle transitions and hover lifts</div>
                    </div>
                    <button
                      onClick={() => setCfg({ ...cfg, animations: !cfg.animations })}
                      className={`relative h-7 w-12 rounded-full transition ${cfg.animations ? "bg-brand" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.animations ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Status Pulse Glows</div>
                      <div className="text-xs text-muted-foreground">Pulsing indicators on active monitoring items</div>
                    </div>
                    <button
                      onClick={() => setCfg({ ...cfg, statusPulse: !cfg.statusPulse })}
                      className={`relative h-7 w-12 rounded-full transition ${cfg.statusPulse ? "bg-brand" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.statusPulse ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 3. Notifications & Sound Tab */}
          <TabsContent value="notifications" className="space-y-6 animate-fade-up">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Sound Toggles */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-brand" /> Audio Alerts
                </h3>
                <p className="text-xs text-muted-foreground">Chimes played when key events happen in your shop.</p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Customer Entry Sound</div>
                      <div className="text-xs text-muted-foreground">Soft non-blocking chime when someone enters</div>
                    </div>
                    <button
                      onClick={() => setCfg({ ...cfg, alertSound: !cfg.alertSound })}
                      className={`relative h-7 w-12 rounded-full transition ${cfg.alertSound ? "bg-brand" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.alertSound ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Security Warning Chime</div>
                      <div className="text-xs text-muted-foreground">Alert chime on unexpected activity</div>
                    </div>
                    <button
                      onClick={() => setCfg({ ...cfg, securitySound: !cfg.securitySound })}
                      className={`relative h-7 w-12 rounded-full transition ${cfg.securitySound ? "bg-brand" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.securitySound ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Camera Disconnect Warning</div>
                      <div className="text-xs text-muted-foreground">Alert if an RTSP stream fails or disconnects</div>
                    </div>
                    <button
                      onClick={() => setCfg({ ...cfg, cameraDisconnectAlert: !cfg.cameraDisconnectAlert })}
                      className={`relative h-7 w-12 rounded-full transition ${cfg.cameraDisconnectAlert ? "bg-brand" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.cameraDisconnectAlert ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quiet Hours & Browser Notifications */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand" /> Quiet Hours
                </h3>
                <p className="text-xs text-muted-foreground">
                  Silences sound chimes while AI detection continues running and recording in the background.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Enable Quiet Hours</div>
                      <div className="text-xs text-muted-foreground">Mute sound chimes during shop closing hours</div>
                    </div>
                    <button
                      onClick={() => setCfg({ ...cfg, quietHoursEnabled: !cfg.quietHoursEnabled })}
                      className={`relative h-7 w-12 rounded-full transition ${cfg.quietHoursEnabled ? "bg-brand" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.quietHoursEnabled ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                    </button>
                  </div>

                  {cfg.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-3 animate-fade-up">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Start Quiet Time</span>
                        <input
                          type="time"
                          value={cfg.quietHoursStart}
                          onChange={(e) => setCfg({ ...cfg, quietHoursStart: e.target.value })}
                          className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm font-bold"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">End Quiet Time</span>
                        <input
                          type="time"
                          value={cfg.quietHoursEnd}
                          onChange={(e) => setCfg({ ...cfg, quietHoursEnd: e.target.value })}
                          className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm font-bold"
                        />
                      </label>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                    <div>
                      <div className="font-bold text-sm">Browser Desktop Alerts</div>
                      <div className="text-xs text-muted-foreground">Show native OS toast when minimized</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestNotificationPermission}
                      className="rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand/90"
                    >
                      {cfg.browserNotifications ? "Enabled" : "Enable"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 4. Detection Preferences Tab */}
          <TabsContent value="detection" className="space-y-6 animate-fade-up">
            <div className="glass-card p-6 space-y-5">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-brand" /> YOLOv8 AI Computer Vision Preferences
                </h3>
                <p className="text-xs text-muted-foreground">
                  Adjust detection sensitivity and visual overlay features.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                  <div>
                    <div className="font-bold text-sm">Person Detection Engine</div>
                    <div className="text-xs text-muted-foreground">Ultralytics YOLOv8 person class filter (class 0)</div>
                  </div>
                  <span className="pill bg-success-soft text-success text-xs font-bold">Active</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                  <div>
                    <div className="font-bold text-sm">Foot-Point Math</div>
                    <div className="text-xs text-muted-foreground">Zone inclusion based on bottom-center (x_center, y2)</div>
                  </div>
                  <span className="pill bg-brand-soft text-brand text-xs font-bold">Enabled</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                  <div>
                    <div className="font-bold text-sm">Show Bounding Boxes</div>
                    <div className="text-xs text-muted-foreground">Display green detection boxes on live feeds</div>
                  </div>
                  <button
                    onClick={() => setCfg({ ...cfg, showBoxes: !cfg.showBoxes })}
                    className={`relative h-7 w-12 rounded-full transition ${cfg.showBoxes ? "bg-brand" : "bg-border"}`}
                  >
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.showBoxes ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                  <div>
                    <div className="font-bold text-sm">Show Zone Outlines</div>
                    <div className="text-xs text-muted-foreground">Display entry polygons overlaid on camera feeds</div>
                  </div>
                  <button
                    onClick={() => setCfg({ ...cfg, showZones: !cfg.showZones })}
                    className={`relative h-7 w-12 rounded-full transition ${cfg.showZones ? "bg-brand" : "bg-border"}`}
                  >
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${cfg.showZones ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Slider */}
              <div className="rounded-2xl bg-secondary/60 p-5 space-y-2">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Detection Confidence Threshold</span>
                  <span className="text-brand tabular-nums">
                    {Math.round(cfg.confidenceThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  value={cfg.confidenceThreshold}
                  onChange={(e) => setCfg({ ...cfg, confidenceThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-brand cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>20% (More sensitive)</span>
                  <span>35% (Recommended)</span>
                  <span>80% (Strict)</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 5. Cameras Tab */}
          <TabsContent value="cameras" className="space-y-6 animate-fade-up">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    <Camera className="h-5 w-5 text-brand" /> Camera 1 — Entrance View
                  </h3>
                  <span className="pill bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                    🟢 Demo Mode
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
                    <span className="text-muted-foreground font-semibold">Feed Source:</span>
                    <span className="font-bold text-foreground">sample_cctv_entrance.mp4</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
                    <span className="text-muted-foreground font-semibold">Resolution:</span>
                    <span className="font-bold text-foreground">1280 x 720 @ 30 FPS</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
                    <span className="text-muted-foreground font-semibold">Zone Purpose:</span>
                    <span className="font-bold text-brand">Customer Entrance Detection</span>
                  </div>
                </div>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-2.5 text-xs font-bold text-brand hover:brightness-95 transition"
                >
                  Configure Camera 1 Zone in Dashboard <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    <Camera className="h-5 w-5 text-brand" /> Camera 2 — Inside Shop View
                  </h3>
                  <span className="pill bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                    🟢 Demo Mode
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
                    <span className="text-muted-foreground font-semibold">Feed Source:</span>
                    <span className="font-bold text-foreground">sample_cctv_inside.mp4</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
                    <span className="text-muted-foreground font-semibold">Resolution:</span>
                    <span className="font-bold text-foreground">1280 x 720 @ 30 FPS</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-secondary/60 p-3">
                    <span className="text-muted-foreground font-semibold">Zone Purpose:</span>
                    <span className="font-bold text-brand">Occupancy & Interior Monitoring</span>
                  </div>
                </div>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-2.5 text-xs font-bold text-brand hover:brightness-95 transition"
                >
                  Configure Camera 2 Zone in Dashboard <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </TabsContent>

          {/* 6. Storage & Retention Tab */}
          <TabsContent value="storage" className="space-y-6 animate-fade-up">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-brand" /> Disk Usage & Retention Policy
                </h3>
                <p className="text-xs text-muted-foreground">
                  Automated rolling retention prevents local storage from filling up.
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
                    <span className="font-bold">Screenshots Stored</span>
                    <span className="font-extrabold text-brand tabular-nums">
                      {storage ? `${storage.screenshots_used} / ${storage.screenshots_max}` : "Loading..."}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
                    <span className="font-bold">Total Database Records</span>
                    <span className="font-extrabold text-brand tabular-nums">
                      {storage ? `${storage.customer_visit_records + storage.alert_records} records` : "Loading..."}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
                    <span className="font-bold">Screenshot Retention Window</span>
                    <span className="font-extrabold text-foreground">{storage?.screenshot_retention_days ?? 7} Days</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
                    <span className="font-bold">Log Retention Window</span>
                    <span className="font-extrabold text-foreground">{storage?.log_retention_days ?? 30} Days</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
                    <span className="font-bold">Last Automated Cleanup</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {storage?.last_cleanup ? new Date(storage.last_cleanup).toLocaleString() : "Running regularly"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-3xl border border-danger/30 bg-danger-soft/30 p-6 space-y-4">
                <h3 className="text-lg font-extrabold text-danger flex items-center gap-2">
                  <Trash2 className="h-5 w-5" /> Danger Zone — Wipe Data
                </h3>
                <p className="text-xs text-muted-foreground">
                  Permanently purge stored logs and files. These actions require explicit confirmation.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-background p-4 border border-danger/20">
                    <div>
                      <div className="font-bold text-sm text-foreground">Clear Customer Footfall History</div>
                      <div className="text-xs text-muted-foreground">Delete all visit records from SQLite database</div>
                    </div>
                    <button
                      onClick={() => setWipeCustomersOpen(true)}
                      className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-bold text-danger hover:bg-danger hover:text-white transition"
                    >
                      Clear Visits
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-background p-4 border border-danger/20">
                    <div>
                      <div className="font-bold text-sm text-foreground">Clear Alert History</div>
                      <div className="text-xs text-muted-foreground">Purge all security and system alert records</div>
                    </div>
                    <button
                      onClick={() => setWipeAlertsOpen(true)}
                      className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-bold text-danger hover:bg-danger hover:text-white transition"
                    >
                      Clear Alerts
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 7. Account & Security Tab */}
          <TabsContent value="account" className="space-y-6 animate-fade-up">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Account details */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-brand" /> Administrator Profile
                </h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between rounded-2xl bg-secondary/60 p-3.5">
                    <span className="text-muted-foreground font-semibold">Admin Username:</span>
                    <span className="font-bold text-foreground">@{user?.username || "admin"}</span>
                  </div>
                  <div className="flex justify-between rounded-2xl bg-secondary/60 p-3.5">
                    <span className="text-muted-foreground font-semibold">Full Name:</span>
                    <span className="font-bold text-foreground">{user?.full_name || cfg.ownerName || "Shopkeeper"}</span>
                  </div>
                  <div className="flex justify-between rounded-2xl bg-secondary/60 p-3.5">
                    <span className="text-muted-foreground font-semibold">User Role:</span>
                    <span className="pill bg-brand-soft text-brand text-xs font-bold">Admin</span>
                  </div>
                  <div className="flex justify-between rounded-2xl bg-secondary/60 p-3.5">
                    <span className="text-muted-foreground font-semibold">Authentication:</span>
                    <span className="text-xs font-bold text-success">PBKDF2-SHA256 Encrypted</span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-5 py-2.5 text-xs font-bold text-danger hover:bg-danger hover:text-white transition"
                  >
                    Logout from Session
                  </button>
                </div>
              </div>

              {/* Password Change Form */}
              <form onSubmit={handleChangePassword} className="glass-card p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Lock className="h-5 w-5 text-brand" /> Change Password
                </h3>
                <p className="text-xs text-muted-foreground">
                  Update your local admin password for ShopGuardian access.
                </p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Current Password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">New Password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Confirm New Password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-brand"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="rounded-2xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand/90 transition disabled:opacity-50"
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialog: Clear Customer Visits */}
      <AlertDialog open={wipeCustomersOpen} onOpenChange={setWipeCustomersOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear customer footfall history?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete all customer entry records? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWiping}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipeCustomerHistory}
              disabled={isWiping}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isWiping ? "Clearing..." : "Yes, Clear Visits"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Clear Alerts */}
      <AlertDialog open={wipeAlertsOpen} onOpenChange={setWipeAlertsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear alert history?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete all security alert records?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWiping}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipeAlertHistory}
              disabled={isWiping}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isWiping ? "Clearing..." : "Yes, Clear Alerts"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShopLayout>
  );
}