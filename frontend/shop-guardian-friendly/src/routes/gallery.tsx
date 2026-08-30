import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Calendar,
  Download,
  Trash2,
  X,
  RefreshCw,
  Camera,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { getSnapshots, getSnapshotImageUrl, deleteSnapshot } from "@/lib/api";
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

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Snapshots Gallery · ShopGuardian AI" },
      { name: "description", content: "Browse, filter, and manage every snapshot captured by your ShopGuardian AI system." },
      { property: "og:title", content: "ShopGuardian AI · Evidence Gallery" },
      { property: "og:description", content: "Browse, filter, and manage every snapshot captured by your ShopGuardian AI system." },
    ],
  }),
  component: Gallery,
});

type DateFilter = "all" | "today" | "yesterday" | "7days" | "30days";
type CameraFilter = "all" | "1" | "2";
type SortOrder = "newest" | "oldest";

function Gallery() {
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection & Delete state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const loadSnapshotsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSnapshots();
      setSnapshots(data);
    } catch (err: any) {
      console.error("Failed to load snapshots:", err);
      setError("Unable to load snapshots from the server. Please check your backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshotsData();
  }, []);

  // Parse snapshot timestamp helper
  const parseSnapshotDate = (filename: string): Date | null => {
    try {
      const name = filename.replace(/\.(jpg|jpeg|png)$/i, "");
      const [datePart, timePart] = name.split("_");
      if (!datePart || !timePart) return null;
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, min, sec] = timePart.split("-").map(Number);
      return new Date(year, month - 1, day, hour, min, sec);
    } catch {
      return null;
    }
  };

  // Filtered & Sorted list
  const filteredSnapshots = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return snapshots
      .filter((file) => {
        // Query search
        if (q.trim() && !file.toLowerCase().includes(q.trim().toLowerCase())) {
          return false;
        }

        // Camera filter (heuristic from filename or metadata)
        if (cameraFilter !== "all") {
          const isCam2 = file.includes("cam2") || file.includes("camera2");
          if (cameraFilter === "2" && !isCam2) return false;
          if (cameraFilter === "1" && isCam2) return false;
        }

        // Date filter
        const fileDate = parseSnapshotDate(file);
        if (dateFilter === "today") {
          return file.startsWith(todayStr);
        } else if (dateFilter === "yesterday") {
          return file.startsWith(yesterdayStr);
        } else if (dateFilter === "7days" && fileDate) {
          return fileDate >= sevenDaysAgo;
        } else if (dateFilter === "30days" && fileDate) {
          return fileDate >= thirtyDaysAgo;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "oldest") {
          return a.localeCompare(b);
        }
        return b.localeCompare(a); // default newest
      });
  }, [snapshots, q, dateFilter, cameraFilter, sortOrder]);

  // Paginated slice
  const totalPages = Math.ceil(filteredSnapshots.length / pageSize) || 1;
  const paginatedSnapshots = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSnapshots.slice(start, start + pageSize);
  }, [filteredSnapshots, page, pageSize]);

  // Statistics
  const todayCount = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return snapshots.filter((f) => f.startsWith(todayStr)).length;
  }, [snapshots]);

  // Selection handlers
  const toggleSelect = (file: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginatedSnapshots.length && paginatedSnapshots.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginatedSnapshots));
    }
  };

  // Delete Individual Handler
  const confirmDeleteIndividual = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSnapshot(deleteTarget);
      setSnapshots((prev) => prev.filter((f) => f !== deleteTarget));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget);
        return next;
      });
      toast.success("Snapshot deleted successfully.");
      if (previewIndex !== null) {
        setPreviewIndex(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete snapshot.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Bulk Delete Handler
  const confirmBulkDelete = async () => {
    if (selected.size === 0) return;
    setIsDeleting(true);
    try {
      const toDelete = Array.from(selected);
      for (const file of toDelete) {
        await deleteSnapshot(file);
      }
      setSnapshots((prev) => prev.filter((f) => !selected.has(f)));
      setSelected(new Set());
      toast.success(`Deleted ${toDelete.length} snapshots.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete selected snapshots.");
    } finally {
      setIsDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  // Modal navigation
  const handleNextPreview = () => {
    if (previewIndex === null) return;
    if (previewIndex < filteredSnapshots.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  const handlePrevPreview = () => {
    if (previewIndex === null) return;
    if (previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  return (
    <ShopLayout>
      {/* Header & Stats */}
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Evidence & Snapshot Gallery</h2>
            <p className="text-sm text-muted-foreground">
              Automated high-resolution AI entry snapshots and camera evidence history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSnapshotsData}
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
          </div>
        </div>

        {/* Quick Stat Counters */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-brand-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand">Total Evidence</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{snapshots.length}</div>
            <div className="text-xs text-muted-foreground">Stored safely on disk</div>
          </div>
          <div className="rounded-2xl bg-success-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-success">Captured Today</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{todayCount}</div>
            <div className="text-xs text-muted-foreground">Today's customer visits</div>
          </div>
          <div className="rounded-2xl bg-purple-soft/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple">Filtered Results</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{filteredSnapshots.length}</div>
            <div className="text-xs text-muted-foreground">Matching search & filters</div>
          </div>
          <div className="rounded-2xl bg-secondary/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Selected Items</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{selected.size}</div>
            <div className="text-xs text-muted-foreground">Ready for bulk actions</div>
          </div>
        </div>
      </section>

      {/* Filter Toolbar */}
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
              placeholder="Search snapshots by date or filename (YYYY-MM-DD)..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
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
              <option value="all">📅 All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
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
              <option value="2">Camera 2 (Inside)</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground outline-none shadow-sm cursor-pointer hover:bg-secondary"
            >
              <option value="newest">⬇️ Newest First</option>
              <option value="oldest">⬆️ Oldest First</option>
            </select>

            {/* Select All Toggle */}
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary"
            >
              {selected.size === paginatedSnapshots.length && paginatedSnapshots.length > 0 ? (
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

      {/* Snapshot Grid / States */}
      <section className="glass-card p-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3 rounded-2xl border border-border p-3">
                <div className="aspect-[4/3] w-full rounded-xl bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mb-3" />
            <h3 className="text-lg font-bold text-foreground">Could not load gallery</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
            <button
              onClick={loadSnapshotsData}
              className="mt-4 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-brand/90"
            >
              Retry Loading
            </button>
          </div>
        ) : filteredSnapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand mb-4">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No snapshots found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {q || dateFilter !== "all" || cameraFilter !== "all"
                ? "No captured evidence matches your active filter criteria. Try resetting filters."
                : "No customer entry snapshots have been captured yet. When someone enters, ShopGuardian will automatically record a snapshot."}
            </p>
            {(q || dateFilter !== "all" || cameraFilter !== "all") && (
              <button
                onClick={() => {
                  setQ("");
                  setDateFilter("all");
                  setCameraFilter("all");
                }}
                className="mt-4 rounded-2xl bg-secondary px-4 py-2 text-xs font-bold text-foreground hover:bg-brand-soft hover:text-brand"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginatedSnapshots.map((file, idx) => {
                const isSelected = selected.has(file);
                const actualIndex = (page - 1) * pageSize + idx;
                const formattedDate = file.replace(/\.(jpg|jpeg|png)$/i, "").replace(/_/g, " ");

                return (
                  <div
                    key={file}
                    className={`group relative overflow-hidden rounded-2xl border transition-all ${
                      isSelected ? "border-brand ring-2 ring-brand/30 bg-brand-soft/20" : "border-border bg-card hover:border-brand/50 hover:shadow-md"
                    }`}
                  >
                    {/* Checkbox badge */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(file);
                      }}
                      className="absolute left-2.5 top-2.5 z-10 grid h-6 w-6 place-items-center rounded-lg bg-black/60 text-white backdrop-blur transition hover:scale-110"
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4" />}
                    </button>

                    {/* Camera tag badge */}
                    <span className="absolute right-2.5 top-2.5 z-10 pill bg-black/60 text-white backdrop-blur text-[10px]">
                      <Camera className="h-3 w-3" /> Entrance
                    </span>

                    {/* Image Preview Container */}
                    <div
                      onClick={() => setPreviewIndex(actualIndex)}
                      className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-muted"
                    >
                      <img
                        src={getSnapshotImageUrl(file)}
                        alt={file}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-foreground shadow">
                          <Eye className="h-3.5 w-3.5" /> View
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Info */}
                    <div className="p-3">
                      <div className="truncate text-xs font-bold text-foreground" title={file}>
                        {file}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate">{formattedDate}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(file);
                          }}
                          title="Delete snapshot"
                          className="text-muted-foreground hover:text-danger transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <div className="text-xs font-semibold text-muted-foreground">
                Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–
                <span className="text-foreground">{Math.min(page * pageSize, filteredSnapshots.length)}</span> of{" "}
                <span className="text-foreground">{filteredSnapshots.length}</span> snapshots
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background text-sm font-bold transition hover:bg-secondary disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  if (totalPages > 6 && Math.abs(pNum - page) > 2 && pNum !== 1 && pNum !== totalPages) {
                    if (pNum === 2 || pNum === totalPages - 1) {
                      return (
                        <span key={pNum} className="px-1 text-xs text-muted-foreground">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`h-9 w-9 rounded-xl text-xs font-bold transition ${
                        page === pNum
                          ? "bg-brand text-white shadow-sm"
                          : "border border-border bg-background text-foreground hover:bg-secondary"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

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

      {/* Snapshot Preview Modal with Next/Prev Navigation */}
      {previewIndex !== null && filteredSnapshots[previewIndex] && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm animate-fade-up"
          onClick={() => setPreviewIndex(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-card p-5 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold text-foreground">
                  {filteredSnapshots[previewIndex]}
                </div>
                <div className="text-xs text-muted-foreground">
                  Evidence Capture #{previewIndex + 1} of {filteredSnapshots.length} · Camera 1 Entrance
                </div>
              </div>
              <button
                onClick={() => setPreviewIndex(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground hover:bg-danger-soft hover:text-danger transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="relative my-4 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/95">
              <img
                src={getSnapshotImageUrl(filteredSnapshots[previewIndex])}
                alt="Full Snapshot"
                className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain"
              />

              {/* Prev Button */}
              {previewIndex > 0 && (
                <button
                  onClick={handlePrevPreview}
                  className="absolute left-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-brand transition"
                  title="Previous snapshot"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {/* Next Button */}
              {previewIndex < filteredSnapshots.length - 1 && (
                <button
                  onClick={handleNextPreview}
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-brand transition"
                  title="Next snapshot"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <span className="pill bg-brand-soft text-brand text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" /> Person Verified by YOLOv8
              </span>

              <div className="flex items-center gap-2">
                <a
                  href={getSnapshotImageUrl(filteredSnapshots[previewIndex])}
                  download={filteredSnapshots[previewIndex]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-2.5 text-xs font-bold text-brand transition hover:bg-brand hover:text-white"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
                <button
                  onClick={() => setDeleteTarget(filteredSnapshots[previewIndex])}
                  className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2.5 text-xs font-bold text-danger transition hover:bg-danger hover:text-white"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Delete Confirmation Dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete <span className="font-semibold text-foreground">{deleteTarget}</span> from your local storage. This action cannot be undone.
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
            <AlertDialogTitle>Delete {selected.size} selected snapshots?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {selected.size} selected evidence snapshots? These files will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {isDeleting ? "Deleting..." : `Delete ${selected.size} Snapshots`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShopLayout>
  );
}