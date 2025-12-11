export interface CropRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface DetectionResult {
  regions: CropRegion[];
  confidence: number;
}
