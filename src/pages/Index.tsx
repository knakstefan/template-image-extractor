import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { ImageUploader } from "@/components/ImageUploader";
import { CropCanvas } from "@/components/CropCanvas";
import { CropPreview } from "@/components/CropPreview";
import { ActionBar } from "@/components/ActionBar";
import { useCropEditor } from "@/hooks/useCropEditor";
import { cropImage, downloadBlob, downloadAllAsZip } from "@/lib/imageUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Download, Wand2 } from "lucide-react";

export default function Index() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [detectionStep, setDetectionStep] = useState("");
  const [scrollToRegionId, setScrollToRegionId] = useState<string | null>(null);

  const { regions, selectedId, setSelectedId, updateRegion, deleteRegion, addRegion, resetRegions } = useCropEditor();

  const handleImageSelect = useCallback(
    (file: File, preview: string) => {
      setImageFile(file);
      setImageSrc(preview);
      resetRegions([]);
      toast.success("Image uploaded successfully!");
    },
    [resetRegions],
  );

  const handleDimensionsReady = useCallback(
    (original: { width: number; height: number }, display: { width: number; height: number }) => {
      setOriginalDimensions(original);
      setDisplayDimensions(display);
    },
    [],
  );

  const handleDetect = useCallback(async () => {
    if (!imageSrc) return;

    setIsDetecting(true);
    setDetectionProgress(0);
    setDetectionStep("Preparing image...");

    // Start progress simulation
    const progressInterval = setInterval(() => {
      setDetectionProgress((prev) => {
        if (prev < 20) {
          setDetectionStep("Preparing image...");
          return prev + 4;
        } else if (prev < 70) {
          setDetectionStep("Analyzing content...");
          return prev + 2;
        } else if (prev < 90) {
          setDetectionStep("Detecting regions...");
          return prev + 0.5;
        }
        return prev;
      });
    }, 200);

    try {
      const { data, error } = await supabase.functions.invoke("detect-images", {
        body: {
          imageBase64: imageSrc,
          width: displayDimensions.width,
          height: displayDimensions.height,
        },
      });

      clearInterval(progressInterval);
      setDetectionProgress(100);
      setDetectionStep("Complete!");

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.regions && data.regions.length > 0) {
        resetRegions(data.regions);
        toast.success(`Selected ${data.regions.length} image(s)!`);
      } else {
        toast.info("No embedded images detected. Try adding regions manually.");
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Detection error:", error);
      toast.error("Failed to detect images. Please try again.");
    } finally {
      setIsDetecting(false);
      setDetectionProgress(0);
    }
  }, [imageSrc, displayDimensions, resetRegions]);

  const handleDownloadSingle = useCallback(
    async (regionId: string) => {
      if (!imageSrc) return;

      const region = regions.find((r) => r.id === regionId);
      if (!region) return;

      try {
        const blob = await cropImage(
          imageSrc,
          region,
          originalDimensions.width,
          originalDimensions.height,
          displayDimensions.width,
          displayDimensions.height,
        );
        const filename = region.filename || region.label || `crop-${regions.indexOf(region) + 1}`;
        downloadBlob(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
        toast.success("Image downloaded!");
      } catch (error) {
        console.error("Download error:", error);
        toast.error("Failed to download image");
      }
    },
    [imageSrc, regions, originalDimensions, displayDimensions],
  );

  const handleDownloadAll = useCallback(async () => {
    if (!imageSrc || !imageFile || regions.length === 0) return;

    try {
      toast.loading("Creating ZIP file...");
      await downloadAllAsZip(
        imageSrc,
        imageFile,
        regions,
        originalDimensions.width,
        originalDimensions.height,
        displayDimensions.width,
        displayDimensions.height,
      );
      toast.dismiss();
      toast.success("ZIP file downloaded!");
    } catch (error) {
      console.error("Batch download error:", error);
      toast.dismiss();
      toast.error("Failed to create ZIP file");
    }
  }, [imageSrc, imageFile, regions, originalDimensions, displayDimensions]);

  const handleReset = useCallback(() => {
    setImageFile(null);
    setImageSrc(null);
    resetRegions([]);
    setOriginalDimensions({ width: 0, height: 0 });
    setDisplayDimensions({ width: 0, height: 0 });
    toast.info("Reset complete");
  }, [resetRegions]);

  return (
    <>
      <Helmet>
        <title>AI Image Extractor - Extract Images from Screenshots & Mockups</title>
        <meta
          name="description"
          content="Upload screenshots or mockups and let AI automatically detect and crop embedded images. Download individually or as a batch ZIP file."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="relative sticky top-0 z-50 overflow-hidden border-b border-border/30">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/15 to-emerald-500/20 bg-[length:200%_100%] animate-gradient-shift" />
          <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />

          <div className="relative container py-8">
            <div className="flex flex-col items-center justify-center text-center md:text-left">
              <h1 className="flex gap-2 text-3xl md:text-3xl font-bold">
                <Sparkles className="textGradientBlueToGreen" />
                <span className="textGradientBlueToGreen">Image Extractor</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Extract images from screenshots & mockups</p>
            </div>
          </div>
        </header>

        <main className="container py-8 space-y-8">
          {!imageSrc ? (
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center space-y-4">
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Upload or copy & paste a screenshot or mockup, and AI will detect and extract all embedded images.
                </p>
              </div>

              <ImageUploader onImageSelect={handleImageSelect} />

              <div className="grid grid-cols-3 gap-6 pt-8">
                <div className="text-center space-y-2">
                  <div className="p-3 bg-primary/10 rounded-xl w-fit mx-auto">
                    <Wand2 className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">AI Detection</h3>
                  <p className="text-sm text-muted-foreground">Automatic image boundary detection</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="p-3 bg-accent/10 rounded-xl w-fit mx-auto">
                    <Sparkles className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground">Edit & Adjust</h3>
                  <p className="text-sm text-muted-foreground">Fine-tune crop regions manually</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="p-3 bg-success/10 rounded-xl w-fit mx-auto">
                    <Download className="w-6 h-6 text-success" />
                  </div>
                  <h3 className="font-semibold text-foreground">Batch Export</h3>
                  <p className="text-sm text-muted-foreground">Download all as ZIP or individually</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <ActionBar
                onDetect={handleDetect}
                onDownloadAll={handleDownloadAll}
                onReset={handleReset}
                isDetecting={isDetecting}
                hasRegions={regions.length > 0}
                hasImage={!!imageSrc}
              />

              <div className="grid lg:grid-cols-[1fr,320px] gap-6">
                <div className="space-y-4">
                  <div className="glass rounded-xl p-4">
                    <CropCanvas
                      imageSrc={imageSrc}
                      regions={regions}
                      selectedId={selectedId}
                      scrollToRegionId={scrollToRegionId}
                      isDetecting={isDetecting}
                      detectionProgress={detectionProgress}
                      detectionStep={detectionStep}
                      onSelectRegion={setSelectedId}
                      onUpdateRegion={updateRegion}
                      onDeleteRegion={deleteRegion}
                      onAddRegion={addRegion}
                      onDimensionsReady={handleDimensionsReady}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="glass rounded-xl p-4">
                    <h3 className="font-semibold text-foreground mb-4">Selected Images ({regions.length})</h3>
                    {regions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Click "Scan for images" or draw regions manually
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                        {regions.map((region, index) => (
                          <CropPreview
                            key={region.id}
                            region={region}
                            imageSrc={imageSrc}
                            originalWidth={originalDimensions.width}
                            originalHeight={originalDimensions.height}
                            displayWidth={displayDimensions.width}
                            displayHeight={displayDimensions.height}
                            isSelected={selectedId === region.id}
                            onSelect={() => {
                              setSelectedId(region.id);
                              setScrollToRegionId(region.id);
                              setTimeout(() => setScrollToRegionId(null), 500);
                            }}
                            onDelete={() => deleteRegion(region.id)}
                            onDownload={() => handleDownloadSingle(region.id)}
                            index={index}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
