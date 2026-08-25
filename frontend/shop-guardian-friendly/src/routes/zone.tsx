import { createFileRoute } from "@tanstack/react-router";
import { ShopLayout } from "@/components/ShopLayout";

export const Route = createFileRoute("/zone")({
  component: ZonePage,
});

function ZonePage() {
  return (
    <ShopLayout>
      <div className="glass-card p-6">
        <h2 className="text-2xl font-extrabold">
          Entry Zone Configuration
        </h2>

        <p className="mt-2 text-muted-foreground">
          Configure the customer entry region for each camera.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* Camera Selection */}
          <div className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 text-lg font-bold">
              Select Camera
            </h3>

            <select className="w-full rounded-xl border border-border bg-background p-3">
              <option>Camera 1 - Entrance</option>
              <option>Camera 2 - Inside Shop</option>
            </select>
          </div>

          {/* Shape Selection */}
          <div className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 text-lg font-bold">
              Entry Zone Shape
            </h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shape"
                  defaultChecked
                />
                Rectangle
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shape"
                />
                Circle
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shape"
                />
                Polygon
              </label>
            </div>
          </div>

        </div>

        {/* Live Camera Placeholder */}
        <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
          <h3 className="text-lg font-bold">
            Live Camera Preview
          </h3>

          <p className="mt-2 text-muted-foreground">
            The live camera feed will appear here.
          </p>

          <div className="mt-6 flex h-[450px] items-center justify-center rounded-2xl bg-muted">
            Live Camera Feed
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <button className="rounded-xl bg-red-500 px-5 py-3 font-semibold text-white hover:bg-red-600">
            Clear
          </button>

          <button className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-white hover:bg-yellow-600">
            Undo
          </button>

          <button className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700">
            Save Zone
          </button>
        </div>

      </div>
    </ShopLayout>
  );
}
