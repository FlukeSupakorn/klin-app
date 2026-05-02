import type { ModelEntry } from "./available-models";
import type { SystemSpecsDto } from "@/types/ipc";

const GIB = 1024 * 1024 * 1024;

export function assessCompatibility(model: ModelEntry, specs: SystemSpecsDto | null): string {
  if (model.compatibilityHint) {
    return model.compatibilityHint;
  }

  if (!specs) {
    return "Compatibility unknown";
  }

  const ram = specs.ramTotalBytes / GIB;
  if (model.sizeBytes > 4 * GIB && ram < 16) {
    return "Not recommended";
  }
  if (model.sizeBytes > 2 * GIB && ram < 12) {
    return "May be slow";
  }
  return "OK on your PC";
}
