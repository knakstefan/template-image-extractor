import { useCallback, useState, useEffect } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploaderProps {
  onImageSelect: (file: File, preview: string) => void;
  disabled?: boolean;
}

export function ImageUploader({ onImageSelect, disabled }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageSelect(file, e.target?.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const namedFile = new File([file], `pasted-image-${Date.now()}.png`, {
              type: file.type,
            });
            setIsPasting(true);
            toast.success("Pasted from clipboard!");
            handleFile(namedFile);
            setTimeout(() => setIsPasting(false), 600);
          }
          break;
        }
      }
    },
    [disabled, handleFile]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative flex flex-col items-center justify-center w-full min-h-[400px] rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer group",
        isDragging
          ? "border-primary bg-primary/10 scale-[1.02] shadow-[0_0_30px_hsl(75,100%,50%,0.15)]"
          : "border-border hover:border-primary/60 hover:bg-card/80",
        isPasting && "animate-paste-glow scale-[1.01] border-cyan-400",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-4 p-8 text-center pointer-events-none">
        <div
          className={cn(
            "p-6 rounded-2xl transition-all duration-300",
            isDragging
              ? "bg-primary/10 scale-110"
              : "bg-muted group-hover:bg-primary/10 group-hover:scale-105"
          )}
        >
          {isDragging ? (
            <ImageIcon className="w-12 h-12 text-primary" />
          ) : (
            <Upload className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-lg font-medium text-foreground">
            {isDragging ? "Drop your image here" : "Upload your template image"}
          </p>
          <p className="text-sm text-muted-foreground">
            Drag & drop, click to browse, or paste (⌘V)
          </p>
          <p className="text-xs text-muted-foreground/70">
            Supports PNG, JPG, WebP
          </p>
        </div>
      </div>
    </div>
  );
}
