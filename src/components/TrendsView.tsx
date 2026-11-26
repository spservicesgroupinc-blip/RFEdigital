import { useMemo, useState } from 'react';
import { filterTrendOpportunities } from '../lib/workspaceLogic';
import { ScanControls, OpportunityList, SavedScansList } from './trends';
import type {
  GenerationProvider,
  TrendDeepDive,
  TrendMarketplace,
  TrendOpportunity,
  TrendProductType,
  TrendScanResult,
  TrendTimeHorizon,
  WorkspaceSettings,
} from '../types/workspace';

interface TrendsViewProps {
  scans: TrendScanResult[];
  settings: WorkspaceSettings;
  onRunScan: (payload: {
    marketplaces: TrendMarketplace[];
    productTypes: TrendProductType[];
    timeHorizon: TrendTimeHorizon;
    customTopic: string;
    provider: GenerationProvider;
  }) => Promise<TrendScanResult>;
  onRunDeepDive: (payload: {
    scanId: string;
    opportunityId: string;
    opportunity: TrendOpportunity;
    provider: GenerationProvider;
  }) => Promise<TrendDeepDive>;
  onDeleteScan: (scanId: string) => Promise<void>;
  onCreateProjectFromTrend: (payload: {
    scanId: string;
    opportunityId: string;
    opportunity: TrendOpportunity;
    deepDive?: TrendDeepDive;
  }) => Promise<void>;
  onOpenExistingProject: (productId: string) => void;
}

const ALL_MARKETPLACES: TrendMarketplace[] = ['Amazon KDP', 'Etsy', 'Teachers Pay Teachers', 'Gumroad'];

const PRODUCT_TYPE_OPTIONS: Array<{ id: TrendProductType; label: string }> = [
  { id: 'childrens-book', label: "Children's Books" },
  { id: 'coloring-book', label: 'Coloring & Activity' },
  { id: 'wall-art', label: 'Printable Wall Art' },
  { id: 'flashcards', label: 'Flashcards & Worksheets' },
  { id: 'ebook-planner', label: 'Planners & Guides' },
];

const QUICK_PRESETS: Array<{
  label: string;
  marketplaces: TrendMarketplace[];
  productTypes: TrendProductType[];
  timeHorizon: TrendTimeHorizon;
  customTopic: string;
}> = [
  {
    label: 'KDP Picture & Coloring (Selling Now)',
    marketplaces: ['Amazon KDP', 'Etsy'],
    productTypes: ['childrens-book', 'coloring-book'],
    timeHorizon: 'selling_now',
    customTopic: '',
  },
  {
    label: 'Upcoming 60–90d Seasonal Peaks',
    marketplaces: ['Amazon KDP', 'Etsy', 'Teachers Pay Teachers'],
    productTypes: ['coloring-book', 'childrens-book', 'wall-art'],
    timeHorizon: 'upcoming_seasonal',
    customTopic: '',
  },
  {
    label: 'Etsy & TpT Printables / Flashcards',
    marketplaces: ['Etsy', 'Teachers Pay Teachers', 'Gumroad'],
    productTypes: ['wall-art', 'flashcards', 'ebook-planner'],
    timeHorizon: 'selling_now',
    customTopic: '',
  },
];

export function TrendsView({
  scans,
  settings,
  onRunScan,
  onRunDeepDive,
  onDeleteScan,
  onCreateProjectFromTrend,
  onOpenExistingProject,
}: TrendsViewProps) {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<TrendMarketplace[]>([
    'Amazon KDP',
    'Etsy',
  ]);
  const [selectedProductTypes, setSelectedProductTypes] = useState<TrendProductType[]>([
    'childrens-book',
    'coloring-book',
    'wall-art',
  ]);
  const [timeHorizon, setTimeHorizon] = useState<TrendTimeHorizon>('selling_now');
  const [customTopic, setCustomTopic] = useState('');
  const [provider, setProvider] = useState<GenerationProvider>(
    settings.openRouterConfigured ? 'openrouter' : 'gemini'
  );

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [activeScanId, setActiveScanId] = useState<string | null>(scans[0]?.id ?? null);

  const [deepDivingId, setDeepDivingId] = useState<string | null>(null);
  const [expandedDeepDives, setExpandedDeepDives] = useState<Record<string, boolean>>({});
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);
  const [deepDiveErrors, setDeepDiveErrors] = useState<Record<string, string>>({});

  const [filterType, setFilterType] = useState<TrendProductType | 'all'>('all');
  const [filterMarketplace, setFilterMarketplace] = useState<string | 'all'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'competition'>('score');

  const activeScan = useMemo(() => {
    if (scans.length === 0) return null;
    return scans.find((s) => s.id === activeScanId) ?? scans[0];
  }, [scans, activeScanId]);

  const filteredOpportunities = useMemo(() => {
    if (!activeScan) return [];
    return filterTrendOpportunities(activeScan.opportunities, {
      productType: filterType,
      marketplace: filterMarketplace,
      sortBy,
    });
  }, [activeScan, filterType, filterMarketplace, sortBy]);

  const toggleMarketplace = (mp: TrendMarketplace) => {
    setSelectedMarketplaces((prev) =>
      prev.includes(mp) ? (prev.length > 1 ? prev.filter((item) => item !== mp) : prev) : [...prev, mp]
    );
  };

  const toggleProductType = (pt: TrendProductType) => {
    setSelectedProductTypes((prev) =>
      prev.includes(pt) ? (prev.length > 1 ? prev.filter((item) => item !== pt) : prev) : [...prev, pt]
    );
  };

  const applyPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    setSelectedMarketplaces(preset.marketplaces);
    setSelectedProductTypes(preset.productTypes);
    setTimeHorizon(preset.timeHorizon);
    setCustomTopic(preset.customTopic);
  };

  const handleRunScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (selectedMarketplaces.length === 0 || selectedProductTypes.length === 0) {
      setScanError('Select at least one marketplace and one product type.');
      return;
    }
    setScanError('');
    setScanning(true);
    try {
      const result = await onRunScan({
        marketplaces: selectedMarketplaces,
        productTypes: selectedProductTypes,
        timeHorizon,
        customTopic: customTopic.trim(),
        provider,
      });
      setActiveScanId(result.id);
      setFilterType('all');
      setFilterMarketplace('all');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Live market scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleDeepDive = async (opp: TrendOpportunity) => {
    if (!activeScan) return;
    setDeepDivingId(opp.id);
    setDeepDiveErrors((prev) => ({ ...prev, [opp.id]: '' }));
    try {
      await onRunDeepDive({
        scanId: activeScan.id,
        opportunityId: opp.id,
        opportunity: opp,
        provider,
      });
      setExpandedDeepDives((prev) => ({ ...prev, [opp.id]: true }));
    } catch (err) {
      setDeepDiveErrors((prev) => ({
        ...prev,
        [opp.id]: err instanceof Error ? err.message : 'Deep-dive search failed.',
      }));
    } finally {
      setDeepDivingId(null);
    }
  };

  const handleConvertToProject = async (opp: TrendOpportunity) => {
    if (!activeScan) return;
    setCreatingProjectId(opp.id);
    try {
      await onCreateProjectFromTrend({
        scanId: activeScan.id,
        opportunityId: opp.id,
        opportunity: opp,
        deepDive: opp.deep_dive,
      });
    } finally {
      setCreatingProjectId(null);
    }
  };

  const toggleDeepDive = (oppId: string) => {
    setExpandedDeepDives((prev) => ({ ...prev, [oppId]: !prev[oppId] }));
  };

  return (
    <div className="space-y-6">
      <ScanControls
        allMarketplaces={ALL_MARKETPLACES}
        productTypeOptions={PRODUCT_TYPE_OPTIONS}
        quickPresets={QUICK_PRESETS}
        selectedMarketplaces={selectedMarketplaces}
        selectedProductTypes={selectedProductTypes}
        timeHorizon={timeHorizon}
        customTopic={customTopic}
        provider={provider}
        scanning={scanning}
        scanError={scanError}
        settings={settings}
        onToggleMarketplace={toggleMarketplace}
        onToggleProductType={toggleProductType}
        onTimeHorizonChange={setTimeHorizon}
        onCustomTopicChange={setCustomTopic}
        onProviderChange={setProvider}
        onApplyPreset={applyPreset}
        onRunScan={handleRunScan}
      />

      <SavedScansList
        scans={scans}
        activeScanId={activeScan?.id ?? null}
        onSelect={setActiveScanId}
        onDelete={onDeleteScan}
      />

      <OpportunityList
        activeScan={activeScan}
        opportunities={filteredOpportunities}
        productTypeOptions={PRODUCT_TYPE_OPTIONS}
        allMarketplaces={ALL_MARKETPLACES}
        filterType={filterType}
        filterMarketplace={filterMarketplace}
        sortBy={sortBy}
        deepDivingId={deepDivingId}
        creatingProjectId={creatingProjectId}
        expandedDeepDives={expandedDeepDives}
        deepDiveErrors={deepDiveErrors}
        onFilterTypeChange={setFilterType}
        onFilterMarketplaceChange={setFilterMarketplace}
        onSortByChange={setSortBy}
        onRunDeepDive={handleDeepDive}
        onToggleDeepDive={toggleDeepDive}
        onCreateProject={handleConvertToProject}
        onOpenExistingProject={onOpenExistingProject}
      />
    </div>
  );
}
