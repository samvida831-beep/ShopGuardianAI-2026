import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Calendar, Download, Trash2, X } from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { getSnapshots, getSnapshotImageUrl } from "@/lib/api";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Snapshots Gallery · ShopGuardian AI" },
      { name: "description", content: "Browse and manage every snapshot captured by your ShopGuardian AI system." },
      { property: "og:title", content: "ShopGuardian AI · Gallery" },
      { property: "og:description", content: "Browse and manage every snapshot captured by your ShopGuardian AI system." },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  useEffect(() => {
  async function loadSnapshots() {
    try {
      const data = await getSnapshots();
      setSnapshots(data);
    } catch (error) {
      console.error(error);
    }
  }

  loadSnapshots();
}, []);
  const filtered = useMemo(
  () =>
    snapshots.filter((s) =>
      s.toLowerCase().includes(q.toLowerCase())
    ),
  [q, snapshots]
);
  return (
    <ShopLayout>
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold">Snapshots Gallery</h2>
            <p className="text-sm text-muted-foreground">{filtered.length} snapshots captured today</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search snapshots" className="w-40 bg-transparent text-sm outline-none" />
            </div>
            <button className="inline-flex items-center gap-2 rounded-2xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary">
              <Calendar className="h-4 w-4" /> Today
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((file) => (
            <button
              key={file}
              onClick={() => setOpen(snapshots.indexOf(file))}
              className="group text-left"
            >
            <div className="overflow-hidden rounded-2xl border border-border">
              <img
                src={getSnapshotImageUrl(file)}
                alt={file}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
              />
            </div>

            <div className="mt-2 text-sm font-bold">{file}</div>

            <div className="text-xs text-muted-foreground">
              Snapshot
            </div>
          </button>
        ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Showing 1–{filtered.length} of {snapshots.length}</div>
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => (
              <button key={p} className={`h-9 w-9 rounded-xl text-sm font-bold ${p === 1 ? "bg-brand text-white" : "bg-secondary text-muted-foreground hover:bg-brand-soft hover:text-brand"}`}>{p}</button>
            ))}
          </div>
        </div>
      </section>

      {open !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(null)}>
          <div className="max-w-3xl w-full rounded-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-2">
              <div className="font-bold">Snapshot preview</div>
              <button onClick={() => setOpen(null)} className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <img
              src={getSnapshotImageUrl(snapshots[open!])}
              alt="preview"
              className="w-full rounded-2xl"
            />
            <div className="mt-3 flex justify-end gap-2 p-2">
              <button className="inline-flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-2 text-sm font-bold text-brand"><Download className="h-4 w-4" /> Download</button>
              <button className="inline-flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2 text-sm font-bold text-danger"><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </ShopLayout>
  );
}