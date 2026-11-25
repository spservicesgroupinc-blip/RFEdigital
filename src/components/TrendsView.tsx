import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderPlus,
  Loader2,
  Microscope,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react';
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
import { filterTrendOpportunities, sanitizeSourceUrl } from '../lib/workspaceLogic';

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

const ALL_MARKETPLACES: TrendMarketplace[] = [
  'Amazon KDP',
  'Etsy',
  'Teachers Pay Teachers',
  'Gumroad',
];

const PRODUCT_TYPE_OPTIONS: Array<{ id: TrendProductType; label: string }> = [
  { id: 'childrens-book', label: "Children's Books" },
  { id: 'coloring-book', label: 'Coloring & Activity' },
  { id: 'wall-art', label: 'Printable Wall Art' },
  { id: 'flashcards', label: 'Flashcards & Worksheets' },
  { id: 'ebook-planner', label: 'Planners & Guides' },
];

const PRODUCT_TYPE_LABELS: Record<TrendProductType, string> = {
  'childrens-book': "Children's Picture Book",
  'coloring-book': 'Coloring & Activity Book',
  'wall-art': 'Printable Wall Art / Stickers',
  flashcards: 'Flashcards / Worksheets',
  'ebook-planner': 'Planner / Niche Ebook',
};

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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getDemandColor(level: TrendOpportunity['demand_level']): string {
  if (level === 'High') return 'text-emerald-700';
  if (level === 'Emerging') return 'text-blue-700';
  return 'text-slate-700';
}

function getCompetitionColor(level: TrendOpportunity['competition_level']): string {
  if (level === 'Low') return 'text-emerald-700';
  if (level === 'High') return 'text-amber-700';
  return 'text-slate-700';
}

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

  // Per-opportunity deep-dive & project creation states
  const [deepDivingId, setDeepDivingId] = useState<string | null>(null);
  const [expandedDeepDives, setExpandedDeepDives] = useState<Record<string, boolean>>({});
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);
  const [deepDiveErrors, setDeepDiveErrors] = useState<Record<string, string>>({});

  // Results filtering & sorting
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

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Live Web Market Research Controls */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Current Trends Research
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Run live web searches across Amazon KDP, Etsy, Teachers Pay Teachers, and Gumroad to find
              verified niche demand. Click any winning trend to auto-generate editable prompts for your cover,
              story copy, KDP listing, and interior pages.
            </p>
          </div>
          <div className="shrink-0 font-mono text-xs text-slate-500 tabular-nums">
            Research date · {todayIso}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Quick presets:</span>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleRunScan} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Marketplaces */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Marketplaces
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ALL_MARKETPLACES.map((mp) => {
                  const active = selectedMarketplaces.includes(mp);
                  return (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => toggleMarketplace(mp)}
                      aria-pressed={active}
                      className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                        active
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {mp}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Types */}
            <div className="lg:col-span-7">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product Types
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRODUCT_TYPE_OPTIONS.map((pt) => {
                  const active = selectedProductTypes.includes(pt.id);
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => toggleProductType(pt.id)}
                      aria-pressed={active}
                      className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                        active
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {pt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 md:grid-cols-12">
            {/* Time Horizon */}
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700">Time Horizon</label>
              <div className="mt-1.5 grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setTimeHorizon('selling_now')}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    timeHorizon === 'selling_now'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Selling Now
                </button>
                <button
                  type="button"
                  onClick={() => setTimeHorizon('upcoming_seasonal')}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    timeHorizon === 'upcoming_seasonal'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  60–90d Seasonal
                </button>
              </div>
            </div>

            {/* Custom Topic / Audience */}
            <div className="md:col-span-5">
              <label htmlFor="trends-topic" className="block text-xs font-medium text-slate-700">
                Optional Topic or Audience Filter
              </label>
              <input
                id="trends-topic"
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g., Montessori toddlers, cozy cottagecore, ADHD planners"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </div>

            {/* Search Engine Provider */}
            <div className="md:col-span-3">
              <label htmlFor="trends-provider" className="block text-xs font-medium text-slate-700">
                Live Search Engine
              </label>
              <select
                id="trends-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as GenerationProvider)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                <option value="gemini">
                  Gemini Live Web Search {settings.geminiConfigured ? '' : '(Needs Key)'}
                </option>
                <option value="openrouter">
                  OpenRouter Web Search {settings.openRouterConfigured ? '' : '(Needs Key)'}
                </option>
              </select>
            </div>
          </div>

          {scanError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {scanError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Observed marketplace signals are cited with live source URLs; sales velocity estimates are
              explicitly labeled as estimates.
            </p>
            <button
              type="submit"
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Searching live marketplaces…
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Run Live Market Scan
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Saved Research Scans Switcher */}
      {scans.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Saved Research Scans ({scans.length})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {scans.map((scan) => {
                const isSelected = activeScan?.id === scan.id;
                const label = scan.query.customTopic
                  ? `${scan.query.customTopic}`
                  : scan.query.timeHorizon === 'upcoming_seasonal'
                    ? 'Upcoming Seasonal'
                    : 'Selling Now';
                return (
                  <div
                    key={scan.id}
                    className={`inline-flex items-center rounded-md border text-xs ${
                      isSelected
                        ? 'border-blue-700 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveScanId(scan.id)}
                      className="px-2.5 py-1.5 font-medium"
                    >
                      {label} · <span className="font-mono tabular-nums">{scan.opportunities.length}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete scan ${label}`}
                      onClick={() => onDeleteScan(scan.id)}
                      className="border-l border-slate-200 px-2 py-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Results Area */}
      {!activeScan ? (
        <section className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <TrendingUp className="mx-auto h-7 w-7 text-blue-700" aria-hidden="true" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            Ready to scan live digital product trends
          </h3>
          <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
            Choose your target marketplaces and product formats above, then run a live web market scan.
            You’ll receive 6–8 ranked micro-niches backed by real search citations, separated observed proof
            vs. velocity estimates, and one-click Studio project creation.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {/* Market Summary & Filter Bar */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="break-words text-xs font-medium text-slate-500">
                  Market Summary · {formatDateTime(activeScan.researched_at)} ·{' '}
                  <span className="font-mono">{activeScan.model}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                  {activeScan.market_summary}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by product type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TrendProductType | 'all')}
                  className="max-w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-700 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  {PRODUCT_TYPE_OPTIONS.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by marketplace"
                  value={filterMarketplace}
                  onChange={(e) => setFilterMarketplace(e.target.value)}
                  className="max-w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-700 focus:outline-none"
                >
                  <option value="all">All Marketplaces</option>
                  {ALL_MARKETPLACES.map((mp) => (
                    <option key={mp} value={mp}>
                      {mp}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Sort opportunities"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'score' | 'competition')}
                  className="max-w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-700 focus:outline-none"
                >
                  <option value="score">Sort: Highest Opportunity Score</option>
                  <option value="competition">Sort: Lowest Competition First</option>
                </select>
              </div>
            </div>
          </section>

          {/* Ranked Opportunity Cards */}
          {filteredOpportunities.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              No trend opportunities match the active filter combination.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map((opp, idx) => {
                const isDeepDiving = deepDivingId === opp.id;
                const isCreating = creatingProjectId === opp.id;
                const deepDive = opp.deep_dive;
                const deepDiveExpanded = Boolean(expandedDeepDives[opp.id]);
                const deepDiveError = deepDiveErrors[opp.id];

                return (
                  <article
                    key={opp.id}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
                            #{idx + 1}
                          </span>
                          <h3 className="font-display text-base font-semibold text-slate-900">
                            {opp.title}
                          </h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {PRODUCT_TYPE_LABELS[opp.product_type]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{opp.marketplaces.join(', ')}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-700 tabular-nums">
                            {opp.price_range_usd}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{opp.seasonality}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs sm:gap-5">
                        <div>
                          <div className="text-[11px] text-slate-400">Demand</div>
                          <div className={`font-semibold ${getDemandColor(opp.demand_level)}`}>
                            {opp.demand_level}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">Competition</div>
                          <div
                            className={`font-semibold ${getCompetitionColor(opp.competition_level)}`}
                          >
                            {opp.competition_level}
                          </div>
                        </div>
                        <div className="border-l border-slate-200 pl-4 text-right">
                          <div className="text-[11px] text-slate-400">Opportunity</div>
                          <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                            {opp.opportunity_score}
                            <span className="text-xs font-normal text-slate-400">/100</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Two-Column Body: Sales Evidence vs. Angle & Starter Blueprint */}
                    <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                      {/* Column 1: Observed Signals vs. Estimated Velocity */}
                      <div className="min-w-0 space-y-4 p-5 sm:p-6 lg:col-span-6">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Observed Live Signals
                          </div>
                          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700">
                            {opp.sales_evidence.observed_signals.map((sig, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1 text-blue-700" aria-hidden="true">
                                  •
                                </span>
                                <span>{sig}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="border-t border-slate-100 pt-3.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold uppercase tracking-wide text-slate-500">
                              Estimated Velocity (Estimate)
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              Confidence: {opp.sales_evidence.confidence}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-700">
                            {opp.sales_evidence.estimated_velocity}
                          </p>
                        </div>

                        {opp.buyer_pain_points.length > 0 && (
                          <div className="border-t border-slate-100 pt-3.5">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Buyer Pain Points
                            </div>
                            <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                              {opp.buyer_pain_points.map((pain, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="text-amber-700" aria-hidden="true">
                                    –
                                  </span>
                                  <span>{pain}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Column 2: Winning Angle & Starter Blueprint */}
                      <div className="min-w-0 space-y-4 p-5 sm:p-6 lg:col-span-6">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Winning Studio Angle
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-800">
                            {opp.winning_angle}
                          </p>
                        </div>

                        <div className="border-t border-slate-100 pt-3.5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Starter Blueprint
                          </div>
                          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                            <div>
                              <dt className="text-slate-400">Audience</dt>
                              <dd className="mt-0.5 font-medium text-slate-800">
                                {opp.starter_blueprint.target_age_or_audience}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-400">Trim Size</dt>
                              <dd className="mt-0.5 font-mono font-medium text-slate-800">
                                {opp.starter_blueprint.suggested_trim_size}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-400">Pages</dt>
                              <dd className="mt-0.5 font-mono font-medium text-slate-800 tabular-nums">
                                {opp.starter_blueprint.suggested_page_count} pp
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                            <div>
                              <span className="font-medium text-slate-900">Hook: </span>
                              {opp.starter_blueprint.hook_concept}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900">Art Direction: </span>
                              {opp.starter_blueprint.art_style_direction}
                            </div>
                            {opp.starter_blueprint.seed_keywords.length > 0 && (
                              <div className="text-slate-600">
                                <span className="font-medium text-slate-900">Keywords: </span>
                                <span className="font-mono text-[11px]">
                                  {opp.starter_blueprint.seed_keywords.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Verified Source Links */}
                        {opp.sources.length > 0 && (
                          <div className="border-t border-slate-100 pt-3.5">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Live Search Sources
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                              {opp.sources.map((src, i) => {
                                const safeHref = sanitizeSourceUrl(src.url);
                                if (!safeHref) return null;
                                return (
                                  <a
                                    key={i}
                                    href={safeHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline"
                                  >
                                    <span className="max-w-[200px] truncate sm:max-w-[240px]">{src.title}</span>
                                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {deepDiveError && (
                      <div className="border-t border-red-200 bg-red-50 px-6 py-2.5 text-xs text-red-800">
                        {deepDiveError}
                      </div>
                    )}

                    {/* Inline Competitive Deep-Dive Report */}
                    {deepDive && deepDiveExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                            <Microscope className="h-4 w-4 text-blue-700" aria-hidden="true" />
                            Niche Competitive Deep-Dive
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatDateTime(deepDive.researched_at)} · {deepDive.model}
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed text-slate-700">{deepDive.summary}</p>

                        {/* Price Ladder */}
                        <div className="grid grid-cols-1 gap-3 border-y border-slate-200 py-3 sm:grid-cols-4 text-xs">
                          <div>
                            <div className="text-slate-400">Entry Tier</div>
                            <div className="mt-0.5 font-mono font-medium text-slate-800">
                              {deepDive.price_ladder.entry_tier}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">Mid Tier</div>
                            <div className="mt-0.5 font-mono font-medium text-slate-800">
                              {deepDive.price_ladder.mid_tier}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">Premium Tier</div>
                            <div className="mt-0.5 font-mono font-medium text-slate-800">
                              {deepDive.price_ladder.premium_tier}
                            </div>
                          </div>
                          <div>
                            <div className="text-blue-700 font-medium">Recommended Price</div>
                            <div className="mt-0.5 font-mono font-semibold text-blue-900">
                              {deepDive.price_ladder.recommended_price}
                            </div>
                          </div>
                        </div>

                        {/* Top Competing Listings */}
                        {deepDive.top_competing_listings.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Observed Competing Listings
                            </div>
                            <div className="mt-2 overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500">
                                    <th className="py-2 pr-4 font-medium">Listing</th>
                                    <th className="py-2 pr-4 font-medium">Marketplace</th>
                                    <th className="py-2 pr-4 font-medium">Observed Price</th>
                                    <th className="py-2 font-medium">Observed Signal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {deepDive.top_competing_listings.map((item, i) => {
                                    const safeHref = sanitizeSourceUrl(item.url);
                                    return (
                                      <tr key={i}>
                                        <td className="py-2 pr-4 font-medium text-slate-900">
                                          {safeHref ? (
                                            <a
                                              href={safeHref}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                                            >
                                              <span>{item.title}</span>
                                              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            </a>
                                          ) : (
                                            item.title
                                          )}
                                        </td>
                                        <td className="py-2 pr-4 text-slate-600">{item.marketplace}</td>
                                        <td className="py-2 pr-4 font-mono text-slate-800 tabular-nums">
                                          {item.observed_price}
                                        </td>
                                        <td className="py-2 text-slate-600">{item.observed_signal}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
                          <div>
                            <div className="font-semibold uppercase tracking-wide text-slate-500">
                              Recurring Review Complaints
                            </div>
                            <ul className="mt-1.5 space-y-1 text-slate-700">
                              {deepDive.recurring_buyer_complaints.map((c, i) => (
                                <li key={i}>– {c}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <div className="font-semibold uppercase tracking-wide text-slate-500">
                                High-Intent Search Keywords
                              </div>
                              <p className="mt-1 font-mono text-[11px] leading-relaxed text-slate-700">
                                {deepDive.high_intent_keywords.join(', ')}
                              </p>
                            </div>
                            <div>
                              <div className="font-semibold uppercase tracking-wide text-slate-500">
                                Concrete Differentiation Plan
                              </div>
                              <p className="mt-1 leading-relaxed text-slate-800">
                                {deepDive.differentiation_angle}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {deepDive ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedDeepDives((prev) => ({
                                  ...prev,
                                  [opp.id]: !prev[opp.id],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {deepDiveExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {deepDiveExpanded ? 'Hide Deep-Dive' : 'Show Deep-Dive Report'}
                            </button>
                            <button
                              type="button"
                              disabled={isDeepDiving}
                              onClick={() => handleDeepDive(opp)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                            >
                              {isDeepDiving ? 'Refreshing…' : 'Refresh Deep-Dive'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={isDeepDiving}
                            onClick={() => handleDeepDive(opp)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-55"
                          >
                            {isDeepDiving ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                Running live deep-dive…
                              </>
                            ) : (
                              <>
                                <Microscope className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                                Deep-Dive Niche
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {opp.created_project_id ? (
                          <button
                            type="button"
                            onClick={() => onOpenExistingProject(opp.created_project_id!)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 whitespace-nowrap shrink-0"
                          >
                            Edit Prompts &amp; Build
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isCreating}
                            onClick={() => handleConvertToProject(opp)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                          >
                            {isCreating ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                Generating editable prompts…
                              </>
                            ) : (
                              <>
                                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                                Use Trend &amp; Generate Prompts
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
