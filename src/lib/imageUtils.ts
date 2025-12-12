import { CropRegion } from "@/types/crop";
import JSZip from "jszip";

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface OptimizationResult {
  blob: Blob;
  format: ImageFormat;
  extension: string;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Analyzes image data to determine if it has transparency
 */
function hasTransparency(imageData: ImageData): boolean {
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * Analyzes image to determine optimal format based on content
 * - PNG: transparency, screenshots, graphics with sharp edges
 * - WebP: photographic content (better compression)
 */
function detectOptimalFormat(ctx: CanvasRenderingContext2D, width: number, height: number): ImageFormat {
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // If has transparency, must use PNG or WebP with alpha
  if (hasTransparency(imageData)) {
    return 'png';
  }
  
  // For non-transparent images, WebP provides best compression
  return 'webp';
}

/**
 * Converts canvas to optimized blob with smart format selection
 */
async function canvasToOptimizedBlob(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  forceFormat?: ImageFormat,
  customQuality?: number
): Promise<OptimizationResult> {
  const format = forceFormat || detectOptimalFormat(ctx, canvas.width, canvas.height);
  
  // Quality settings: customQuality or default (0.85 for crops)
  const quality = format === 'png' ? undefined : (customQuality ?? 0.85);
  const mimeType = `image/${format}`;
  
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({
            blob,
            format,
            extension: format === 'jpeg' ? 'jpg' : format,
          });
        } else {
          reject(new Error("Failed to create blob"));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Optimizes the template/original image with high-quality compression
 */
async function optimizeTemplate(
  originalFile: File,
  forceFormat?: ImageFormat
): Promise<OptimizationResult> {
  const imageSrc = await fileToBase64(originalFile);
  const img = await loadImage(imageSrc);
  
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  
  // Use higher quality (0.92) for template to preserve source quality
  return canvasToOptimizedBlob(canvas, ctx, forceFormat, 0.92);
}

export async function cropImage(
  imageSrc: string,
  region: CropRegion,
  originalWidth: number,
  originalHeight: number,
  displayWidth: number,
  displayHeight: number,
  forceFormat?: ImageFormat
): Promise<OptimizationResult> {
  const img = await loadImage(imageSrc);
  
  // Scale coordinates from display to original
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
  if (!ctx) throw new Error("Could not get canvas context");

  // Enable high-quality image rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

  return canvasToOptimizedBlob(canvas, ctx, forceFormat);
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAllAsZip(
  imageSrc: string,
  originalFile: File,
  regions: CropRegion[],
  originalWidth: number,
  originalHeight: number,
  displayWidth: number,
  displayHeight: number
): Promise<void> {
  const zip = new JSZip();

  // Optimize the template file with high-quality compression
  const templateResult = await optimizeTemplate(originalFile);
  zip.file(`template.${templateResult.extension}`, templateResult.blob);

  // Add all cropped regions with optimized format selection
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const result = await cropImage(
      imageSrc,
      region,
      originalWidth,
      originalHeight,
      displayWidth,
      displayHeight
    );
    const baseName = region.filename || region.label || `crop-${i + 1}`;
    // Remove any existing extension and add the optimized one
    const cleanName = baseName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    zip.file(`${cleanName}.${result.extension}`, result.blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const baseName = originalFile.name.replace(/\.[^/.]+$/, "");
  downloadBlob(zipBlob, `${baseName}-cropped.zip`);
}
