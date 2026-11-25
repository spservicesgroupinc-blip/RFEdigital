import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Cpu,
  FolderKanban,
  KeyRound,
  Layers,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  GalleryImage,
  GenerationMode,
  KdpTrimSize,
  ModuleId,
  ProductCategory,
  PromptPrefillRequest,
  WorkspaceSnapshot,
} from './types/workspace';
import { workspaceApi } from './lib/api';
import {
  getWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeGoogleAuth,
} from './lib/googleAuth';
import { LibraryView } from './components/LibraryView';
import { TrendsView } from './components/TrendsView';
import { ProductBuilderView, type BuilderStep } from './components/ProductBuilderView';
import { ImageGalleryView } from './components/ImageGalleryView';
import { StorageView } from './components/StorageView';
import { AssetsView } from './components/AssetsView';
import { GenerationView } from './components/GenerationView';
import { PlanningView } from './components/PlanningView';
import { JobsView } from './components/JobsView';
import { ExportView } from './components/ExportView';
import { IdentityView } from './components/IdentityView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const NAV_ITEMS: Array<{
  id: ModuleId;
  group: 'primary' | 'secondary';
  label: string;
  caption: string;
  icon: typeof BookOpen;
}> = [
  // Primary workflow: Dashboard → Studio → Assets
  { id: 'dashboard', group: 'primary', label: 'Dashboard', caption: 'Products & Books', icon: LayoutDashboard },
  { id: 'studio', group: 'primary', label: 'Studio', caption: 'Create & Generate', icon: Layers },
  { id: 'assets', group: 'primary', label: 'Assets', caption: 'Images & Files', icon: FolderKanban },
  // Secondary tools
  { id: 'trends', group: 'secondary', label: 'Market Trends', caption: 'Find Niches', icon: TrendingUp },
  { id: 'background-runs', group: 'secondary', label: 'Background Runs', caption: 'Plans & Jobs', icon: Cpu },
  { id: 'settings', group: 'secondary', label: 'Settings', caption: 'Google & Keys', icon: Settings },
];

/** Map old and current URL path segments to the active module id.
 *  Legacy routes redirect to their modern counterpart. */
function getInitialModuleFromPath(): ModuleId {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const redirects: Record<string, ModuleId> = {
    // modern routes
    dashboard: 'dashboard',
    studio: 'studio',
    assets: 'assets',
    trends: 'trends',
    'background-runs': 'background-runs',
    settings: 'settings',
    // legacy routes
    library: 'dashboard',
    builder: 'studio',
    gallery: 'assets',
    storage: 'assets',
    generation: 'studio',
    planning: 'background-runs',
    jobs: 'background-runs',
    export: 'studio',
    identity: 'settings',
  };
  return redirects[seg] ?? 'dashboard';
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(() => getInitialModuleFromPath());
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [builderStep, setBuilderStep] = useState<BuilderStep | undefined>(undefined);
  const [builderGalleryImageId, setBuilderGalleryImageId] = useState<string | null>(null);
  const [promptPrefill, setPromptPrefill] = useState<PromptPrefillRequest | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [generationInitialMode, setGenerationInitialMode] = useState<GenerationMode>('illustration');

  // Google Workspace auth state (token strictly in-memory via googleAuth.ts)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Background queue state
  const [autoPoll, setAutoPoll] = useState(false);
  const [runningStep, setRunningStep] = useState(false);

  // Transient feedback banner
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const showNotice = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setNotice({ text, tone });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const refreshWorkspace = useCallback(async () => {
    try {
      const snap = await workspaceApi.getWorkspace();
      setWorkspace(snap);
      setActiveProductId((prev) =>
        prev && snap.products.some((p) => p.id === prev)
          ? prev
          : (snap.products[0]?.id ?? null)
      );
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  // Keep clean SPA URL paths (/trends, /settings, /, etc.) in sync with module navigation
  useEffect(() => {
    const targetPath = activeModule === 'dashboard' ? '/' : `/${activeModule}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, '', targetPath);
    }
  }, [activeModule]);

  useEffect(() => {
    const onPopState = () => setActiveModule(getInitialModuleFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    return subscribeGoogleAuth(
      (user) => {
        setGoogleUser(user);
        setGoogleConnected(true);
      },
      () => {
        setGoogleUser(null);
        setGoogleConnected(false);
      }
    );
  }, []);

  // Optional auto-runner interval for Jobs module (executes one queued step per tick)
  useEffect(() => {
    if (!autoPoll) return;
    const timer = setInterval(async () => {
      if (runningStep) return;
      try {
        setRunningStep(true);
        const res = await workspaceApi.runNextJob();
        if (res.processed) {
          await refreshWorkspace();
        } else {
          setAutoPoll(false);
        }
      } catch {
        setAutoPoll(false);
      } finally {
        setRunningStep(false);
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [autoPoll, runningStep, refreshWorkspace]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const { user } = await signInWithGoogleWorkspace();
      setGoogleUser(user);
      setGoogleConnected(true);
      showNotice(`Connected Google Workspace as ${user.email || user.displayName}.`);
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.',
        'error'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleWorkspace();
    setGoogleUser(null);
    setGoogleConnected(false);
    showNotice('Signed out of Google Workspace.');
  };

  const handleBootstrapGoogleSheet = async () => {
    const token = getWorkspaceAccessToken();
    if (!token) {
      showNotice('Sign in with Google first to create a Library Spreadsheet.', 'error');
      return;
    }
    const created = await workspaceApi.bootstrapGoogleSheet(token);
    await refreshWorkspace();
    showNotice(`Created Library Spreadsheet (${created.spreadsheetId.slice(0, 10)}…).`);
  };

  const handleSyncGoogleSheets = async () => {
    const token = getWorkspaceAccessToken();
    if (!token) {
      showNotice('Sign in with Google first to sync with Google Sheets.', 'error');
      return;
    }
    const result = await workspaceApi.syncGoogleSheet(token);
    await refreshWorkspace();
    showNotice(`Synced ${result.rowsWritten} product rows to Google Sheets.`);
  };

  const handleUploadToDrive = async (payload: { artifactId?: string; assetId?: string }) => {
    const token = getWorkspaceAccessToken();
    if (!token) {
      showNotice('Sign in with Google first to upload files to Google Drive.', 'error');
      return;
    }
    await workspaceApi.uploadToGoogleDrive(token, payload);
    await refreshWorkspace();
    showNotice('Uploaded file to your product folder in Google Drive.');
  };

  const handleRunNextJob = async (jobId?: string) => {
    setRunningStep(true);
    try {
      const result = await workspaceApi.runNextJob(jobId);
      await refreshWorkspace();
      if (result.processed && result.job) {
        showNotice(
          result.job.status === 'completed'
            ? `Completed job: ${result.job.title}`
            : `Job finished with status: ${result.job.status}`,
          result.job.status === 'failed' ? 'error' : 'info'
        );
      } else {
        showNotice('No queued jobs waiting to process.');
      }
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Failed to run next job.', 'error');
    } finally {
      setRunningStep(false);
    }
  };

  const activeNav = NAV_ITEMS.find((item) => item.id === activeModule) ?? NAV_ITEMS[0];
  const queuedJobsCount = workspace?.jobs.filter((j) => j.status === 'queued').length ?? 0;

  /** Map legacy module ids to their modern counterparts so internal navigation stays consistent. */
  const normalizeModule = (module: ModuleId): ModuleId => {
    const map: Record<string, ModuleId> = {
      library: 'dashboard',
      builder: 'studio',
      gallery: 'assets',
      storage: 'assets',
      generation: 'studio',
      planning: 'background-runs',
      jobs: 'background-runs',
      export: 'studio',
      identity: 'settings',
    };
    return map[module] ?? module;
  };

  const openModuleForProduct = (module: ModuleId, productId: string) => {
    setActiveProductId(productId);
    setActiveModule(normalizeModule(module));
  };

  const openBuilderForProduct = (productId: string, step?: BuilderStep) => {
    setActiveProductId(productId);
    setBuilderStep(step ?? 2);
    setActiveModule('studio');
  };

  const openIllustrationForProduct = (productId: string) => {
    setActiveProductId(productId);
    setGenerationInitialMode('illustration');
    setActiveModule('studio');
  };

  const openPromptStudioWithPrefill = (req: Omit<PromptPrefillRequest, 'nonce'>) => {
    setActiveProductId(req.productId);
    setGenerationInitialMode(req.mode);
    setPromptPrefill({ ...req, nonce: Date.now() });
    setActiveModule('studio');
  };

  const handleUseGalleryImageInBuilder = (img: GalleryImage) => {
    setBuilderGalleryImageId(img.id);
    setBuilderStep(2);
    setActiveModule('studio');
    showNotice(`Attached "${img.label}" from your Image Gallery — click Generate All Pages From Photo.`);
  };

  const handleGeneratePagesFromGalleryImage = (img: GalleryImage) => {
    const targetId = activeProductId || workspace?.products[0]?.id || '';
    setGenerationInitialMode('illustration');
    setPromptPrefill({
      productId: targetId,
      mode: 'illustration',
      prompt: `Children's picture book illustration starring the character from "${img.label}" in a vibrant new scene and playful pose.`,
      assetKind: 'illustration',
      galleryImageId: img.id,
      label: `Multi-page from ${img.label}`,
      nonce: Date.now(),
    });
    setActiveModule('studio');
  };

  const handleQuickCreateProduct = async (opts: {
    title: string;
    category?: ProductCategory;
    trimSize?: KdpTrimSize;
    pageCount?: number;
  }) => {
    const { product } = await workspaceApi.createProduct({
      title: opts.title,
      subtitle: '',
      category: opts.category ?? 'childrens-book',
      status: 'draft',
      trimSize: opts.trimSize ?? '8.5x8.5',
      pageCount: opts.pageCount ?? 24,
      includeBleed: true,
      seriesId: null,
      isbn: '',
      manuscriptNotes: '',
    });
    await refreshWorkspace();
    setActiveProductId(product.id);
    return product;
  };

  const renderPrimaryHeaderAction = () => {
    if (activeModule === 'dashboard') {
      return (
        <button
          type="button"
          onClick={() => setShowNewProductModal(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 sm:px-3.5 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New Product</span>
        </button>
      );
    }
    if (activeModule === 'background-runs') {
      return (
        <button
          type="button"
          disabled={runningStep || queuedJobsCount === 0}
          onClick={() => handleRunNextJob()}
          className="rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-45 sm:px-3.5 whitespace-nowrap shrink-0"
        >
          {runningStep ? 'Processing…' : 'Run Step'}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setActiveModule('dashboard');
          setShowNewProductModal(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 sm:px-3.5 whitespace-nowrap shrink-0"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sm:hidden">New</span>
        <span className="hidden sm:inline">New Product</span>
      </button>
    );
  };

  const MOBILE_PRIMARY_TABS: Array<{
    id: ModuleId;
    label: string;
    icon: typeof BookOpen;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'studio', label: 'Studio', icon: Layers },
    { id: 'assets', label: 'Assets', icon: FolderKanban },
  ];

  const isSecondaryModuleActive = !MOBILE_PRIMARY_TABS.some((t) => t.id === activeModule);
  const primaryNavItems = NAV_ITEMS.filter((i) => i.group === 'primary');
  const secondaryNavItems = NAV_ITEMS.filter((i) => i.group === 'secondary');

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] overflow-x-clip bg-[#F8FAFC] text-slate-900">
      {/* Desktop Sidebar (252px) */}
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('dashboard');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            FolioPress
          </a>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Workspace modules">
          <div className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveModule(item.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-slate-100 px-3 pb-1.5 pt-4 text-[11px] font-semibold tracking-wide text-slate-400">
            More
          </div>
          <div className="space-y-1">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveModule(item.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  </span>
                  {item.id === 'jobs' && queuedJobsCount > 0 && (
                    <span className="font-mono text-xs font-medium text-amber-700 tabular-nums">
                      {queuedJobsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs">
          <div className="font-medium text-slate-800">
            {workspace?.settings.authorImprint ?? 'FolioPress Studio'}
          </div>
          <div className="mt-1 text-slate-500">
            {googleConnected
              ? `Google connected (${googleUser?.email ?? 'Active'})`
              : 'Local studio · Connect Drive in Settings'}
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
        >
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="safe-top safe-bottom relative z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-15 items-center justify-between border-b border-slate-200 px-5">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt=""
                  aria-hidden="true"
                  className="h-7 w-7 rounded-md"
                />
                <span className="font-display text-lg font-bold text-slate-900">FolioPress</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
                className="rounded p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3">
              <div className="space-y-1">
                {primaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          setActiveModule(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${
                          active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">{item.caption}</span>
                      </button>
                    );
                  })}
                </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400">
                  More
                </div>
                <div className="space-y-1">
                  {secondaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          setActiveModule(item.id);
                          setMobileNavOpen(false);
                        }}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${
                          active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">{item.caption}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>
            <div className="space-y-3 border-t border-slate-200 p-4">
              <PWAInstallButton
                variant="full"
                onInstalled={() => {
                  setMobileNavOpen(false);
                  showNotice('FolioPress installed to your device home screen.');
                }}
              />
              <div className="text-xs text-slate-500">
                <div className="font-medium text-slate-800">
                  {workspace?.settings.authorImprint ?? 'FolioPress Studio'}
                </div>
                <div className="mt-0.5 truncate">
                  {googleConnected
                    ? `Google connected (${googleUser?.email ?? 'Active'})`
                    : 'Local studio · Connect Drive in Settings'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean SaaS Top Bar: Breadcrumb left, Install + contextual action right */}
        <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex min-w-0 items-center gap-2 text-sm whitespace-nowrap">
                <span className="hidden font-medium text-slate-500 sm:inline">Workspace</span>
                <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
                  /
                </span>
                <h1 className="truncate font-display text-base font-semibold text-slate-900">
                  {activeNav.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <PWAInstallButton
                variant="header"
                onInstalled={() =>
                  showNotice('FolioPress installed! Launch anytime from your home screen.')
                }
              />
              {renderPrimaryHeaderAction()}
            </div>
          </div>
        </header>

        {/* Transient Notice Banner */}
        {notice && (
          <div
            role="status"
            className={`border-b px-4 py-2.5 text-xs font-medium sm:px-5 lg:px-8 ${
              notice.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Active Module Viewport (extra bottom clearance on mobile for bottom tab bar) */}
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-4 pb-24 sm:px-5 sm:py-6 sm:pb-24 lg:px-8 lg:pb-8">
          {loading ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
              <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
            </div>
          ) : loadError || !workspace ? (
            <div className="rounded-lg border border-red-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-red-800">
                {loadError || 'Unable to load workspace.'}
              </p>
              <button
                type="button"
                onClick={refreshWorkspace}
                className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <LibraryView
                  products={workspace.products}
                  series={workspace.series}
                  assets={workspace.assets}
                  generations={workspace.generations}
                  exportsList={workspace.exports}
                  settings={workspace.settings}
                  googleConnected={googleConnected}
                  showNewProductModal={showNewProductModal}
                  onCloseNewProductModal={() => setShowNewProductModal(false)}
                  onOpenNewProductModal={() => setShowNewProductModal(true)}
                  onOpenModuleForProduct={openModuleForProduct}
                  onOpenIllustrationForProduct={openIllustrationForProduct}
                  onOpenBuilderForProduct={openBuilderForProduct}
                  onBootstrapGoogleSheet={handleBootstrapGoogleSheet}
                  onSyncGoogleSheets={handleSyncGoogleSheets}
                  onCreateProduct={async (payload) => {
                    const { product, referenceAsset } = await workspaceApi.createProduct(payload);
                    await refreshWorkspace();
                    setActiveProductId(product.id);
                    showNotice(
                      referenceAsset
                        ? `Created "${product.title}" with reference photo & editable prompts ready.`
                        : `Created "${product.title}" — review and edit your auto-filled prompts below.`
                    );
                    return product;
                  }}
                  onUploadReferencePhoto={async (payload) => {
                    await workspaceApi.uploadAsset({
                      productId: payload.productId,
                      name: payload.name,
                      mimeType: payload.mimeType,
                      dataUrl: payload.dataUrl,
                      kind: 'reference',
                      caption: 'Reference photo for AI cartoon & illustration generation',
                    });
                    await refreshWorkspace();
                    showNotice('Reference photo attached — ready to generate cartoons via OpenRouter.');
                  }}
                  onUpdateProduct={async (id, payload) => {
                    await workspaceApi.updateProduct(id, payload);
                    await refreshWorkspace();
                    showNotice('Updated product metadata.');
                  }}
                  onDeleteProduct={async (id) => {
                    await workspaceApi.deleteProduct(id);
                    await refreshWorkspace();
                    showNotice('Product deleted from catalog.');
                  }}
                  onCreateSeries={async (payload) => {
                    const { series } = await workspaceApi.createSeries(payload);
                    await refreshWorkspace();
                    showNotice(`Created series "${series.name}".`);
                  }}
                />
              )}

              {activeModule === 'trends' && (
                <TrendsView
                  scans={workspace.trendScans ?? []}
                  settings={workspace.settings}
                  onRunScan={async (payload) => {
                    const { scan } = await workspaceApi.runTrendsScan(payload);
                    await refreshWorkspace();
                    showNotice(
                      `Completed live market scan: found ${scan.opportunities.length} ranked niche opportunities.`
                    );
                    return scan;
                  }}
                  onRunDeepDive={async (payload) => {
                    const { deepDive } = await workspaceApi.runTrendDeepDive(payload);
                    await refreshWorkspace();
                    showNotice(`Finished competitive deep-dive for "${payload.opportunity.title}".`);
                    return deepDive;
                  }}
                  onDeleteScan={async (scanId) => {
                    await workspaceApi.deleteTrendScan(scanId);
                    await refreshWorkspace();
                    showNotice('Removed saved research scan.');
                  }}
                  onCreateProjectFromTrend={async (payload) => {
                    const { product } = await workspaceApi.createProjectFromTrend(payload);
                    await refreshWorkspace();
                    setActiveProductId(product.id);
                    setBuilderStep(2);
                    setActiveModule('studio');
                    showNotice(
                      `Generated editable prompts for "${product.title}" — review or tweak any prompt before generating.`
                    );
                  }}
                  onOpenExistingProject={(productId) => {
                    setActiveProductId(productId);
                    setBuilderStep(2);
                    setActiveModule('studio');
                  }}
                />
              )}

              {activeModule === 'studio' && (
                <ProductBuilderView
                  products={workspace.products}
                  assets={workspace.assets}
                  galleryImages={workspace.galleryImages ?? []}
                  generations={workspace.generations}
                  exportsList={workspace.exports}
                  settings={workspace.settings}
                  activeProductId={activeProductId}
                  initialStep={builderStep}
                  initialGalleryImageId={builderGalleryImageId}
                  onClearInitialGalleryImage={() => setBuilderGalleryImageId(null)}
                  googleConnected={googleConnected}
                  onSelectProduct={setActiveProductId}
                  onCreateProduct={async (payload) => {
                    const { product } = await workspaceApi.createProduct(payload);
                    await refreshWorkspace();
                    setActiveProductId(product.id);
                    return product;
                  }}
                  onUpdateProduct={async (id, payload) => {
                    await workspaceApi.updateProduct(id, payload);
                    await refreshWorkspace();
                    if (payload.promptPack) {
                      showNotice('Saved prompt edits.');
                    } else if (payload.manuscriptNotes !== undefined) {
                      showNotice('Saved manuscript copy.');
                    }
                  }}
                  onGeneratePromptPack={async (payload) => {
                    const { promptPack, usedAi } = await workspaceApi.generatePromptPack(payload);
                    await refreshWorkspace();
                    showNotice(
                      usedAi
                        ? 'Auto-filled editable prompts with AI — edit any section before generating.'
                        : 'Auto-filled editable starter prompts — edit any section before generating.'
                    );
                    return promptPack;
                  }}
                  onGenerateText={async (payload) => {
                    const { product: updatedProduct } = await workspaceApi.generateText(payload);
                    await refreshWorkspace();
                    showNotice(
                      payload.mode === 'manuscript' && payload.saveToManuscript
                        ? 'Story copy saved and interior page prompts matched to your story.'
                        : 'Generated copy saved to your product.'
                    );
                    return updatedProduct;
                  }}
                  onGenerateIllustration={async (payload) => {
                    const { asset } = await workspaceApi.generateIllustration(payload);
                    await refreshWorkspace();
                    showNotice(`Generated "${asset.name}" and saved to your product pages.`);
                    return asset;
                  }}
                  onUploadAsset={async (payload) => {
                    const { asset } = await workspaceApi.uploadAsset(payload);
                    await refreshWorkspace();
                    showNotice(`Uploaded "${asset.name}" to your product.`);
                  }}
                  onUpdateAsset={async (id, payload) => {
                    await workspaceApi.updateAsset(id, payload);
                    await refreshWorkspace();
                    if (payload.storyText !== undefined || payload.textPlacement !== undefined) {
                      showNotice('Saved page story text and placement.');
                    }
                  }}
                  onDeleteAsset={async (assetId) => {
                    await workspaceApi.deleteAsset(assetId);
                    await refreshWorkspace();
                    showNotice('Removed page artwork.');
                  }}
                  onExportPdf={async (payload) => {
                    const { artifact } = await workspaceApi.exportPdf(payload);
                    await refreshWorkspace();
                    showNotice(`Built finished KDP PDF (${artifact.pageCount} pages).`);
                    return artifact;
                  }}
                  onExportBundle={async (payload) => {
                    const { artifact } = await workspaceApi.exportBundle(payload);
                    await refreshWorkspace();
                    showNotice(`Packaged PNG bundle "${artifact.fileName}".`);
                    return artifact;
                  }}
                  onUploadArtifactToDrive={(artifactId) =>
                    handleUploadToDrive({ artifactId })
                  }
                  onOpenInPromptStudio={openPromptStudioWithPrefill}
                  onOpenGallery={() => setActiveModule('assets')}
                  onGoToTrends={() => setActiveModule('trends')}
                />
              )}

              {activeModule === 'assets' && (
                <AssetsView
                  products={workspace.products}
                  assets={workspace.assets}
                  galleryImages={workspace.galleryImages ?? []}
                  activeProductId={activeProductId}
                  googleConnected={googleConnected}
                  onSelectProduct={setActiveProductId}
                  onUploadAsset={async (payload) => {
                    const { asset } = await workspaceApi.uploadAsset(payload);
                    await refreshWorkspace();
                    showNotice(`Uploaded "${asset.name}" to product folder.`);
                  }}
                  onUploadGalleryImage={async (payload) => {
                    const { image } = await workspaceApi.uploadGalleryImage(payload);
                    await refreshWorkspace();
                    showNotice(
                      image.driveFileId
                        ? `Uploaded "${image.label}" to your gallery & backed up to Google Drive.`
                        : `Saved "${image.label}" to your Image Gallery.`
                    );
                    return image;
                  }}
                  onDeleteAsset={async (id) => {
                    await workspaceApi.deleteAsset(id);
                    await refreshWorkspace();
                    showNotice('Removed asset from storage.');
                  }}
                  onDeleteGalleryImage={async (id) => {
                    await workspaceApi.deleteGalleryImage(id);
                    await refreshWorkspace();
                    showNotice('Deleted photo from Image Gallery.');
                  }}
                  onUploadAssetToDrive={(assetId) => handleUploadToDrive({ assetId })}
                  onUseInBuilder={handleUseGalleryImageInBuilder}
                  onGeneratePagesFromPhoto={handleGeneratePagesFromGalleryImage}
                />
              )}

              {activeModule === 'background-runs' && (
                <PlanningView
                  products={workspace.products}
                  plans={workspace.plans}
                  activeProductId={activeProductId}
                  onSelectProduct={setActiveProductId}
                  onQuickCreateProduct={(opts) => handleQuickCreateProduct(opts)}
                  onGenerateOutline={async (payload) => {
                    const { steps } = await workspaceApi.generateOutline(payload);
                    showNotice(`Drafted ${steps.length} production steps with AI.`);
                    return steps;
                  }}
                  onCreatePlan={async (payload) => {
                    const { plan } = await workspaceApi.createPlan(payload);
                    await refreshWorkspace();
                    showNotice(`Saved batch plan "${plan.name}".`);
                  }}
                  onUpdatePlan={async (planId, payload) => {
                    const { plan } = await workspaceApi.updatePlan(planId, payload);
                    await refreshWorkspace();
                    showNotice(`Updated prompts in "${plan.name}".`);
                  }}
                  onQueuePlan={async (planId) => {
                    const { jobs } = await workspaceApi.queuePlan(
                      planId,
                      workspace.settings.openRouterConfigured ? 'openrouter' : 'gemini'
                    );
                    await refreshWorkspace();
                    showNotice(`Queued ${jobs.length} background jobs.`);
                    setActiveModule('background-runs');
                  }}
                  onDeletePlan={async (planId) => {
                    await workspaceApi.deletePlan(planId);
                    await refreshWorkspace();
                    showNotice('Deleted batch plan.');
                  }}
                />
              )}

              {activeModule === 'settings' && (
                <IdentityView
                  googleUser={googleUser}
                  googleConnected={googleConnected}
                  signingIn={signingIn}
                  settings={workspace.settings}
                  tokens={workspace.tokens}
                  onSignInGoogle={handleGoogleSignIn}
                  onSignOutGoogle={handleGoogleSignOut}
                  onBootstrapGoogleSheet={handleBootstrapGoogleSheet}
                  onRunBridgeSetup={async () => {
                    try {
                      const res = await workspaceApi.runBridgeSetup();
                      await refreshWorkspace();
                      showNotice(
                        res.spreadsheetId
                          ? `Apps Script initialized Spreadsheet (${res.spreadsheetId.slice(0, 10)}…) and 5-min trigger.`
                          : 'Apps Script first-run setup completed.'
                      );
                    } catch (err) {
                      showNotice(
                        err instanceof Error ? err.message : 'Apps Script setup failed.',
                        'error'
                      );
                    }
                  }}
                  onSyncViaBridge={async () => {
                    try {
                      const res = await workspaceApi.syncViaBridge();
                      await refreshWorkspace();
                      showNotice(
                        `Synced ${res.rowsWritten.products ?? workspace.products.length} products via Apps Script Web App.`
                      );
                    } catch (err) {
                      showNotice(
                        err instanceof Error ? err.message : 'Apps Script sync failed.',
                        'error'
                      );
                    }
                  }}
                  onCreateToken={async (payload) => {
                    const res = await workspaceApi.createToken(payload);
                    await refreshWorkspace();
                    showNotice(`Created scoped API token "${res.record.name}".`);
                    return res;
                  }}
                  onRevokeToken={async (id) => {
                    await workspaceApi.revokeToken(id);
                    await refreshWorkspace();
                    showNotice('API token revoked.');
                  }}
                  onUpdateSettings={async (payload) => {
                    await workspaceApi.updateSettings(payload);
                    await refreshWorkspace();
                    showNotice('Workspace settings updated.');
                  }}
                />
              )}
            </>
          )}
        </main>

        {/* Smartphone Bottom Tab Bar (Thumb-friendly native PWA navigation) */}
        <nav
          aria-label="Mobile quick navigation"
          className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
        >
          <div className="grid h-16 grid-cols-5 items-stretch">
            {MOBILE_PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeModule === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveModule(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors ${
                    active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="More workspace modules"
              className={`relative flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors ${
                isSecondaryModuleActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>More</span>
              {queuedJobsCount > 0 && (
                <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>
        </nav>

        <OfflineIndicator />
      </div>
    </div>
  );
}
