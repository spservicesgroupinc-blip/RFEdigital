import { Search, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { GenerationProvider, TrendMarketplace, TrendProductType, TrendTimeHorizon } from '../../types/workspace';

interface QuickPreset {
  label: string;
  marketplaces: TrendMarketplace[];
  productTypes: TrendProductType[];
  timeHorizon: TrendTimeHorizon;
  customTopic: string;
}

interface ScanControlsProps {
  allMarketplaces: TrendMarketplace[];
  productTypeOptions: Array<{ id: TrendProductType; label: string }>;
  quickPresets: QuickPreset[];
  selectedMarketplaces: TrendMarketplace[];
  selectedProductTypes: TrendProductType[];
  timeHorizon: TrendTimeHorizon;
  customTopic: string;
  provider: GenerationProvider;
  scanning: boolean;
  scanError: string;
  settings: { geminiConfigured: boolean; openRouterConfigured: boolean };
  onToggleMarketplace: (mp: TrendMarketplace) => void;
  onToggleProductType: (pt: TrendProductType) => void;
  onTimeHorizonChange: (value: TrendTimeHorizon) => void;
  onCustomTopicChange: (value: string) => void;
  onProviderChange: (value: GenerationProvider) => void;
  onApplyPreset: (preset: QuickPreset) => void;
  onRunScan: (e?: React.FormEvent) => void;
}

export function ScanControls({
  allMarketplaces,
  productTypeOptions,
  quickPresets,
  selectedMarketplaces,
  selectedProductTypes,
  timeHorizon,
  customTopic,
  provider,
  scanning,
  scanError,
  settings,
  onToggleMarketplace,
  onToggleProductType,
  onTimeHorizonChange,
  onCustomTopicChange,
  onProviderChange,
  onApplyPreset,
  onRunScan,
}: ScanControlsProps) {
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-display text-lg font-semibold text-text">Current Trends Research</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Run live web searches across Amazon KDP, Etsy, Teachers Pay Teachers, and Gumroad to find verified
            niche demand. Click any winning trend to auto-generate editable prompts for your cover, story copy,
            KDP listing, and interior pages.
          </p>
        </div>
        <div className="shrink-0 font-mono text-xs text-text-muted tabular-nums">
          Research date · {todayIso}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Quick presets:</span>
        {quickPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onApplyPreset(preset)}
            className="rounded-md border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-tertiary"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form onSubmit={onRunScan} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Marketplaces */}
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Marketplaces
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {allMarketplaces.map((mp) => {
                const active = selectedMarketplaces.includes(mp);
                return (
                  <button
                    key={mp}
                    type="button"
                    onClick={() => onToggleMarketplace(mp)}
                    aria-pressed={active}
                    className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                      active
                        ? 'border-primary bg-primary-subtle text-primary-900'
                        : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-secondary'
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Product Types
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {productTypeOptions.map((pt) => {
                const active = selectedProductTypes.includes(pt.id);
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => onToggleProductType(pt.id)}
                    aria-pressed={active}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                      active
                        ? 'border-primary bg-primary-subtle text-primary-900'
                        : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-secondary'
                    }`}
                  >
                    {pt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 md:grid-cols-12">
          {/* Time Horizon */}
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-text-secondary">Time Horizon</label>
            <div className="mt-1.5 grid grid-cols-2 rounded-md border border-border-strong bg-surface-tertiary p-0.5">
              <button
                type="button"
                onClick={() => onTimeHorizonChange('selling_now')}
                className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  timeHorizon === 'selling_now'
                    ? 'bg-surface text-text shadow-sm'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                Selling Now
              </button>
              <button
                type="button"
                onClick={() => onTimeHorizonChange('upcoming_seasonal')}
                className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  timeHorizon === 'upcoming_seasonal'
                    ? 'bg-surface text-text shadow-sm'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                60–90d Seasonal
              </button>
            </div>
          </div>

          {/* Custom Topic / Audience */}
          <div className="md:col-span-5">
            <label htmlFor="trends-topic" className="block text-xs font-medium text-text-secondary">
              Optional Topic or Audience Filter
            </label>
            <Input
              id="trends-topic"
              type="text"
              value={customTopic}
              onChange={(e) => onCustomTopicChange(e.target.value)}
              placeholder="e.g., Montessori toddlers, cozy cottagecore, ADHD planners"
              className="mt-1.5"
            />
          </div>

          {/* Search Engine Provider */}
          <div className="md:col-span-3">
            <label htmlFor="trends-provider" className="block text-xs font-medium text-text-secondary">
              Live Search Engine
            </label>
            <Select
              id="trends-provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as GenerationProvider)}
              className="mt-1.5"
            >
              <option value="gemini">
                Gemini Live Web Search {settings.geminiConfigured ? '' : '(Needs Key)'}
              </option>
              <option value="openrouter">
                OpenRouter Web Search {settings.openRouterConfigured ? '' : '(Needs Key)'}
              </option>
            </Select>
          </div>
        </div>

        {scanError && (
          <div className="rounded-md border border-danger-100 bg-danger-subtle px-3.5 py-2.5 text-xs text-danger">
            {scanError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-muted">
            Observed marketplace signals are cited with live source URLs; sales velocity estimates are
            explicitly labeled as estimates.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={scanning}
            isLoading={scanning}
            leadingIcon={<Search className="h-3.5 w-3.5" />}
          >
            Run Live Market Scan
          </Button>
        </div>
      </form>
    </section>
  );
}
