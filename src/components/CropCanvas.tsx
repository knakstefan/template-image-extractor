import { useRef, useState, useCallback, useEffect } from "react";
import { CropRegion } from "@/types/crop";
import { CropOverlay } from "./CropOverlay";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CropCanvasProps {
  imageSrc: string;
  regions: CropRegion[];
  selectedId: string | null;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegion: (id: string, updates: Partial<CropRegion>) => void;
  onDeleteRegion: (id: string) => void;
  onAddRegion: (region: Omit<CropRegion, "id">) => void;
  onDimensionsReady: (original: { width: number; height: number }, display: { width: number; height: number }) => void;
}

export function CropCanvas({
  imageSrc,
  regions,
  selectedId,
  onSelectRegion,
  onUpdateRegion,
  onDeleteRegion,
  onAddRegion,
  onDimensionsReady,
}: CropCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [containerBounds, setContainerBounds] = useState<DOMRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        setContainerBounds(containerRef.current.getBoundingClientRect());
      }
    };

    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current && containerRef.current) {
      const img = imgRef.current;
      onDimensionsReady(
        { width: img.naturalWidth, height: img.naturalHeight },
        { width: img.clientWidth, height: img.clientHeight }
      );
      setContainerBounds(containerRef.current.getBoundingClientRect());
    }
  }, [onDimensionsReady]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== containerRef.current && e.target !== imgRef.current) return;
    
    onSelectRegion(null);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawRect({ x, y, width: 0, height: 0 });
  }, [onSelectRegion]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x = Math.min(drawStart.x, currentX);
    const y = Math.min(drawStart.y, currentY);
    const width = Math.abs(currentX - drawStart.x);
    const height = Math.abs(currentY - drawStart.y);

    setDrawRect({ x, y, width, height });
  }, [isDrawing, drawStart]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawRect && drawRect.width > 20 && drawRect.height > 20) {
      onAddRegion({
        x: drawRect.x,
        y: drawRect.y,
        width: drawRect.width,
        height: drawRect.height,
      });
    }
    setIsDrawing(false);
    setDrawRect(null);
  }, [isDrawing, drawRect, onAddRegion]);

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Plus className="w-4 h-4" />
        <span>Click and drag on the image to manually add crop regions</span>
      </div>
      <div
        ref={containerRef}
        className={cn(
          "relative inline-block rounded-lg overflow-hidden shadow-lg cursor-crosshair",
          isDrawing && "select-none"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Template"
          className="max-w-full max-h-[70vh] object-contain"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Existing crop regions */}
        {regions.map((region, index) => (
          <CropOverlay
            key={region.id}
            region={region}
            isSelected={selectedId === region.id}
            onSelect={() => onSelectRegion(region.id)}
            onUpdate={(updates) => onUpdateRegion(region.id, updates)}
            onDelete={() => onDeleteRegion(region.id)}
            containerBounds={containerBounds}
            index={index}
          />
        ))}

        {/* Drawing rectangle */}
        {drawRect && drawRect.width > 0 && drawRect.height > 0 && (
          <div
            className="absolute border-2 border-dashed border-accent bg-accent/10 pointer-events-none"
            style={{
              left: drawRect.x,
              top: drawRect.y,
              width: drawRect.width,
              height: drawRect.height,
            }}
          />
        )}
      </div>
    </div>
  );
}
