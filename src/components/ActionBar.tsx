import { Button } from "@/components/ui/button";
import { Download, FolderArchive, RotateCcw, Sparkles, Loader2, FileImage } from "lucide-react";

interface ActionBarProps {
  onDetect: () => void;
  onDownloadAll: () => void;
  onReset: () => void;
  isDetecting: boolean;
  hasRegions: boolean;
  hasImage: boolean;
  imageName?: string;
}

export function ActionBar({ onDetect, onDownloadAll, onReset, isDetecting, hasRegions, hasImage, imageName }: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass rounded-xl">
      <div className="flex items-center gap-3">
        {imageName && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/50">
            <FileImage className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={imageName}>
              {imageName}
            </span>
          </div>
        )}
        <Button onClick={onDetect} disabled={!hasImage || isDetecting} className="gap-2">
          {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isDetecting ? "Scanning for images..." : "Scan for images"}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={!hasImage} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Start over using a different image
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={onDownloadAll} disabled={!hasRegions} className="gap-2">
          <FolderArchive className="w-4 h-4" />
          Download All (ZIP)
        </Button>
      </div>
    </div>
  );
}
