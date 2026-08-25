import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ShopLayout } from "@/components/ShopLayout";
import { getCustomers, type CustomerVisitRecord } from "@/lib/api";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customer History · ShopGuardian AI" },
      { name: "description", content: "See every customer visit your shop with time, camera and snapshot." },
      { property: "og:title", content: "ShopGuardian AI · Customer History" },
      { property: "og:description", content: "See every customer visit your shop with time, camera and snapshot." },
    ],
  }),
  component: CustomerHistory,
});

function CustomerHistory() {
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<CustomerVisitRecord[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCustomers();
        setRecords(data);
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, []);

  const list = useMemo(() => records.filter((c) => {
    const haystack = `${c.customer_label ?? ""} ${c.event_type ?? ""} Camera ${c.camera_number}`.toLowerCase();
    return haystack.includes(q.toLowerCase());
  }), [q, records]);

  return (
    <ShopLayout>
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold">Customer History</h2>
            <p className="text-sm text-muted-foreground">A friendly timeline of everyone who visited today.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" className="w-40 bg-transparent text-sm outline-none" />
            </div>
            <div className="flex overflow-hidden rounded-2xl border-2 border-border">
              {["Today", "This Week", "This Month"].map((t, i) => (
                <button key={t} className={`px-3 py-2 text-xs font-bold ${i === 0 ? "bg-brand text-white" : "bg-background text-muted-foreground hover:bg-secondary"}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Customer #</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Camera</th>
                <th className="px-4 py-2">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="rounded-2xl bg-secondary/60">
                  <td className="rounded-l-2xl px-4 py-3 font-extrabold text-brand">{c.customer_label || `Visit ${c.id}`}</td>
                  <td className="px-4 py-3 tabular-nums">{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="pill bg-brand-soft text-brand">Camera {c.camera_number}</span>
                  </td>
                  <td className="rounded-r-2xl px-4 py-2">
                    {c.snapshot_file ? <img src={`http://127.0.0.1:8000/api/snapshot-image?file=${c.snapshot_file}`} alt="snap" className="h-12 w-16 rounded-lg object-cover" loading="lazy" /> : <span className="text-xs text-muted-foreground">No snapshot</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ShopLayout>
  );
}