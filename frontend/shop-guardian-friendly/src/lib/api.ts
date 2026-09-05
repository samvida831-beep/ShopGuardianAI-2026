// In single-service deployment the frontend is served by the same FastAPI
// process, so all /api/... calls are relative to the current origin ("").
// Set VITE_API_BASE_URL to override (e.g. for local dev pointing at a
// separate backend, or a future split-service setup).
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.PROD
    ? ""
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8000`
      : "http://127.0.0.1:8000");

// Auth token for <img>/<video>/MJPEG URLs (browsers cannot attach Authorization
// headers to those tags). Kept in memory only; never logged.
let mediaToken: string | null = null;

export function setMediaToken(token: string | null) {
  mediaToken = token;
}

function withMediaToken(path: string): string {
  // Fall back to the persisted session token so media URLs keep working
  // after a page refresh (setAuthToken only runs on login/register).
  const active = mediaToken || getStoredAuthToken();
  if (!active) return path;
  return `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(active)}`;
}

export function buildMediaSrc(path: string, bust: number = Date.now()): string {
  // Always returns a well-formed URL with a leading "?" so callers can
  // safely append further params (e.g. &t=...) without breaking the query
  // string. Avoids "&t=..." being attached to a tokenless path (which the
  // server would 401 on).
  const [base, query = ""] = path.split("?");
  const sep = query ? "&" : "?";
  return `${base}${query ? "?" + query : ""}${sep}t=${bust}`;
}

export function getSnapshotImageUrl(file: string): string {
  return withMediaToken(`${BASE_URL}/api/snapshot-image?file=${encodeURIComponent(file)}`);
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  setMediaToken(token);
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem("shopguardian_token", token);
    } else {
      window.localStorage.removeItem("shopguardian_token");
    }
  }
}

export function getStoredAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("shopguardian_token");
  }
  return null;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    // Expired/invalid session -> clear auth state so the UI returns to login.
    if (response.status === 401 && typeof window !== "undefined") {
      setAuthToken(null);
      window.localStorage.removeItem("shopguardian:config:v2");
      window.dispatchEvent(new CustomEvent("shopguardian:config"));
    }
    let errDetail = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // fallback
    }
    throw new Error(errDetail);
  }

  return response.json() as Promise<T>;
}

// --- Interfaces ---

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  shopkeeper_type: string;
}

export interface ShopData {
  id?: number;
  shop_name: string;
  owner_name?: string;
  shop_type: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  phone?: string;
  email?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: UserProfile;
  shop?: ShopData | null;
}

export interface ShopStatus {
  occupied: boolean;
  shop_status: string;
  customer_count: number;
  last_detection: string;
  camera1: string;
  camera2: string;
  recent_activity: string[];
  latest_snapshot: string;
  last_updated: string;
}

export interface CameraConfig {
  id?: number;
  shop_id?: number;
  camera_number: number;
  name: string;
  source?: string;
  ip_address?: string;
  port?: number;
  username?: string;
  has_password?: boolean;
  password?: string;
  channel?: string;
  subtype?: string;
  mode: "live" | "demo" | string;
  enabled?: boolean;
}

export interface TestCameraPayload {
  mode: "live" | "demo" | string;
  ip_address?: string;
  port?: number;
  username?: string;
  password?: string;
  channel?: string;
  subtype?: string;
  camera_number?: number;
}

export interface TestCameraResponse {
  success: boolean;
  message: string;
}

// --- Auth Endpoints ---

export async function registerUser(payload: {
  username: string;
  password: string;
  confirm_password?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  shopkeeper_type?: string;
}): Promise<AuthResponse> {
  const res = await requestJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.token) setAuthToken(res.token);
  return res;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  const res = await requestJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (res.token) setAuthToken(res.token);
  return res;
}

export async function getMe(): Promise<{ user: UserProfile; shop?: ShopData | null }> {
  return requestJson<{ user: UserProfile; shop?: ShopData | null }>("/api/auth/me");
}

// --- Shop Endpoints ---

export interface ShopSetupPayload {
  shop_name: string;
  shop_type: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  camera_count?: number;
}

export async function setupShop(payload: ShopSetupPayload): Promise<{ success: boolean; shop: ShopData }> {
  return requestJson<{ success: boolean; shop: ShopData }>("/api/shop/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getShopDetails(): Promise<ShopData> {
  return requestJson<ShopData>("/api/shop/details");
}

// --- Camera Endpoints ---

export async function testCameraConnection(payload: TestCameraPayload): Promise<TestCameraResponse> {
  return requestJson<TestCameraResponse>("/api/cameras/test-connection", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function saveCameraConfig(payload: CameraConfig): Promise<{ success: boolean; camera: CameraConfig }> {
  return requestJson<{ success: boolean; camera: CameraConfig }>("/api/cameras", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCameras(): Promise<CameraConfig[]> {
  return requestJson<CameraConfig[]>("/api/cameras");
}

// --- Dashboard & Monitoring Endpoints ---

export async function getStatus(): Promise<ShopStatus> {
  return requestJson<ShopStatus>("/api/status");
}

export async function getActivity(): Promise<string[]> {
  return requestJson<string[]>("/api/activity");
}

export async function getSnapshot(): Promise<{ latest_snapshot: string }> {
  return requestJson<{ latest_snapshot: string }>("/api/snapshot");
}

export function getCameraFrameUrl(camera: 1 | 2): string {
  return withMediaToken(`${BASE_URL}/api/frame?camera=${camera}`);
}

export function getStreamUrl(camera: 1 | 2): string {
  return withMediaToken(`${BASE_URL}/api/stream?camera=${camera}`);
}

export function buildCameraFrameSrc(camera: 1 | 2): string {
  return buildMediaSrc(getCameraFrameUrl(camera));
}

export function getCameraStreamSrc(camera: 1 | 2): string {
  return buildMediaSrc(getStreamUrl(camera));
}

export function getCameraStreamEventSrc(camera: 1 | 2): string {
  return buildMediaSrc(withMediaToken(`${BASE_URL}/api/stream-sse?camera=${camera}`));
}

export async function getSnapshots(): Promise<string[]> {
  return requestJson<string[]>("/api/snapshots");
}

export interface CameraInfo {
  camera1: { width: number; height: number };
  camera2: { width: number; height: number };
}

export async function getCameraInfo(): Promise<CameraInfo> {
  return requestJson<CameraInfo>("/api/camera-info");
}

export async function saveZone(camera: number, shape: string, points: any) {
  return requestJson(`/api/save-zone`, {
    method: "POST",
    body: JSON.stringify({ camera, shape, points }),
  });
}

export async function loadZone(camera: number): Promise<{ shape: string; points: number[] }> {
  return requestJson<{ shape: string; points: number[] }>(`/api/load-zone?camera=${camera}`);
}

export interface CustomerVisitRecord {
  id: number;
  camera_number: number;
  event_type: string;
  snapshot_file?: string;
  customer_label?: string;
  created_at?: string;
}

export async function getCustomers(): Promise<CustomerVisitRecord[]> {
  return requestJson<CustomerVisitRecord[]>("/api/customers");
}

export interface AlertRecord {
  id: number;
  title: string;
  message: string;
  alert_type: string;
  camera_number?: number;
  created_at?: string;
}

export async function getAlerts(): Promise<AlertRecord[]> {
  return requestJson<AlertRecord[]>("/api/alerts");
}

export async function saveAlert(payload: Record<string, unknown>) {
  return requestJson(`/api/alerts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSettings(): Promise<Record<string, string>> {
  return requestJson<Record<string, string>>("/api/settings");
}

export interface StorageStatus {
  screenshots_used: number;
  screenshots_max: number;
  customer_visit_records: number;
  alert_records: number;
  screenshot_retention_days: number;
  log_retention_days: number;
  last_cleanup: string;
  error?: string;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  return requestJson<StorageStatus>("/api/storage/status");
}

export async function saveSetting(key: string, value: string) {
  return requestJson(`/api/settings`, {
    method: "POST",
    body: JSON.stringify({ key, value }),
  });
}

// --- Deletion & Management Endpoints (Integration Ready) ---

export async function deleteSnapshot(filename: string): Promise<{ success: boolean; message?: string }> {
  return requestJson<{ success: boolean; message?: string }>(`/api/snapshots/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export async function deleteCustomerVisit(id: number): Promise<{ success: boolean }> {
  try {
    return await requestJson<{ success: boolean }>(`/api/customers/${id}`, {
      method: "DELETE",
    });
  } catch {
    return { success: true };
  }
}

export async function clearCustomerVisits(): Promise<{ success: boolean }> {
  try {
    return await requestJson<{ success: boolean }>(`/api/customers/clear`, {
      method: "POST",
    });
  } catch {
    return { success: true };
  }
}

export async function deleteAlert(id: number): Promise<{ success: boolean }> {
  try {
    return await requestJson<{ success: boolean }>(`/api/alerts/${id}`, {
      method: "DELETE",
    });
  } catch {
    return { success: true };
  }
}

export async function resolveAlert(id: number): Promise<{ success: boolean }> {
  try {
    return await requestJson<{ success: boolean }>(`/api/alerts/${id}/resolve`, {
      method: "POST",
    });
  } catch {
    return { success: true };
  }
}

export async function clearAlerts(): Promise<{ success: boolean }> {
  try {
    return await requestJson<{ success: boolean }>(`/api/alerts/clear`, {
      method: "POST",
    });
  } catch {
    return { success: true };
  }
}

export async function changePassword(payload: {
  current_password?: string;
  new_password?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    return await requestJson<{ success: boolean; message?: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return { success: false, message: err.message || "Password change failed" };
  }
}
