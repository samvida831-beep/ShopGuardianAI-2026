import cameraEntrance from "@/assets/camera-entrance.jpg";
import cameraInside from "@/assets/camera-inside.jpg";

export const snapshots = Array.from({ length: 18 }).map((_, i) => ({
  id: i + 1,
  src: i % 2 === 0 ? cameraInside : cameraEntrance,
  camera: i % 2 === 0 ? "Inside Shop" : "Entrance",
  time: `${(9 + Math.floor(i / 2)).toString().padStart(2, "0")}:${((i * 7) % 60).toString().padStart(2, "0")} AM`,
  date: "25 July 2026",
}));

export const customers = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  number: `#${(1000 + i).toString()}`,
  time: `${(9 + Math.floor(i / 2)).toString().padStart(2, "0")}:${((i * 11) % 60).toString().padStart(2, "0")} AM`,
  camera: i % 2 === 0 ? "Entrance" : "Inside Shop",
  snapshot: i % 2 === 0 ? cameraEntrance : cameraInside,
}));

export const alerts = [
  { id: 1, type: "detected", title: "New customer detected", time: "11:42 AM", camera: "Entrance", tone: "success" as const },
  { id: 2, type: "started", title: "Monitoring started", time: "09:00 AM", camera: "System", tone: "brand" as const },
  { id: 3, type: "empty", title: "Shop is empty", time: "10:15 AM", camera: "Inside Shop", tone: "warning" as const },
  { id: 4, type: "offline", title: "Camera went offline", time: "10:32 AM", camera: "Entrance", tone: "danger" as const },
  { id: 5, type: "detected", title: "New customer detected", time: "10:48 AM", camera: "Entrance", tone: "success" as const },
  { id: 6, type: "stopped", title: "Monitoring stopped", time: "08:15 PM", camera: "System", tone: "muted" as const },
];

export { cameraEntrance, cameraInside };