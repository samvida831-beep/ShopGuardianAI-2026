import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  Calendar,
  Trash2,
  RefreshCw,
  Camera,
  Eye,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  Shield,
} from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import {
  getCustomers,
  getSnapshotImageUrl,
  deleteCustomerVisit,
  clearCustomerVisits,
  type CustomerVisitRecord,
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

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customer Activity History · ShopGuardian AI" },
      { name: "description", content: "Detailed timeline of detected customer entry events and footfall activity." },
      { property: "og:title", content: "ShopGuardian AI · Customer Activity History" },
      { property: "og:description", content: "Detailed timeline of detected customer entry events and footfall activity." },
    ],
  }),
  component: CustomerHistory,
});

type DateFilter = "all" | "today" | "week" | "month";
type CameraFilter = "all" | "1" | "2";

function CustomerHistory() {
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [records, setRecords] = useState<CustomerVisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & Details & Delete state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedRecord, setSelectedRecord] = useState<CustomerVisitRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers();
      setRecords(data);
    } catch (err: any) {
      console.error("Failed to load customer history:", err);
      setError("Unable to load customer history records from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = now.getTime() - 7 * 24 * 3600 * 1000;
    const monthStart = now.getTime() - 30 * 24 * 3600 * 1000;

    return records
      .filter((c) => {
        // Query search
        const haystack = `${c.customer_label ?? ""} ${c.event_type ?? ""} Camera ${c.camera_number}`.toLowerCase();
        if (q.trim() && !haystack.includes(q.trim().toLowerCase())) {
          return false;
        }

        // Camera filter
        if (cameraFilter !== "all" && String(c.camera_number) !== cameraFilter) {
          return false;
        }

        // Date filter
        if (c.created_at) {
          const recTime = new Date(c.created_at).getTime();
          if (dateFilter === "today" && recTime < todayStart) return false;
          if (dateFilter === "week" && recTime < weekStart) return false;
          if (dateFilter === "month" && recTime < monthStart) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return sortOrder === "oldest" ? timeA - timeB : timeB - timeA;
      });
  }, [records, q, dateFilter, cameraFilter, sortOrder]);

  // Paginated list
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Summary Metrics
  const todayEntries = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    return records.filter((r) => r.created_at && new Date(r.created_at).getTime() >= todayStart).length;
  }, [records]);

  const weekEntries = useMemo(() => {
    const weekStart = Date.now() - 7 * 24 * 3600 * 1000;
    return records.filter((r) => r.created_at && new Date(r.created_at).getTime() >= weekStart).length;
  }, [records]);

  // Selection handlers
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginatedRecords.length && paginatedRecords.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginatedRecords.map((r) => r.id)));
    }
  };

  // Delete Individual Record
  const confirmDeleteIndividual = async () => {
    if (deleteId === null) return;
    setIsDeleting(true);
    try {
      await deleteCustomerVisit(deleteId);
      setRecords((prev) => prev.filter((r) => r.id !== deleteId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      toast.success("Customer record deleted.");
      if (selectedRecord?.id === deleteId) {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete record.");
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
        await deleteCustomerVisit(id);
      }
      setRecords((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
      toast.success(`Deleted ${selected.size} customer event records.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete selected records.");
    } finally {
      setIsDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  // Clear All
  const confirmClearAll = async () => {
    setIsDeleting(true);
    try {
      await clearCustomerVisits();
      setRecords([]);
      setSelected(new Set());
      toast.success("All customer activity history cleared.");
    } catch (err: any) {
      toast.error(err.message || "Failed to clear history.");
    } finally {
      setIsDeleting(false);
      setClearAllDialogOpen(false);
    }
  };

  return (
    <ShopLayout>
      {/* Header & Stats */}
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Customer Footfall & Entry History</h2>
            <p className="text-sm text-muted-foreground">
              Real-time audit log of customer entry detections, foot-point events, and camera source data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
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
            {records.length > 0 && (
              <button
                onClick={() => setClearAllDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-danger/30 px-3.5 py-2.5 text-xs font-bold text-danger transition hover:bg-danger-soft"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Privacy / AI Disclaimer Banner */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft/70 p-3.5 text-xs text-foreground">
          <Info className="h-4 w-4 text-brand shrink-0" />
          <span>
            <strong>AI Footfall Note:</strong> ShopGuardian AI records customer entry timestamps and visit counts using Computer Vision detection zones. Personal identities or biometric signatures are never stored.
          </span>
        </div>

        {/* Summary Metrics Row */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-brand-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand">Today's Visits</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{todayEntries}</div>
            <div className="text-xs text-muted-foreground">Recorded since midnight</div>
          </div>
          <div className="rounded-2xl bg-success-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-success">This Week</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{weekEntries}</div>
            <div className="text-xs text-muted-foreground">Past 7 days footfall</div>
          </div>
          <div className="rounded-2xl bg-purple-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple">Total Event Log</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{records.length}</div>
            <div className="text-xs text-muted-foreground">Lifetime visit records</div>
          </div>
          <div className="rounded-2xl bg-secondary/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filtered Records</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{filtered.length}</div>
            <div className="text-xs text-muted-foreground">Matching search criteria</div>
          </div>
        </div>
      </section>

      {/* Toolbar / Search / Filters */}
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex flex-1 min-w-[240px] items-center gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-2.5 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by visit label, event type, or camera..."
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
            {/* Date filter */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilter);
                setPage(1);
              }}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="all">📅 All Time</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>

            {/* Camera filter */}
            <select
              value={cameraFilter}
              onChange={(e) => {
                setCameraFilter(e.target.value as CameraFilter);
                setPage(1);
              }}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="all">📷 All Cameras</option>
              <option value="1">Camera 1 (Entrance)</option>
              <option value="2">Camera 2 (Inside Shop)</option>
            </select>

            {/* Sort order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="newest">⬇️ Newest First</option>
              <option value="oldest">⬆️ Oldest First</option>
            </select>

            {/* Select page toggle */}
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary"
            >
              {selected.size === paginatedRecords.length && paginatedRecords.length > 0 ? (
                <>
                  <CheckSquare className="h-4 w-4 text-brand" /> Deselect Page
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 text-muted-foreground" /> Select Page
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Main Table / Mobile Cards */}
      <section className="glass-card p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mb-3" />
            <h3 className="text-lg font-bold text-foreground">Could not load customer history</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-brand/90"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand mb-4">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No customer records found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {q || dateFilter !== "all" || cameraFilter !== "all"
                ? "No entries match your search or active filter settings."
                : "No customer visits have been recorded yet today. When someone steps into an entry zone, they will be logged here."}
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 px-4 py-2"></th>
                    <th className="px-4 py-2">Visit Label / ID</th>
                    <th className="px-4 py-2">Date & Time</th>
                    <th className="px-4 py-2">Camera Source</th>
                    <th className="px-4 py-2">Detection Type</th>
                    <th className="px-4 py-2">Evidence Snapshot</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((c) => {
                    const isSelected = selected.has(c.id);
                    const formattedTime = c.created_at ? new Date(c.created_at).toLocaleString() : "Just now";

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedRecord(c)}
                        className={`cursor-pointer rounded-2xl transition hover:shadow-sm ${
                          isSelected ? "bg-brand-soft/40 border border-brand" : "bg-secondary/60 hover:bg-secondary"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="rounded-l-2xl px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSelect(c.id)}
                            className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-brand"
                          >
                            {isSelected ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
                          </button>
                        </td>

                        {/* Visit Label */}
                        <td className="px-4 py-3 font-extrabold text-foreground">
                          {c.customer_label || `Customer Visit #${c.id}`}
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{formattedTime}</td>

                        {/* Camera */}
                        <td className="px-4 py-3">
                          <span className="pill bg-brand-soft text-brand text-xs font-bold">
                            <Camera className="h-3 w-3" /> Camera {c.camera_number}
                          </span>
                        </td>

                        {/* Event type */}
                        <td className="px-4 py-3">
                          <span className="pill bg-success-soft text-success text-xs font-semibold capitalize">
                            <CheckCircle2 className="h-3 w-3" /> {c.event_type || "Customer Entry"}
                          </span>
                        </td>

                        {/* Snapshot thumbnail */}
                        <td className="px-4 py-2">
                          {c.snapshot_file ? (
                            <img
                              src={getSnapshotImageUrl(c.snapshot_file)}
                              alt="Customer Snapshot"
                              className="h-10 w-16 rounded-xl object-cover border border-border shadow-xs hover:scale-105 transition"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground/70">No snapshot</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="rounded-r-2xl px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedRecord(c)}
                              className="grid h-8 w-8 place-items-center rounded-xl bg-background text-muted-foreground hover:bg-brand-soft hover:text-brand transition"
                              title="View event details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(c.id)}
                              className="grid h-8 w-8 place-items-center rounded-xl bg-background text-muted-foreground hover:bg-danger-soft hover:text-danger transition"
                              title="Delete record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Shown only on small screens) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {paginatedRecords.map((c) => {
                const isSelected = selected.has(c.id);
                const formattedTime = c.created_at ? new Date(c.created_at).toLocaleString() : "Just now";

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedRecord(c)}
                    className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${
                      isSelected ? "border-brand bg-brand-soft/30" : "border-border bg-card shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(c.id);
                          }}
                          className="text-muted-foreground"
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
                        </button>
                        <span className="font-extrabold text-sm text-foreground">
                          {c.customer_label || `Visit #${c.id}`}
                        </span>
                      </div>
                      <span className="pill bg-brand-soft text-brand text-[11px] font-bold">
                        Camera {c.camera_number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formattedTime}</span>
                      </div>
                      <span className="pill bg-success-soft text-success text-[10px] font-bold">
                        {c.event_type || "Entry"}
                      </span>
                    </div>

                    {c.snapshot_file && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                        <img
                          src={getSnapshotImageUrl(c.snapshot_file)}
                          alt="Snapshot"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(c);
                        }}
                        className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-foreground"
                      >
                        View Details
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(c.id);
                        }}
                        className="rounded-xl bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger"
                      >
                        Delete
                      </button>
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
                <span className="text-foreground">{filtered.length}</span> records
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

      {/* Event Details Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm animate-fade-up"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-card p-6 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">
                  {selectedRecord.customer_label || `Customer Visit Record #${selectedRecord.id}`}
                </h3>
                <p className="text-xs text-muted-foreground">Detection Event Summary</p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-danger-soft hover:text-danger"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-secondary/70 p-3">
                  <div className="text-[11px] font-bold text-muted-foreground">CAMERA SOURCE</div>
                  <div className="mt-0.5 font-extrabold text-foreground">Camera {selectedRecord.camera_number} (Entrance)</div>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-3">
                  <div className="text-[11px] font-bold text-muted-foreground">TIMESTAMP</div>
                  <div className="mt-0.5 font-extrabold text-foreground">
                    {selectedRecord.created_at ? new Date(selectedRecord.created_at).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              {selectedRecord.snapshot_file ? (
                <div>
                  <div className="text-xs font-bold text-muted-foreground mb-2">CAPTURED EVIDENCE SNAPSHOT</div>
                  <div className="overflow-hidden rounded-2xl border border-border bg-black">
                    <img
                      src={getSnapshotImageUrl(selectedRecord.snapshot_file)}
                      alt="Event Snapshot"
                      className="max-h-72 w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-secondary/50 p-6 text-center text-xs text-muted-foreground">
                  No snapshot image was attached to this detection record.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="pill bg-success-soft text-success text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Normal Mode Verified
              </span>
              <button
                onClick={() => {
                  setDeleteId(selectedRecord.id);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2 text-xs font-bold text-danger hover:bg-danger hover:text-white transition"
              >
                <Trash2 className="h-4 w-4" /> Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Record Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer visit record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the event log entry #{deleteId}. Note: This removes the footfall log entry; any saved camera snapshot file will remain intact in your gallery.
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
            <AlertDialogTitle>Delete {selected.size} selected customer records?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selected.size} customer activity records? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isDeleting ? "Deleting..." : `Delete ${selected.size} Records`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All History Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear entire customer footfall history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all historical customer visit event records from your database. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAll}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isDeleting ? "Clearing..." : "Yes, Clear All History"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShopLayout>
  );
}