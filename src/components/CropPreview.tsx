import { useState, useEffect } from "react";
import { CropRegion } from "@/types/crop";
import { loadImage } from "@/lib/imageUtils";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CropPreviewProps {
  region: CropRegion;
  imageSrc: string;
  originalWidth: number;
  originalHeight: number;
  displayWidth: number;
  displayHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDownload: () => void;
  index: number;
}

export function CropPreview({
  region,
  imageSrc,
  originalWidth,
  originalHeight,
  displayWidth,
  displayHeight,
  isSelected,
  onSelect,
  onDelete,
  onDownload,
  index,
}: CropPreviewProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    async function generatePreview() {
      try {
        const img = await loadImage(imageSrc);
        
        const scaleX = originalWidth / displayWidth;
        const scaleY = originalHeight / displayHeight;
        
        const x = Math.round(region.x * scaleX);
        const y = Math.round(region.y * scaleY);
        const width = Math.round(region.width * scaleX);
        const height = Math.round(region.height * scaleY);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        setPreview(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("Failed to generate preview:", error);
      }
    }

    generatePreview();
  }, [imageSrc, region, originalWidth, originalHeight, displayWidth, displayHeight]);

  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer glass",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {preview ? (
          <img
            src={preview}
            alt={`Crop ${index + 1}`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 animate-shimmer" />
        )}
      </div>
      
      <div className="absolute top-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded">
        {index + 1}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1 justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 bg-card/80 hover:bg-card"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 bg-card/80 hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
