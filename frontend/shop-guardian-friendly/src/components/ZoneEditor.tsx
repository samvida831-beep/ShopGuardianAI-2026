import { Stage, Layer, Rect, Circle, Line } from "react-konva";
import { useEffect, useMemo, useRef, useState } from "react";

type Shape = "rectangle" | "circle" | "polygon";

type RectangleDisplay = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type CircleDisplay = {
  x: number;
  y: number;
  radius: number;
};

type DisplayValue = RectangleDisplay | CircleDisplay | number[] | null;

interface ZoneEditorProps {
  image: string;
  shape: Shape;
  value: number[];
  originalWidth: number;
  originalHeight: number;
  onZoneChange: (points: number[]) => void;
}

export default function ZoneEditor({
  image,
  shape,
  value,
  originalWidth,
  originalHeight,
  onZoneChange,
}: ZoneEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 500 });
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState<number[]>([]);

  useEffect(() => {
    if (shape === "polygon") {
      setPolygon(value);
    }
  }, [shape, value]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const updateSize = () => {
      setContainerSize({
        width: element.clientWidth || 900,
        height: element.clientHeight || 500,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const viewport = useMemo(() => {
    if (!originalWidth || !originalHeight) {
      return { width: containerSize.width, height: containerSize.height, offsetX: 0, offsetY: 0, scale: 1 };
    }

    const width = containerSize.width || 900;
    const height = containerSize.height || 500;
    const scale = Math.min(width / originalWidth, height / originalHeight);
    const renderedWidth = originalWidth * scale;
    const renderedHeight = originalHeight * scale;
    const offsetX = (width - renderedWidth) / 2;
    const offsetY = (height - renderedHeight) / 2;

    return { width, height, offsetX, offsetY, scale };
  }, [containerSize, originalWidth, originalHeight]);

  const toOriginal = (x: number, y: number) => ({
    x: Math.max(0, Math.min(originalWidth, (x - viewport.offsetX) / viewport.scale)),
    y: Math.max(0, Math.min(originalHeight, (y - viewport.offsetY) / viewport.scale)),
  });

  const toDisplay = (x: number, y: number) => ({
    x: viewport.offsetX + x * viewport.scale,
    y: viewport.offsetY + y * viewport.scale,
  });

  function handleMouseDown(e: any) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (!pos) return;

    if (shape === "polygon") {
      const originalPoint = toOriginal(pos.x, pos.y);
      const nextPolygon = [...polygon, originalPoint.x, originalPoint.y];
      setPolygon(nextPolygon);
      onZoneChange(nextPolygon);
      return;
    }

    setStart(pos);
    setEnd(pos);
    setDrawing(true);

    if (shape === "rectangle") {
      const startPoint = toOriginal(pos.x, pos.y);
      onZoneChange([startPoint.x, startPoint.y, startPoint.x, startPoint.y]);
    }

    if (shape === "circle") {
      const startPoint = toOriginal(pos.x, pos.y);
      onZoneChange([startPoint.x, startPoint.y, 0]);
    }
  }

  function handleMouseMove(e: any) {
    if (!drawing) return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (!pos || !start) return;

    setEnd(pos);

    if (shape === "rectangle") {
      const startPoint = toOriginal(start.x, start.y);
      const endPoint = toOriginal(pos.x, pos.y);
      onZoneChange([startPoint.x, startPoint.y, endPoint.x, endPoint.y]);
    }

    if (shape === "circle") {
      const radius = Math.sqrt((pos.x - start.x) ** 2 + (pos.y - start.y) ** 2) / viewport.scale;
      const startPoint = toOriginal(start.x, start.y);
      onZoneChange([startPoint.x, startPoint.y, radius]);
    }
  }

  function handleMouseUp() {
    setDrawing(false);
  }

  const displayValue = useMemo<DisplayValue>(() => {
    if (!value.length) return null;

    if (shape === "rectangle" && value.length >= 4) {
      const x1 = toDisplay(value[0] ?? 0, 0).x;
      const y1 = toDisplay(0, value[1] ?? 0).y;
      const x2 = toDisplay(value[2] ?? 0, 0).x;
      const y2 = toDisplay(0, value[3] ?? 0).y;
      return { x1, y1, x2, y2 };
    }

    if (shape === "circle" && value.length >= 3) {
      const center = toDisplay(value[0] ?? 0, value[1] ?? 0);
      const radius = (value[2] ?? 0) * viewport.scale;
      return { x: center.x, y: center.y, radius };
    }

    if (shape === "polygon" && value.length >= 4) {
      const points: number[] = [];
      for (let index = 0; index < value.length; index += 2) {
        const displayPoint = toDisplay(value[index] ?? 0, value[index + 1] ?? 0);
        points.push(displayPoint.x, displayPoint.y);
      }
      return points;
    }

    return null;
  }, [shape, value, viewport]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: originalWidth / originalHeight,
        position: "relative",
        background: "#000",
      }}
    >
      <img
        src={image}
        alt="Camera"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          position: "absolute",
          left: 0,
          top: 0,
        }}
      />

      <Stage
        width={viewport.width}
        height={viewport.height}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          {shape === "rectangle" && start && end && (
            <Rect
              x={Math.min(start.x, end.x)}
              y={Math.min(start.y, end.y)}
              width={Math.abs(end.x - start.x)}
              height={Math.abs(end.y - start.y)}
              stroke="lime"
              strokeWidth={3}
              fill="rgba(0,255,0,0.25)"
            />
          )}

          {shape === "rectangle" && displayValue && !Array.isArray(displayValue) && "x1" in displayValue && (
            <Rect
              x={Math.min(displayValue.x1, displayValue.x2)}
              y={Math.min(displayValue.y1, displayValue.y2)}
              width={Math.abs(displayValue.x2 - displayValue.x1)}
              height={Math.abs(displayValue.y2 - displayValue.y1)}
              stroke="lime"
              strokeWidth={3}
              fill="rgba(0,255,0,0.25)"
            />
          )}

          {shape === "circle" && start && end && (
            <Circle
              x={start.x}
              y={start.y}
              radius={Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)}
              stroke="yellow"
              strokeWidth={3}
              fill="rgba(255,255,0,0.25)"
            />
          )}

          {shape === "circle" && displayValue && !Array.isArray(displayValue) && "radius" in displayValue && (
            <Circle
              x={displayValue.x}
              y={displayValue.y}
              radius={displayValue.radius}
              stroke="yellow"
              strokeWidth={3}
              fill="rgba(255,255,0,0.25)"
            />
          )}

          {shape === "polygon" && Array.isArray(displayValue) && displayValue.length >= 4 && (
            <Line
              points={displayValue}
              closed
              stroke="red"
              strokeWidth={3}
              fill="rgba(255,0,0,0.25)"
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}