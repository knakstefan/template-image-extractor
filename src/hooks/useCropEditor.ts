import { useState, useCallback } from "react";
import { CropRegion } from "@/types/crop";

export function useCropEditor(initialRegions: CropRegion[] = []) {
  const [regions, setRegions] = useState<CropRegion[]>(initialRegions);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const updateRegion = useCallback((id: string, updates: Partial<CropRegion>) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const deleteRegion = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const addRegion = useCallback((region: Omit<CropRegion, "id">) => {
    const newRegion: CropRegion = {
      ...region,
      id: `crop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setRegions((prev) => [...prev, newRegion]);
    return newRegion.id;
  }, []);

  const resetRegions = useCallback((newRegions: CropRegion[]) => {
    setRegions(newRegions);
    setSelectedId(null);
  }, []);

  return {
    regions,
    selectedId,
    setSelectedId,
    updateRegion,
    deleteRegion,
    addRegion,
    resetRegions,
  };
}
