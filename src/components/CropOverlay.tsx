import { useCallback, useRef, useState } from "react";
import { CropRegion } from "@/types/crop";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface CropOverlayProps {
  region: CropRegion;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<CropRegion>) => void;
  onDelete: () => void;
  containerBounds: DOMRect | null;
  index: number;
}

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export function CropOverlay({
  region,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  containerBounds,
  index,
}: CropOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle | null>(null);
  const startPos = useRef({ x: 0, y: 0, rx: 0, ry: 0, rw: 0, rh: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle?: ResizeHandle) => {
      e.stopPropagation();
      onSelect();
      
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        rx: region.x,
        ry: region.y,
        rw: region.width,
        rh: region.height,
      };

      if (handle) {
        setIsResizing(handle);
      } else {
        setIsDragging(true);
      }

      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;

        if (handle) {
          let newX = startPos.current.rx;
          let newY = startPos.current.ry;
          let newW = startPos.current.rw;
          let newH = startPos.current.rh;

          if (handle.includes("w")) {
            newX = Math.max(0, startPos.current.rx + dx);
            newW = startPos.current.rw - dx;
          }
          if (handle.includes("e")) {
            newW = startPos.current.rw + dx;
          }
          if (handle.includes("n")) {
            newY = Math.max(0, startPos.current.ry + dy);
            newH = startPos.current.rh - dy;
          }
          if (handle.includes("s")) {
            newH = startPos.current.rh + dy;
          }

          if (newW >= 20 && newH >= 20) {
            onUpdate({ x: newX, y: newY, width: newW, height: newH });
          }
        } else {
          const maxX = containerBounds ? containerBounds.width - region.width : Infinity;
          const maxY = containerBounds ? containerBounds.height - region.height : Infinity;
          
          onUpdate({
            x: Math.max(0, Math.min(maxX, startPos.current.rx + dx)),
            y: Math.max(0, Math.min(maxY, startPos.current.ry + dy)),
          });
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [region, onSelect, onUpdate, containerBounds]
  );

  const handles: { position: ResizeHandle; className: string }[] = [
    { position: "nw", className: "-top-1.5 -left-1.5 cursor-nw-resize" },
    { position: "ne", className: "-top-1.5 -right-1.5 cursor-ne-resize" },
    { position: "sw", className: "-bottom-1.5 -left-1.5 cursor-sw-resize" },
    { position: "se", className: "-bottom-1.5 -right-1.5 cursor-se-resize" },
    { position: "n", className: "-top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize" },
    { position: "s", className: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize" },
    { position: "e", className: "top-1/2 -right-1.5 -translate-y-1/2 cursor-e-resize" },
    { position: "w", className: "top-1/2 -left-1.5 -translate-y-1/2 cursor-w-resize" },
  ];

  return (
    <div
      className={cn(
        "absolute border-2 transition-colors",
        isSelected
          ? "border-crop-border animate-pulse-border z-20"
          : "border-primary/70 hover:border-primary z-10",
        (isDragging || isResizing) && "cursor-grabbing"
      )}
      style={{
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
      }}
      onMouseDown={(e) => handleMouseDown(e)}
    >
      {/* Label */}
      <div className="absolute -top-6 left-0 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-t-md">
        {index + 1}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity hover:scale-110 z-30"
        style={{ opacity: isSelected ? 1 : undefined }}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Resize handles */}
      {isSelected &&
        handles.map(({ position, className }) => (
          <div
            key={position}
            className={cn(
              "absolute w-3 h-3 bg-crop-handle rounded-full shadow-md border-2 border-card",
              className
            )}
            onMouseDown={(e) => handleMouseDown(e, position)}
          />
        ))}

      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-primary/5" />
    </div>
  );
}
