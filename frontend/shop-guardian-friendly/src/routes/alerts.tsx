import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  UserPlus,
  Store,
  WifiOff,
  Play,
  Square,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Camera,
  Clock,
  Filter,
  Eye,
  X,
  CheckSquare,
  Info,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import {
  getAlerts,
  deleteAlert,
  resolveAlert,
  clearAlerts,
  type AlertRecord,
} from "@/lib/api";
import { toast } from "sonner";
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

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Security & System Alerts · ShopGuardian AI" },
      { name: "description", content: "Review and manage real-time security alerts, entrance notifications, and camera events." },
      { property: "og:title", content: "ShopGuardian AI · Alerts" },
      { property: "og:description", content: "Review and manage real-time security alerts, entrance notifications, and camera events." },
    ],
  }),
  component: AlertHistory,
});

type SeverityFilter = "all" | "critical" | "warning" | "info";
type StatusFilter = "all" | "active" | "resolved";

interface EnrichedAlert extends AlertRecord {
  resolved?: boolean;
}

function AlertHistory() {
  const [q, setQ] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [cameraFilter, setCameraFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [alerts, setAlerts] = useState<EnrichedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & Details & Delete state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<EnrichedAlert | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadAlertsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (err: any) {
      console.error("Failed to load alerts:", err);
      setError("Unable to load alerts from backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlertsData();
  }, []);

  // Filtered alerts
  const filtered = useMemo(() => {
    return alerts
      .filter((a) => {
        // Query search
        const haystack = `${a.title} ${a.message} ${a.alert_type}`.toLowerCase();
        if (q.trim() && !haystack.includes(q.trim().toLowerCase())) {
          return false;
        }

        // Severity filter heuristic
        if (severityFilter !== "all") {
          const type = a.alert_type?.toLowerCase() || "";
          if (severityFilter === "critical" && !type.includes("danger") && !type.includes("critical") && !type.includes("offline")) return false;
          if (severityFilter === "warning" && !type.includes("warning") && !type.includes("empty")) return false;
          if (severityFilter === "info" && (type.includes("danger") || type.includes("offline") || type.includes("warning"))) return false;
        }

        // Camera filter
        if (cameraFilter !== "all" && String(a.camera_number) !== cameraFilter) {
          return false;
        }

        // Status filter
        if (statusFilter === "active" && a.resolved) return false;
        if (statusFilter === "resolved" && !a.resolved) return false;

        return true;
      })
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [alerts, q, severityFilter, cameraFilter, statusFilter]);

  // Paginated slice
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedAlerts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Metric counts
  const criticalCount = useMemo(() => {
    return alerts.filter((a) => {
      const t = a.alert_type?.toLowerCase() || "";
      return t.includes("danger") || t.includes("offline") || t.includes("critical");
    }).length;
  }, [alerts]);

  const resolvedCount = useMemo(() => {
    return alerts.filter((a) => a.resolved).length;
  }, [alerts]);

  // Resolve Alert Handler
  const handleToggleResolve = async (id: number) => {
    try {
      await resolveAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: !a.resolved } : a))
      );
      toast.success("Alert status updated.");
      if (selectedAlert?.id === id) {
        setSelectedAlert((curr) => curr ? { ...curr, resolved: !curr.resolved } : null);
      }
    } catch {
      // Optimistic toggle
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: !a.resolved } : a))
      );
      toast.success("Alert marked as resolved.");
    }
  };

  // Delete Individual Alert
  const confirmDeleteIndividual = async () => {
    if (deleteId === null) return;
    setIsDeleting(true);
    try {
      await deleteAlert(deleteId);
      setAlerts((prev) => prev.filter((a) => a.id !== deleteId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      toast.success("Alert record deleted.");
      if (selectedAlert?.id === deleteId) {
        setSelectedAlert(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete alert.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  // Bulk Delete
  const confirmBulkDelete = async () => {
    if (selected.size === 0) return;
    setIsDeleting(true);
    try {
      for (const id of Array.from(selected)) {
        await deleteAlert(id);
      }
      setAlerts((prev) => prev.filter((a) => !selected.has(a.id)));
      setSelected(new Set());
      toast.success(`Deleted ${selected.size} alert logs.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete selected alerts.");
    } finally {
      setIsDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  // Clear All Alerts
  const confirmClearAll = async () => {
    setIsDeleting(true);
    try {
      await clearAlerts();
      setAlerts([]);
      setSelected(new Set());
      toast.success("All alert history cleared.");
    } catch (err: any) {
      toast.error(err.message || "Failed to clear alert history.");
    } finally {
      setIsDeleting(false);
      setClearAllDialogOpen(false);
    }
  };

  const getAlertStyle = (type: string = "") => {
    const t = type.toLowerCase();
    if (t.includes("offline") || t.includes("danger") || t.includes("critical")) {
      return {
        badge: "bg-danger-soft text-danger",
        icon: <ShieldAlert className="h-5 w-5 text-danger" />,
        border: "border-danger/30",
        label: "Critical",
      };
    }
    if (t.includes("warning") || t.includes("empty")) {
      return {
        badge: "bg-warning-soft text-warning",
        icon: <AlertTriangle className="h-5 w-5 text-warning" />,
        border: "border-warning/30",
        label: "Warning",
      };
    }
    return {
      badge: "bg-brand-soft text-brand",
      icon: <Bell className="h-5 w-5 text-brand" />,
      border: "border-brand/20",
      label: "Information",
    };
  };

  return (
    <ShopLayout>
      {/* Header & Metric Summary */}
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Security & Monitoring Alerts</h2>
            <p className="text-sm text-muted-foreground">
              Audit log of intrusion events, camera status warnings, and shop monitoring notifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAlertsData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold transition hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {selected.size > 0 && (
              <button
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2.5 text-xs font-bold text-danger transition hover:bg-danger hover:text-white"
              >
                <Trash2 className="h-4 w-4" /> Delete Selected ({selected.size})
              </button>
            )}
            {alerts.length > 0 && (
              <button
                onClick={() => setClearAllDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-danger/30 px-3.5 py-2.5 text-xs font-bold text-danger transition hover:bg-danger-soft"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-brand-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand">Total Logged</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{alerts.length}</div>
            <div className="text-xs text-muted-foreground">System alerts recorded</div>
          </div>
          <div className="rounded-2xl bg-danger-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-danger">Critical Alerts</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Camera / security events</div>
          </div>
          <div className="rounded-2xl bg-success-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-success">Resolved</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{resolvedCount}</div>
            <div className="text-xs text-muted-foreground">Acknowledged by admin</div>
          </div>
          <div className="rounded-2xl bg-secondary/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Results</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{filtered.length}</div>
            <div className="text-xs text-muted-foreground">Matching filter rules</div>
          </div>
        </div>
      </section>

      {/* Toolbar / Search / Filter Bar */}
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search bar */}
          <div className="flex flex-1 min-w-[240px] items-center gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-2.5 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search alert title or message..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity filter */}
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value as SeverityFilter);
                setPage(1);
              }}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="all">⚡ All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warnings Only</option>
              <option value="info">Informational</option>
            </select>

            {/* Camera filter */}
            <select
              value={cameraFilter}
              onChange={(e) => {
                setCameraFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="all">📷 All Cameras</option>
              <option value="1">Camera 1 (Entrance)</option>
              <option value="2">Camera 2 (Inside Shop)</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="all">📋 All Statuses</option>
              <option value="active">Active Only</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </section>

      {/* Alert List / Grid */}
      <section className="glass-card p-6">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mb-3" />
            <h3 className="text-lg font-bold text-foreground">Could not load alert history</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
            <button
              onClick={loadAlertsData}
              className="mt-4 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-brand/90"
            >
              Retry Loading
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-success-soft text-success mb-4">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No security alerts recorded</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {q || severityFilter !== "all" || cameraFilter !== "all" || statusFilter !== "all"
                ? "No alerts match your active filter settings."
                : "Your shop is completely secure. No abnormal motion or camera disconnections have been detected."}
            </p>
          </div>
        ) : (
          <div>
            <div className="grid gap-3.5 md:grid-cols-2">
              {paginatedAlerts.map((a) => {
                const style = getAlertStyle(a.alert_type);
                const isSelected = selected.has(a.id);
                const formattedTime = a.created_at ? new Date(a.created_at).toLocaleString() : "Just now";

                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAlert(a)}
                    className={`flex flex-col justify-between gap-3 rounded-2xl border p-4.5 transition cursor-pointer hover:shadow-md ${
                      a.resolved ? "opacity-70 bg-secondary/30" : "bg-card"
                    } ${isSelected ? "border-brand ring-2 ring-brand/30" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${style.badge}`}>
                        {style.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-extrabold text-foreground">{a.title}</span>
                          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{formattedTime}</span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.message}</p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className={`pill ${style.badge} text-[10px]`}>
                            {style.label}
                          </span>

                          {a.camera_number && (
                            <span className="pill bg-secondary text-foreground text-[10px]">
                              <Camera className="h-3 w-3" /> Camera {a.camera_number}
                            </span>
                          )}

                          {a.resolved && (
                            <span className="pill bg-success-soft text-success text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/80" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleResolve(a.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                          a.resolved ? "bg-secondary text-muted-foreground hover:bg-success-soft hover:text-success" : "bg-success-soft text-success hover:bg-success hover:text-white"
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {a.resolved ? "Mark Unresolved" : "Mark Resolved"}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedAlert(a)}
                          className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-bold text-foreground hover:bg-brand-soft hover:text-brand"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="grid h-7 w-7 place-items-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          title="Delete alert"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <div className="text-xs font-semibold text-muted-foreground">
                Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–
                <span className="text-foreground">{Math.min(page * pageSize, filtered.length)}</span> of{" "}
                <span className="text-foreground">{filtered.length}</span> alerts
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background text-sm font-bold transition hover:bg-secondary disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`h-9 w-9 rounded-xl text-xs font-bold transition ${
                      page === i + 1
                        ? "bg-brand text-white shadow-sm"
                        : "border border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background text-sm font-bold transition hover:bg-secondary disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm animate-fade-up"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                {getAlertStyle(selectedAlert.alert_type).icon}
                <div>
                  <h3 className="text-base font-extrabold text-foreground">{selectedAlert.title}</h3>
                  <p className="text-xs text-muted-foreground">Alert Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-danger-soft hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-3.5 text-sm">
              <div className="rounded-2xl bg-secondary/60 p-3.5">
                <div className="text-[11px] font-bold text-muted-foreground">DESCRIPTION</div>
                <div className="mt-1 font-semibold text-foreground">{selectedAlert.message}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary/60 p-3">
                  <div className="text-[11px] font-bold text-muted-foreground">CAMERA SOURCE</div>
                  <div className="mt-0.5 font-bold text-foreground">Camera {selectedAlert.camera_number ?? "1"}</div>
                </div>
                <div className="rounded-2xl bg-secondary/60 p-3">
                  <div className="text-[11px] font-bold text-muted-foreground">TIMESTAMP</div>
                  <div className="mt-0.5 font-bold text-foreground">
                    {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString() : "Just now"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                onClick={() => {
                  handleToggleResolve(selectedAlert.id);
                }}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
                  selectedAlert.resolved ? "bg-secondary text-muted-foreground" : "bg-success-soft text-success hover:bg-success hover:text-white"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {selectedAlert.resolved ? "Mark as Active" : "Mark as Resolved"}
              </button>

              <button
                onClick={() => {
                  setDeleteId(selectedAlert.id);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger hover:text-white transition"
              >
                <Trash2 className="h-4 w-4" /> Delete Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alert log?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this alert notification? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteIndividual}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} selected alerts?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selected.size} selected alert records?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isDeleting ? "Deleting..." : `Delete ${selected.size} Alerts`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Alerts Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear entire alert log history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all security and system alert records from your database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAll}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isDeleting ? "Clearing..." : "Yes, Clear All Alerts"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShopLayout>
  );
}