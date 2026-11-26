import { Card } from '../ui/Card';
import { KpiCard } from '../ui/KpiCard';
import type { Series, StorageAsset, WorkspaceSettings } from '../../types/workspace';

interface KpiSummaryProps {
  products: { status: string }[];
  series: Series[];
  assets: StorageAsset[];
  settings: WorkspaceSettings;
  googleConnected: boolean;
}

export function KpiSummary({ products, series, assets, settings, googleConnected }: KpiSummaryProps) {
  const readyOrPublished = products.filter(
    (p) => p.status === 'ready-for-kdp' || p.status === 'published'
  ).length;

  return (
    <Card variant="default" className="overflow-hidden">
      <div className="grid grid-cols-2 divide-y divide-border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <KpiCard
          label="Catalog Titles"
          value={products.length}
          hint={`Across ${series.length} active series`}
        />
        <KpiCard
          label="Ready for KDP / Live"
          value={readyOrPublished}
          hint="Print specifications validated"
        />
        <KpiCard label="Stored Media Assets" value={assets.length} hint="Covers, spreads & line plates" />
        <div className="bg-surface px-5 py-4">
          <div className="text-xs font-medium text-text-muted">Google Sheets Library</div>
          <div className="mt-1 text-sm font-semibold text-text">
            {settings.connectedSpreadsheetId ? 'Spreadsheet linked' : 'Not linked yet'}
          </div>
        </div>
      </div>
    </Card>
  );
}
