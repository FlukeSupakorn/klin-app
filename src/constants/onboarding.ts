import type { Category, OnboardingStep } from "@/types/onboarding";

// Remove this later, just for testing
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "photos-media",
    name: "Photos & Media",
    icon: "Image",
    description: "Photos, videos, screenshots, and other media files",
    color: "#06b6d4",
    isDefault: true,
  },
  {
    id: "creative-projects",
    name: "Creative Projects",
    icon: "Palette",
    description: "Creative and artistic works including writing, design, and media production",
    color: "#ec4899",
    isDefault: true,
  },
  {
    id: "work-business",
    name: "Work & Business",
    icon: "Briefcase",
    description: "Professional work documents, business files, and project planning materials",
    color: "#3b82f6",
    isDefault: true,
  },
  {
    id: "finance-invoices",
    name: "Finance & Invoices",
    icon: "Receipt",
    description: "Financial records, billing documents, and payment information",
    color: "#22c55e",
    isDefault: true,
  },
  {
    id: "legal-contracts",
    name: "Legal & Contracts",
    icon: "Scale",
    description: "Legal agreements, contracts, and official documents",
    color: "#64748b",
    isDefault: true,
  },
  {
    id: "education-research",
    name: "Education & Research",
    icon: "GraduationCap",
    description: "Learning materials, academic papers, and research documents",
    color: "#f59e0b",
    isDefault: true,
  },
  {
    id: "personal",
    name: "Personal",
    icon: "User",
    description: "Private personal files, identification, and daily life documents",
    color: "#a855f7",
    isDefault: true,
  },
  {
    id: "travel",
    name: "Travel",
    icon: "Plane",
    description: "Travel bookings, itineraries, and travel documents",
    color: "#0ea5e9",
    isDefault: true,
  },
  {
    id: "health-medical",
    name: "Health & Medical",
    icon: "HeartPulse",
    description: "Medical reports, prescriptions, and healthcare documents",
    color: "#ef4444",
    isDefault: true,
  },
  {
    id: "general-documents",
    name: "General Documents",
    icon: "FileText",
    description: "Unclassified or mixed documents that do not fit another category",
    color: "#78716c",
    isDefault: true,
  },
];

export const STEPS: { id: OnboardingStep; label: string; shortLabel: string }[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Welcome" },
  { id: "base-path", label: "Base Path", shortLabel: "Base Path" },
  { id: "categories", label: "Categories", shortLabel: "Categories" },
  { id: "watcher", label: "Watcher", shortLabel: "Watcher" },
  { id: "complete", label: "All Set", shortLabel: "Done" },
];
