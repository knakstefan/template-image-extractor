import { useRef, useState, useCallback, useEffect } from "react";
import { CropRegion } from "@/types/crop";
import { CropOverlay } from "./CropOverlay";
import { Plus, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface CropCanvasProps {
  imageSrc: string;
  regions: CropRegion[];
  selectedId: string | null;
  scrollToRegionId?: string | null;
  isDetecting?: boolean;
  detectionProgress?: number;
  detectionStep?: string;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegion: (id: string, updates: Partial<CropRegion>) => void;
  onDeleteRegion: (id: string) => void;
  onAddRegion: (region: Omit<CropRegion, "id">) => void;
  onDimensionsReady: (original: { width: number; height: number }, display: { width: number; height: number }) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

export function CropCanvas({
  imageSrc,
  regions,
  selectedId,
  scrollToRegionId,
  isDetecting,
  detectionProgress,
  detectionStep,
  onSelectRegion,
  onUpdateRegion,
  onDeleteRegion,
  onAddRegion,
  onDimensionsReady,
}: CropCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [containerBounds, setContainerBounds] = useState<DOMRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

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

  // Update bounds when zoom changes
  useEffect(() => {
    if (containerRef.current) {
      setContainerBounds(containerRef.current.getBoundingClientRect());
    }
  }, [zoomLevel]);

  // Scroll to region when scrollToRegionId changes
  useEffect(() => {
    if (scrollToRegionId && scrollContainerRef.current) {
      const region = regions.find((r) => r.id === scrollToRegionId);
      if (region) {
        const container = scrollContainerRef.current;
        const scrollLeft = region.x * zoomLevel - container.clientWidth / 2 + (region.width * zoomLevel) / 2;
        const scrollTop = region.y * zoomLevel - container.clientHeight / 2 + (region.height * zoomLevel) / 2;

        container.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: "smooth",
        });
      }
    }
  }, [scrollToRegionId, regions, zoomLevel]);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current && containerRef.current) {
      const img = imgRef.current;
      setImageDimensions({ width: img.clientWidth, height: img.clientHeight });
      onDimensionsReady(
        { width: img.naturalWidth, height: img.naturalHeight },
        { width: img.clientWidth, height: img.clientHeight },
      );
      setContainerBounds(containerRef.current.getBoundingClientRect());
    }
  }, [onDimensionsReady]);

  // Handle Cmd/Ctrl + scroll wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomLevel((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    }
  }, []);

  // Also need native event listener for preventing default
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isDetecting) return;
      if (e.target !== containerRef.current && e.target !== imgRef.current) return;

      onSelectRegion(null);

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Adjust coordinates for zoom level
      const x = (e.clientX - rect.left) / zoomLevel;
      const y = (e.clientY - rect.top) / zoomLevel;

      setIsDrawing(true);
      setDrawStart({ x, y });
      setDrawRect({ x, y, width: 0, height: 0 });
    },
    [onSelectRegion, zoomLevel, isDetecting],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      // Adjust for zoom level
      const currentX = Math.max(0, Math.min((e.clientX - rect.left) / zoomLevel, imageDimensions.width));
      const currentY = Math.max(0, Math.min((e.clientY - rect.top) / zoomLevel, imageDimensions.height));

      const x = Math.min(drawStart.x, currentX);
      const y = Math.min(drawStart.y, currentY);
      const width = Math.abs(currentX - drawStart.x);
      const height = Math.abs(currentY - drawStart.y);

      setDrawRect({ x, y, width, height });
    },
    [isDrawing, drawStart, zoomLevel, imageDimensions],
  );

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

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="relative flex flex-col gap-2">
      {/* Header with instructions/zoom OR detection progress */}
      <div className="flex items-center justify-between gap-4 min-h-[32px]">
        {isDetecting ? (
          <div className="flex items-center justify-center gap-6 flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
            <div className="flex-1 max-w-md">
              <Progress value={detectionProgress} className="h-2" />
            </div>
            <span className="text-sm font-medium text-foreground whitespace-nowrap">{detectionStep}</span>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {Math.round(detectionProgress || 0)}%
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plus className="w-4 h-4" />
              <span>Click and drag to add crop regions. Hold ⌘/Ctrl + scroll to zoom.</span>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>

              <div className="min-w-[60px] text-center text-sm font-medium text-muted-foreground">
                {Math.round(zoomLevel * 100)}%
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleResetZoom}
                disabled={zoomLevel === 1}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Scrollable zoom container */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto max-h-[70vh] rounded-lg border border-border bg-muted/30"
        onWheel={handleWheel}
      >
        <div
          ref={containerRef}
          className={cn(
            "relative inline-block origin-top-left",
            isDetecting ? "cursor-default" : "cursor-crosshair",
            isDrawing && "select-none",
          )}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top left",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Template"
            className="max-w-none object-contain"
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
              zoomLevel={zoomLevel}
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

          {/* Detection overlay - dims the image */}
          {isDetecting && (
            <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-50 pointer-events-none">
              {/* Scanning animation line */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
