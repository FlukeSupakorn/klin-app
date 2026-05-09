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

const QWEN35_08B_IMAGE_MODEL: ImageModelEntry = {
  filename: "mmproj-Qwen3.5-0.8B-F16.gguf",
  url: "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/mmproj-F16.gguf",
  sizeBytes: 204_987_232,
  sha256: "56e4c6cfe73b0c82e3e82bc518d7591997e61d81f723fc41a586f4fa69ea2453",
  compatibilityHint: "Optional",
};

const QWEN35_2B_IMAGE_MODEL: ImageModelEntry = {
  filename: "mmproj-Qwen3.5-2B-F16.gguf",
  url: "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/mmproj-F16.gguf",
  sizeBytes: 668_227_264,
  sha256: "7035e9cb8d7c6a9681d07eef9a364783e86ea4cd73faab2eabb4f43a101830c7",
  compatibilityHint: "Optional",
};

const QWEN35_4B_IMAGE_MODEL: ImageModelEntry = {
  filename: "mmproj-Qwen3.5-4B-F16.gguf",
  url: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/mmproj-F16.gguf",
  sizeBytes: 672_423_616,
  sha256: "cd88edcf8d031894960bb0c9c5b9b7e1fea6ebee02b9f7ce925a00d12891f864",
  compatibilityHint: "Optional",
};

const QWEN35_9B_IMAGE_MODEL: ImageModelEntry = {
  filename: "mmproj-Qwen3.5-9B-F16.gguf",
  url: "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/mmproj-F16.gguf",
  sizeBytes: 918_166_080,
  sha256: "f70dc3509053962b0d0d3ee8a7eacebf5d60aa560cad78254ae8698516ae029f",
  compatibilityHint: "Optional",
};

const QWEN35_27B_IMAGE_MODEL: ImageModelEntry = {
  filename: "mmproj-Qwen3.5-27B-F16.gguf",
  url: "https://huggingface.co/unsloth/Qwen3.5-27B-GGUF/resolve/main/mmproj-F16.gguf",
  sizeBytes: 927_607_040,
  sha256: "458bc46d8f275866fde5d88c9c554d9d462a6e8e3a028090d9850e17ab6a1217",
  compatibilityHint: "Optional",
};

export const AVAILABLE_MODELS: ModelEntry[] = [
  {
    id: "qwen35-08b-iq4-xs",
    slot: "chat",
    label: "Default - lightweight & fast",
    filename: "Qwen3.5-0.8B-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-IQ4_XS.gguf",
    sizeBytes: 492_605_696,
    sha256: "619917ae92f61eb6515a7070e944a0a7c2b198a2cf6536386f475485188a36ff",
    description: "Compact local chat model tuned for fast organizing on everyday PCs.",
    compatibilityHint: "Recommended",
    isDefault: true,
    imageModel: QWEN35_08B_IMAGE_MODEL,
  },
  {
    id: "qwen35-2b-iq4-xs",
    slot: "chat",
    label: "2B - small step up",
    filename: "Qwen3.5-2B-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-IQ4_XS.gguf",
    sizeBytes: 1_172_996_352,
    sha256: "3639f34b5ca22aa1c51f3616566eae8c355111554f6924ad97ee2652ed11c1cd",
    description: "Better reasoning than the default while still light on resources.",
    compatibilityHint: "Most modern PCs",
    imageModel: QWEN35_2B_IMAGE_MODEL,
  },
  {
    id: "qwen35-4b-iq4-xs",
    slot: "chat",
    label: "4B - balanced",
    filename: "Qwen3.5-4B-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-IQ4_XS.gguf",
    sizeBytes: 2_477_053_088,
    sha256: "658a9e7e406deb06d0179755e3c14f6a82915a4be4962a2f92a64d948d2e572f",
    description: "Stronger summaries and category reasoning for typical workloads.",
    compatibilityHint: "Needs 8+ GB RAM",
    imageModel: QWEN35_4B_IMAGE_MODEL,
  },
  {
    id: "qwen35-9b-iq4-xs",
    slot: "chat",
    label: "9B - high quality",
    filename: "Qwen3.5-9B-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-IQ4_XS.gguf",
    sizeBytes: 5_168_653_536,
    sha256: "7e918aeca06c52bcb528ea6b04b4ec957e75ee8c0a73138854c0dfcf371ea429",
    description: "High-quality chat model for capable laptops and desktops.",
    compatibilityHint: "Needs 16+ GB RAM",
    imageModel: QWEN35_9B_IMAGE_MODEL,
  },
  {
    id: "qwen35-27b-iq4-xs",
    slot: "chat",
    label: "27B - workstation only",
    filename: "Qwen3.5-27B-IQ4_XS.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-27B-GGUF/resolve/main/Qwen3.5-27B-IQ4_XS.gguf",
    sizeBytes: 14_977_484_704,
    sha256: "fb829c84491b30cda875b7366e29ce3e4cede19b40daf5b824003936bfc4dbbb",
    description: "Maximum local quality for powerful workstations with lots of RAM.",
    compatibilityHint: "Needs 32+ GB RAM",
    imageModel: QWEN35_27B_IMAGE_MODEL,
  },
  {
    id: "qwen3-embedding-06b-q8",
    slot: "embed",
    label: "Qwen3 Embedding 0.6B",
    filename: "Qwen3-Embedding-0.6B-Q8_0.gguf",
    url: "https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-Q8_0.gguf",
    sizeBytes: 639_150_592,
    sha256: "06507c7b42688469c4e7298b0a1e16deff06caf291cf0a5b278c308249c3e439",
    description: "Required search and similarity model for notes and organization.",
    compatibilityHint: "Runs on most PCs",
    locked: true,
  },
  {
    id: "qwen35-mmproj-f16",
    slot: "mmproj",
    label: "Image understanding model",
    filename: "mmproj-Qwen3.5-0.8B-F16.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/mmproj-F16.gguf",
    sizeBytes: 204_987_232,
    sha256: "56e4c6cfe73b0c82e3e82bc518d7591997e61d81f723fc41a586f4fa69ea2453",
    description: "Default image-understanding companion for the 0.8B chat model. Each larger model has its own — install separately under the model.",
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
  const imageModel = chatModel.imageModel ?? QWEN35_08B_IMAGE_MODEL;
  return {
    ...MMPROJ_MODEL,
    filename: imageModel.filename,
    url: imageModel.url,
    sizeBytes: imageModel.sizeBytes,
    sha256: imageModel.sha256,
    compatibilityHint: imageModel.compatibilityHint ?? MMPROJ_MODEL.compatibilityHint,
  };
}
