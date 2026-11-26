import type {
  KdpTrimSize,
  Product,
  ProductCategory,
  StorageAsset,
} from '../types/workspace';
import { ConceptForm } from './studio/ConceptForm';

export interface StudioConceptPanelProps {
  creatingNew: boolean;
  product: Product | null;
  title: string;
  subtitle: string;
  category: ProductCategory;
  trimSize: KdpTrimSize;
  pageCount: string;
  includeBleed: boolean;
  targetAudience: string;
  conceptSummary: string;
  artStylePreset: string;
  newRefPhoto: { name: string; mimeType: string; dataUrl: string } | null;
  refPhotoInputRef: React.RefObject<HTMLInputElement | null>;
  savedReferenceAsset: StorageAsset | null;
  generatingPack: boolean;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setSubtitle: React.Dispatch<React.SetStateAction<string>>;
  setCategory: React.Dispatch<React.SetStateAction<ProductCategory>>;
  setTrimSize: React.Dispatch<React.SetStateAction<KdpTrimSize>>;
  setPageCount: React.Dispatch<React.SetStateAction<string>>;
  setIncludeBleed: React.Dispatch<React.SetStateAction<boolean>>;
  setTargetAudience: React.Dispatch<React.SetStateAction<string>>;
  setConceptSummary: React.Dispatch<React.SetStateAction<string>>;
  setArtStylePreset: React.Dispatch<React.SetStateAction<string>>;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleStep1SaveAndGeneratePrompts: (e: React.FormEvent) => Promise<void>;
  onSkipToGenerate: () => void;
}

/** Tab 1 — Concept & Specs form. Presentation lives in studio/ConceptForm. */
export function StudioConceptPanel(props: StudioConceptPanelProps) {
  return <ConceptForm {...props} />;
}
