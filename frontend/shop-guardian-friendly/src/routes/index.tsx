import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Bell,
  Camera,
  Users,
  Lock,
  User,
  Phone,
  Mail,
  Store,
  Video,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  MapPin,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useShopConfig, type Avatar } from "@/lib/shop-store";
import { Mascot, mascotOptions } from "@/components/Mascot";
import shopScene from "@/assets/shop-scene.png";
import {
  loginUser,
  registerUser,
  setupShop,
  testCameraConnection,
  saveCameraConfig,
  type CameraConfig,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Onboarding,
});

const SHOP_TYPES = [
  "Grocery / Kirana Store",
  "Hardware & Tools",
  "Medical & Pharmacy",
  "Clothing & Garments",
  "Electronics & Mobile",
  "Stationery & Books",
  "Supermarket",
  "Other Retail",
];

type FlowMode = "login" | "register" | "shop_setup" | "camera_setup";

export function Onboarding() {
  const { cfg, setCfg, user, shop, ready, loading } = useShopConfig();
  const navigate = useNavigate();

  // Mode & Step tracking
  const [mode, setMode] = useState<FlowMode>("login");
  const [avatar, setAvatar] = useState<Avatar>("male");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states - Login / Register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [shopkeeperType, setShopkeeperType] = useState("Grocery / Kirana Store");

  // Form states - Shop Setup (Fresh empty defaults, NEVER auto-populated from old localStorage)
  const [shopName, setShopName] = useState("");
  const [shopType, setShopType] = useState("Grocery / Kirana Store");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");

  // Form states - Camera Setup (Camera 1 & Camera 2)
  const [cam1, setCam1] = useState<CameraConfig>({
    camera_number: 1,
    name: "Camera 1 (Entry/Entrance)",
    mode: "demo",
    ip_address: "",
    port: 554,
    username: "admin",
    password: "",
    channel: "1",
    subtype: "0",
    enabled: true,
  });

  const [cam2, setCam2] = useState<CameraConfig>({
    camera_number: 2,
    name: "Camera 2 (Inside Store)",
    mode: "demo",
    ip_address: "",
    port: 554,
    username: "admin",
    password: "",
    channel: "2",
    subtype: "0",
    enabled: true,
  });

  // Camera connection test states
  const [testingCam1, setTestingCam1] = useState(false);
  const [testingCam2, setTestingCam2] = useState(false);
  const [cam1TestResult, setCam1TestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cam2TestResult, setCam2TestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-redirect if authenticated user already has a configured shop
  useEffect(() => {
    if (ready && !loading) {
      if (user && shop && cfg.onboarded) {
        navigate({ to: "/dashboard" });
      } else if (user && !shop) {
        setMode("shop_setup");
        setOwnerName(user.full_name || user.username);
        setUserPhone(user.phone || "");
        setUserEmail(user.email || "");
      }
    }
  }, [ready, loading, user, shop, cfg.onboarded, navigate]);

  // --- Actions ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Please enter your username and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginUser(username.trim(), password);
      toast.success(`Welcome back, ${res.user.full_name || res.user.username}!`);

      if (res.shop && res.shop.shop_name) {
        setCfg({
          ...cfg,
          shopName: res.shop.shop_name,
          ownerName: res.user.full_name || res.user.username,
          shopType: res.shop.shop_type || "General Retail",
          language: "en",
          avatar,
          onboarded: true,
        });
        navigate({ to: "/dashboard" });
      } else {
        setOwnerName(res.user.full_name || res.user.username);
        setUserPhone(res.user.phone || "");
        setUserEmail(res.user.email || "");
        setMode("shop_setup");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid login credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Username and password are required.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerUser({
        username: username.trim(),
        password,
        confirm_password: confirmPassword,
        full_name: fullName.trim(),
        phone: userPhone.trim(),
        email: userEmail.trim(),
        shopkeeper_type: shopkeeperType,
      });

      toast.success("Account registered successfully!");
      setOwnerName(res.user.full_name || res.user.username);
      setMode("shop_setup");
    } catch (err: any) {
      toast.error(err.message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShopSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      toast.error("Please enter your Shop Name.");
      return;
    }

    setIsSubmitting(true);
    try {
      await setupShop({
        shop_name: shopName.trim(),
        shop_type: shopType,
        owner_name: ownerName.trim(),
        phone: userPhone.trim(),
        email: userEmail.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pin_code: pinCode.trim(),
      });

      toast.success("Shop information saved! Now configure your cameras.");
      setMode("camera_setup");
    } catch (err: any) {
      toast.error(err.message || "Failed to save shop details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async (cameraNum: 1 | 2) => {
    const config = cameraNum === 1 ? cam1 : cam2;
    if (cameraNum === 1) {
      setTestingCam1(true);
      setCam1TestResult(null);
    } else {
      setTestingCam2(true);
      setCam2TestResult(null);
    }

    try {
      const res = await testCameraConnection({
        mode: config.mode,
        ip_address: config.ip_address,
        port: config.port ? Number(config.port) : 554,
        username: config.username,
        password: config.password,
        channel: config.channel,
        subtype: config.subtype,
        camera_number: cameraNum,
      });

      const result = { success: res.success, message: res.message };
      if (cameraNum === 1) setCam1TestResult(result);
      else setCam2TestResult(result);

      if (res.success) toast.success(`Camera ${cameraNum}: ${res.message}`);
      else toast.error(`Camera ${cameraNum}: ${res.message}`);
    } catch (err: any) {
      const errRes = { success: false, message: err.message || "Connection test failed." };
      if (cameraNum === 1) setCam1TestResult(errRes);
      else setCam2TestResult(errRes);
      toast.error(`Camera ${cameraNum}: ${err.message || "Connection test failed."}`);
    } finally {
      if (cameraNum === 1) setTestingCam1(false);
      else setTestingCam2(false);
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      // Save Camera 1 and Camera 2
      await saveCameraConfig(cam1);
      await saveCameraConfig(cam2);

      setCfg({
        ...cfg,
        shopName: shopName || "My Shop",
        ownerName: ownerName || "Owner",
        shopType: shopType || "General Retail",
        language: "en",
        avatar,
        onboarded: true,
      });

      toast.success("Shop setup & camera configuration complete!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to save camera configurations.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_1.1fr]">
        
        {/* Left Welcome Hero Panel */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-soft via-purple-soft to-pink-soft p-6 sm:p-10 lg:p-12">
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white shadow-lg">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-extrabold">ShopGuardian AI</div>
                <div className="text-xs text-muted-foreground">Smart Shop Monitoring System</div>
              </div>
            </div>

            <div className="mt-8 sm:mt-10 max-w-lg">
              <span className="pill bg-white text-brand">
                <Sparkles className="h-3.5 w-3.5" /> Next-Gen AI Security
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Welcome to <span className="text-brand">ShopGuardian AI</span>
              </h1>
              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground">
                Your intelligent shop guardian. Monitor customer footfall, zone entries, and receive instant real-time alerts.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <FeatureChip icon={<Camera className="h-4 w-4" />} label="AI Monitoring" wrap="bg-brand-soft text-brand" />
              <FeatureChip icon={<Users className="h-4 w-4" />} label="Customer Count" wrap="bg-success-soft text-success" />
              <FeatureChip icon={<Bell className="h-4 w-4" />} label="Instant Alerts" wrap="bg-warning-soft text-warning" />
            </div>

            <div className="mt-auto flex items-end justify-between pt-6">
              <img src={shopScene} alt="Your shop" className="h-36 w-auto sm:h-52" />
              <div className="hidden sm:block">
                <Mascot avatar={avatar} size={180} float />
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Card Panel */}
        <div className="flex items-center">
          <div className="w-full glass-card p-6 sm:p-10">
            
            {/* Step Header Indicator */}
            <div className="mb-6 flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {mode === "login" && "Step 1: Sign In"}
                {mode === "register" && "Step 1: Create Account"}
                {mode === "shop_setup" && "Step 2: Shop Profile"}
                {mode === "camera_setup" && "Step 3: Camera Setup"}
              </div>

              <div className="flex gap-1.5">
                <div className={`h-2 w-8 rounded-full ${mode === "login" || mode === "register" ? "bg-brand" : "bg-brand/40"}`} />
                <div className={`h-2 w-8 rounded-full ${mode === "shop_setup" ? "bg-brand" : mode === "camera_setup" ? "bg-brand/40" : "bg-border"}`} />
                <div className={`h-2 w-8 rounded-full ${mode === "camera_setup" ? "bg-brand" : "bg-border"}`} />
              </div>
            </div>

            {/* --- MODE 1: LOGIN --- */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-5 animate-pop-in">
                <div>
                  <h2 className="text-2xl font-extrabold">Shopkeeper Login</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your registered shop credentials to access your dashboard.
                  </p>
                </div>

                <Field label="Username">
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin"
                      className={`${inputCls} pl-10`}
                      required
                    />
                  </div>
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputCls} pl-10`}
                      required
                    />
                  </div>
                </Field>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                </button>

                <div className="pt-2 text-center text-sm">
                  <span className="text-muted-foreground">Don&apos;t have a shop account yet? </span>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="font-bold text-brand hover:underline"
                  >
                    Register New Shopkeeper Account
                  </button>
                </div>
              </form>
            )}

            {/* --- MODE 2: REGISTER --- */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4 animate-pop-in">
                <div>
                  <h2 className="text-2xl font-extrabold">Register Account</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a new shopkeeper account to get started.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Username">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. ramesh_hardware"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Full Name">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Password">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Confirm Password">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone Number">
                    <input
                      type="tel"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Email Address">
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Shopkeeper Category">
                  <select
                    value={shopkeeperType}
                    onChange={(e) => setShopkeeperType(e.target.value)}
                    className={inputCls}
                  >
                    {SHOP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create Account & Continue <ArrowRight className="h-4 w-4" /></>}
                </button>

                <div className="pt-2 text-center text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-bold text-brand hover:underline"
                  >
                    Sign In Here
                  </button>
                </div>
              </form>
            )}

            {/* --- MODE 3: SHOP SETUP --- */}
            {mode === "shop_setup" && (
              <form onSubmit={handleShopSetup} className="space-y-4 animate-pop-in">
                <div>
                  <h2 className="text-2xl font-extrabold">Shop Details & Profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set up your store details. This will customize your ShopGuardian monitoring dashboard.
                  </p>
                </div>

                <Field label="Shop Name (Required)">
                  <div className="relative">
                    <Store className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Sri Balaji Supermarket"
                      className={`${inputCls} pl-10`}
                      required
                    />
                  </div>
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Shop Category">
                    <select
                      value={shopType}
                      onChange={(e) => setShopType(e.target.value)}
                      className={inputCls}
                    >
                      {SHOP_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Owner / Manager Name">
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Store Address">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Door No, Street Name, Landmark"
                    className={inputCls}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="City">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Hyderabad"
                      className={inputCls}
                    />
                  </Field>

                  <Field label="State">
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Telangana"
                      className={inputCls}
                    />
                  </Field>

                  <Field label="PIN Code">
                    <input
                      type="text"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="e.g. 500001"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Save Shop & Continue to Camera Setup <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}

            {/* --- MODE 4: CAMERA SETUP & TEST --- */}
            {mode === "camera_setup" && (
              <div className="space-y-6 animate-pop-in">
                <div>
                  <h2 className="text-2xl font-extrabold">Camera Configuration</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure Camera 1 (Entry) and Camera 2 (Inside Store). Test the connection before saving.
                  </p>
                </div>

                {/* Camera 1 Card */}
                <div className="rounded-2xl border-2 border-brand/20 bg-brand-soft/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white font-bold text-sm">
                        1
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base">Camera 1 — Entry Zone</h3>
                        <p className="text-xs text-muted-foreground">Monitors customer entrance & entry count</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCam1({ ...cam1, mode: "demo" })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          cam1.mode === "demo" ? "bg-brand text-white shadow-sm" : "bg-white text-muted-foreground"
                        }`}
                      >
                        Demo Video Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setCam1({ ...cam1, mode: "live" })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          cam1.mode === "live" ? "bg-brand text-white shadow-sm" : "bg-white text-muted-foreground"
                        }`}
                      >
                        Live RTSP Camera
                      </button>
                    </div>
                  </div>

                  {cam1.mode === "live" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Camera IP Address">
                        <input
                          type="text"
                          value={cam1.ip_address || ""}
                          onChange={(e) => setCam1({ ...cam1, ip_address: e.target.value })}
                          placeholder="e.g. 192.168.1.3"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Port">
                        <input
                          type="number"
                          value={cam1.port || 554}
                          onChange={(e) => setCam1({ ...cam1, port: Number(e.target.value) })}
                          placeholder="554"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="RTSP Username">
                        <input
                          type="text"
                          value={cam1.username || ""}
                          onChange={(e) => setCam1({ ...cam1, username: e.target.value })}
                          placeholder="admin"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="RTSP Password">
                        <input
                          type="password"
                          value={cam1.password || ""}
                          onChange={(e) => setCam1({ ...cam1, password: e.target.value })}
                          placeholder="••••••••"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Channel">
                        <input
                          type="text"
                          value={cam1.channel || "1"}
                          onChange={(e) => setCam1({ ...cam1, channel: e.target.value })}
                          placeholder="1"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Subtype (0=Main, 1=Sub)">
                        <input
                          type="text"
                          value={cam1.subtype || "0"}
                          onChange={(e) => setCam1({ ...cam1, subtype: e.target.value })}
                          placeholder="0"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/70 p-3 text-xs text-muted-foreground">
                      <Sparkles className="inline h-3.5 w-3.5 text-brand mr-1" />
                      Demo Mode: Will use sample entrance video feed (<code className="font-mono">DemoVideos/camera1.mp4</code>). No physical RTSP camera required.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => handleTestConnection(1)}
                      disabled={testingCam1}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-brand border border-brand/30 shadow-sm hover:bg-brand-soft transition disabled:opacity-50"
                    >
                      {testingCam1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                      Test Camera 1 Connection
                    </button>

                    {cam1TestResult && (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${cam1TestResult.success ? "text-success" : "text-danger"}`}>
                        {cam1TestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span>{cam1TestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera 2 Card */}
                <div className="rounded-2xl border-2 border-purple/20 bg-purple-soft/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple text-white font-bold text-sm">
                        2
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base">Camera 2 — Inside Store Zone</h3>
                        <p className="text-xs text-muted-foreground">Monitors inside store occupancy & activity</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCam2({ ...cam2, mode: "demo" })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          cam2.mode === "demo" ? "bg-purple text-white shadow-sm" : "bg-white text-muted-foreground"
                        }`}
                      >
                        Demo Video Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setCam2({ ...cam2, mode: "live" })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          cam2.mode === "live" ? "bg-purple text-white shadow-sm" : "bg-white text-muted-foreground"
                        }`}
                      >
                        Live RTSP Camera
                      </button>
                    </div>
                  </div>

                  {cam2.mode === "live" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Camera IP Address">
                        <input
                          type="text"
                          value={cam2.ip_address || ""}
                          onChange={(e) => setCam2({ ...cam2, ip_address: e.target.value })}
                          placeholder="e.g. 192.168.1.4"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Port">
                        <input
                          type="number"
                          value={cam2.port || 554}
                          onChange={(e) => setCam2({ ...cam2, port: Number(e.target.value) })}
                          placeholder="554"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="RTSP Username">
                        <input
                          type="text"
                          value={cam2.username || ""}
                          onChange={(e) => setCam2({ ...cam2, username: e.target.value })}
                          placeholder="admin"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="RTSP Password">
                        <input
                          type="password"
                          value={cam2.password || ""}
                          onChange={(e) => setCam2({ ...cam2, password: e.target.value })}
                          placeholder="••••••••"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Channel">
                        <input
                          type="text"
                          value={cam2.channel || "2"}
                          onChange={(e) => setCam2({ ...cam2, channel: e.target.value })}
                          placeholder="2"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Subtype (0=Main, 1=Sub)">
                        <input
                          type="text"
                          value={cam2.subtype || "0"}
                          onChange={(e) => setCam2({ ...cam2, subtype: e.target.value })}
                          placeholder="0"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/70 p-3 text-xs text-muted-foreground">
                      <Sparkles className="inline h-3.5 w-3.5 text-purple mr-1" />
                      Demo Mode: Will use sample store video feed (<code className="font-mono">DemoVideos/camera2.mp4</code>). No physical RTSP camera required.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => handleTestConnection(2)}
                      disabled={testingCam2}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-purple border border-purple/30 shadow-sm hover:bg-purple-soft transition disabled:opacity-50"
                    >
                      {testingCam2 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                      Test Camera 2 Connection
                    </button>

                    {cam2TestResult && (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${cam2TestResult.success ? "text-success" : "text-danger"}`}>
                        {cam2TestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span>{cam2TestResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avatar Mascot Selection */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Choose Your ShopGuardian Avatar
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {mascotOptions.map((opt) => {
                      const selected = avatar === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setAvatar(opt.key)}
                          className={`relative flex flex-col items-center rounded-2xl border-2 p-3 text-center transition ${
                            selected ? "border-brand bg-brand-soft" : "border-border hover:border-brand/40"
                          }`}
                        >
                          {selected && (
                            <div className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          <Mascot avatar={opt.key} size={80} />
                          <div className="mt-1 text-xs font-bold">{opt.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Final Submit Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMode("shop_setup")}
                    className="flex-1 rounded-2xl border-2 border-border bg-background py-3.5 text-sm font-bold hover:bg-secondary transition"
                  >
                    Back to Shop Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishOnboarding}
                    disabled={isSubmitting}
                    className="flex-[2] rounded-2xl bg-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Complete Setup & Launch Dashboard <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FeatureChip({ icon, label, wrap }: { icon: React.ReactNode; label: string; wrap: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 sm:p-4 backdrop-blur">
      <div className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl ${wrap}`}>{icon}</div>
      <div className="mt-2 sm:mt-3 text-xs sm:text-sm font-semibold">{label}</div>
    </div>
  );
}
