import { CropRegion } from "@/types/crop";
import JSZip from "jszip";

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

export async function cropImage(
  imageSrc: string,
  region: CropRegion,
  originalWidth: number,
  originalHeight: number,
  displayWidth: number,
  displayHeight: number
): Promise<Blob> {
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

  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create blob"));
    }, "image/png");
  });
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
  regions: CropRegion[],
  originalWidth: number,
  originalHeight: number,
  displayWidth: number,
  displayHeight: number
): Promise<void> {
  const zip = new JSZip();

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const blob = await cropImage(
      imageSrc,
      region,
      originalWidth,
      originalHeight,
      displayWidth,
      displayHeight
    );
    const filename = region.label || `crop-${i + 1}.png`;
    zip.file(filename.endsWith(".png") ? filename : `${filename}.png`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, "cropped-images.zip");
}
