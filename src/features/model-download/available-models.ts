import type { ModelDownloadSlot } from "@/types/ipc";

export type Slot = ModelDownloadSlot;

export interface ModelEntry {
  id: string;
  slot: Slot;
  label: string;
  filename: string;
  url: string;
  sizeBytes: number;
  sha256: string;
  description: string;
  compatibilityHint?: string;
  isDefault?: boolean;
  locked?: boolean;
  imageModel?: ImageModelEntry;
}

export interface ImageModelEntry {
  filename: string;
  url: string;
  sizeBytes: number;
  sha256: string;
  compatibilityHint?: string;
}

const QWEN25_VL_3B_IMAGE_MODEL: ImageModelEntry = {
  filename: "mmproj-F16.gguf",
  url: "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-F16.gguf",
  sizeBytes: 1_338_428_256,
  sha256: "4c1240f514de94c81b70709b0f9a80c7e3297598ea7c83f39dc00b18ee5be60c",
  compatibilityHint: "Optional",
};

export const AVAILABLE_MODELS: ModelEntry[] = [
  {
    id: "qwen25-vl-3b-iq4-xs",
    slot: "chat",
    label: "Default - recommended for most PCs",
    filename: "Qwen2.5-VL-3B-Instruct-iq4_xs.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-IQ4_XS.gguf",
    sizeBytes: 1_739_093_344,
    sha256: "9bbd14f46702382da6ac9522a0958c5b3c56def696050c3b15b0421398d80ef9",
    description: "Balanced local chat model for organizing and reasoning over files.",
    compatibilityHint: "Recommended",
    isDefault: true,
    imageModel: QWEN25_VL_3B_IMAGE_MODEL,
  },
  {
    id: "qwen25-vl-3b-iq2-xxs",
    slot: "chat",
    label: "Tiny - fastest preview",
    filename: "Qwen2.5-VL-3B-Instruct-UD-IQ2_XXS.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-UD-IQ2_XXS.gguf",
    sizeBytes: 970_685_792,
    sha256: "23d41b8c43350c673df6162b54c077225b80b363e9920e4d4a8f293ef934c524",
    description: "Smallest download and fastest startup, with lower answer quality.",
    compatibilityHint: "Best for low-RAM PCs",
    imageModel: QWEN25_VL_3B_IMAGE_MODEL,
  },
  {
    id: "qwen25-vl-3b-q4-k-m",
    slot: "chat",
    label: "Small - sharper 3B",
    filename: "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
    sizeBytes: 1_929_901_408,
    sha256: "43340b98657f99c2656d3b5a3badb159c6572a66cb46b9594dea4ecc03a7aff4",
    description: "Better quality than the default quant while staying compact.",
    compatibilityHint: "OK on most PCs",
    imageModel: QWEN25_VL_3B_IMAGE_MODEL,
  },
  {
    id: "qwen25-vl-7b-iq4-xs",
    slot: "chat",
    label: "Medium - stronger reasoning",
    filename: "Qwen2.5-VL-7B-Instruct-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-IQ4_XS.gguf",
    sizeBytes: 4_235_502_464,
    sha256: "8b2b39ba350ac1c3a291257faebfb9a7bd1aa23c5f5164760beba44edaaa98d0",
    description: "More capable file reasoning with a larger local model.",
    compatibilityHint: "Needs 12+ GB RAM",
    imageModel: {
      filename: "mmproj-Qwen2.5-VL-7B-F16.gguf",
      url: "https://huggingface.co/unsloth/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-F16.gguf",
      sizeBytes: 1_354_163_040,
      sha256: "17b95da7964b8a0f7a428b91b0c241836e3dc1eedce0379b2abf5698649c97e7",
      compatibilityHint: "Optional",
    },
  },
  {
    id: "qwen25-vl-32b-iq4-xs",
    slot: "chat",
    label: "Large - high quality",
    filename: "Qwen2.5-VL-32B-Instruct-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-32B-Instruct-GGUF/resolve/main/Qwen2.5-VL-32B-Instruct-IQ4_XS.gguf",
    sizeBytes: 17_717_483_040,
    sha256: "15206c5b188ae0b339c1f0ee54d81b2924e5d85c925717b9f8014f16b283c807",
    description: "Much stronger quality for heavy local machines.",
    compatibilityHint: "Needs 32+ GB RAM",
    imageModel: {
      filename: "mmproj-Qwen2.5-VL-32B-F16.gguf",
      url: "https://huggingface.co/unsloth/Qwen2.5-VL-32B-Instruct-GGUF/resolve/main/mmproj-F16.gguf",
      sizeBytes: 1_378_753_376,
      sha256: "e0a507f7f7fe261af20c04cc2f1033d86234e44a51d6316da965f8566e1bafea",
      compatibilityHint: "Optional",
    },
  },
  {
    id: "qwen25-vl-72b-iq4-xs",
    slot: "chat",
    label: "Max - workstation only",
    filename: "Qwen2.5-VL-72B-Instruct-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-72B-Instruct-GGUF/resolve/main/Qwen2.5-VL-72B-Instruct-IQ4_XS.gguf",
    sizeBytes: 39_748_002_208,
    sha256: "3df38eb0918153790aa56e18b7db78e4e025a3381fe59220959697c85db1365c",
    description: "Largest option for maximum quality on powerful workstations.",
    compatibilityHint: "Needs 64+ GB RAM",
    imageModel: {
      filename: "mmproj-Qwen2.5-VL-72B-F16.gguf",
      url: "https://huggingface.co/unsloth/Qwen2.5-VL-72B-Instruct-GGUF/resolve/main/mmproj-F16.gguf",
      sizeBytes: 1_410_223_552,
      sha256: "d0b575202a4869f97cfb25454d77ec72dbe8157c926d5f9872b8c68aa4e10c25",
      compatibilityHint: "Optional",
    },
  },
  {
    id: "nomic-embed-text-v15-q8",
    slot: "embed",
    label: "Nomic Embed Text v1.5",
    filename: "nomic-embed-text-v1.5.Q8_0.gguf",
    url: "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf",
    sizeBytes: 146_146_432,
    sha256: "3e24342164b3d94991ba9692fdc0dd08e3fd7362e0aacc396a9a5c54a544c3b7",
    description: "Required search and similarity model for notes and organization.",
    compatibilityHint: "Runs on most PCs",
    locked: true,
  },
  {
    id: "qwen25-vl-mmproj-f16",
    slot: "mmproj",
    label: "Image understanding model",
    filename: "mmproj-F16.gguf",
    url: "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-F16.gguf",
    sizeBytes: 1_338_428_256,
    sha256: "4c1240f514de94c81b70709b0f9a80c7e3297598ea7c83f39dc00b18ee5be60c",
    description: "Download this if you want KLIN to organize image files.",
    compatibilityHint: "Optional",
  },
];

export const DEFAULT_CHAT_MODEL = AVAILABLE_MODELS.find(
  (model) => model.slot === "chat" && model.isDefault,
)!;

export const EMBED_MODEL = AVAILABLE_MODELS.find((model) => model.slot === "embed")!;

export const MMPROJ_MODEL = AVAILABLE_MODELS.find((model) => model.slot === "mmproj")!;

export const CHAT_MODELS = AVAILABLE_MODELS.filter((model) => model.slot === "chat");

export function getImageModelForChat(chatModel: ModelEntry): ModelEntry {
  const imageModel = chatModel.imageModel ?? QWEN25_VL_3B_IMAGE_MODEL;
  return {
    ...MMPROJ_MODEL,
    filename: imageModel.filename,
    url: imageModel.url,
    sizeBytes: imageModel.sizeBytes,
    sha256: imageModel.sha256,
    compatibilityHint: imageModel.compatibilityHint ?? MMPROJ_MODEL.compatibilityHint,
  };
}
