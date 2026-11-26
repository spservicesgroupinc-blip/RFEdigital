import type {
  ExportArtifact,
  KdpTrimSize,
  PageTextLayout,
  Product,
  StorageAsset,
} from '../types/workspace';
import type { KdpPageDimensions } from '../lib/workspaceLogic';
import { ExportPanel } from './studio/ExportPanel';

export interface StudioDownloadPanelProps {
  product: Product;
  exportTrim: KdpTrimSize;
  setExportTrim: React.Dispatch<React.SetStateAction<KdpTrimSize>>;
  dims: KdpPageDimensions;
  exportBleed: boolean;
  setExportBleed: React.Dispatch<React.SetStateAction<boolean>>;
  includeTitlePage: boolean;
  setIncludeTitlePage: React.Dispatch<React.SetStateAction<boolean>>;
  includeCoverTitle: boolean;
  setIncludeCoverTitle: React.Dispatch<React.SetStateAction<boolean>>;
  pageLayout: PageTextLayout;
  setPageLayout: React.Dispatch<React.SetStateAction<PageTextLayout>>;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  productAssets: StorageAsset[];
  latestArtifact: ExportArtifact | null;
  downloadingId: string | null;
  buildingPdf: boolean;
  buildingZip: boolean;
  driveUploadingId: string | null;
  setDriveUploadingId: React.Dispatch<React.SetStateAction<string | null>>;
  productExports: ExportArtifact[];
  googleConnected: boolean;
  handleBuildPdf: () => Promise<void>;
  handleBuildZip: () => Promise<void>;
  handleDownloadExport: (exp: ExportArtifact) => Promise<void>;
  handlePreviewPdf: (exp: ExportArtifact) => Promise<void>;
  onUploadArtifactToDrive: (artifactId: string) => Promise<void>;
  onBackToGenerate: () => void;
}

/** Tab 3 - Download: KDP PDF / PNG bundle export and finished downloads list. */
export function StudioDownloadPanel(props: StudioDownloadPanelProps) {
  return <ExportPanel {...props} />;
}
