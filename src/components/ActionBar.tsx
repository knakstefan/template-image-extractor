import { Button } from "@/components/ui/button";
import { Download, FolderArchive, RotateCcw, Sparkles, Loader2 } from "lucide-react";

interface ActionBarProps {
  onDetect: () => void;
  onDownloadAll: () => void;
  onReset: () => void;
  isDetecting: boolean;
  hasRegions: boolean;
  hasImage: boolean;
}

export function ActionBar({
  onDetect,
  onDownloadAll,
  onReset,
  isDetecting,
  hasRegions,
  hasImage,
}: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass rounded-xl">
      <div className="flex items-center gap-3">
        <Button
          onClick={onDetect}
          disabled={!hasImage || isDetecting}
          className="gap-2"
        >
          {isDetecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isDetecting ? "Detecting..." : "Detect Images"}
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          disabled={!hasImage}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={onDownloadAll}
          disabled={!hasRegions}
          className="gap-2"
        >
          <FolderArchive className="w-4 h-4" />
          Download All (ZIP)
        </Button>
      </div>
    </div>
  );
}
