import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  CalendarRange,
  Cpu,
  FileDown,
  FolderKanban,
  KeyRound,
  Menu,
  Plus,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type { ModuleId, WorkspaceSnapshot } from './types/workspace';
import { workspaceApi } from './lib/api';
import {
  getWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  subscribeGoogleAuth,
} from './lib/googleAuth';
import { LibraryView } from './components/LibraryView';
import { TrendsView } from './components/TrendsView';
import { StorageView } from './components/StorageView';
import { GenerationView } from './components/GenerationView';
import { PlanningView } from './components/PlanningView';
import { JobsView } from './components/JobsView';
import { ExportView } from './components/ExportView';
import { IdentityView } from './components/IdentityView';

const NAV_ITEMS: Array<{
  id: ModuleId;
  label: string;
  caption: string;
  icon: typeof BookOpen;
}> = [
  { id: 'library', label: 'Library', caption: 'Books & Series', icon: BookOpen },
  { id: 'trends', label: 'Trends', caption: 'Market Research', icon: TrendingUp },
  { id: 'storage', label: 'Storage', caption: 'Product Folders', icon: FolderKanban },
  { id: 'generation', label: 'Generation', caption: 'AI Prompt Studio', icon: Sparkles },
  { id: 'planning', label: 'Planning', caption: 'Outlines & Batches', icon: CalendarRange },
  { id: 'jobs', label: 'Jobs', caption: 'Background Queue', icon: Cpu },
  { id: 'export', label: 'Export', caption: 'KDP PDF & ZIP', icon: FileDown },
  { id: 'identity', label: 'Identity', caption: 'Accounts & Tokens', icon: KeyRound },
];

function getInitialModuleFromPath(): ModuleId {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const validIds: ModuleId[] = [
    'library',
    'trends',
    'storage',
    'generation',
    'planning',
    'jobs',
    'export',
    'identity',
  ];
  return validIds.includes(seg as ModuleId) ? (seg as ModuleId) : 'library';
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(() => getInitialModuleFromPath());
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

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

  // Keep clean SPA URL paths (/trends, /planning, /, etc.) in sync with module navigation
  useEffect(() => {
    const targetPath = activeModule === 'library' ? '/' : `/${activeModule}`;
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

  const openModuleForProduct = (module: ModuleId, productId: string) => {
    setActiveProductId(productId);
    setActiveModule(module);
  };

  const renderPrimaryHeaderAction = () => {
    if (activeModule === 'library') {
      return (
        <button
          type="button"
          onClick={() => setShowNewProductModal(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Product
        </button>
      );
    }
    if (activeModule === 'jobs') {
      return (
        <button
          type="button"
          disabled={runningStep || queuedJobsCount === 0}
          onClick={() => handleRunNextJob()}
          className="rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          {runningStep ? 'Processing…' : 'Process Next Step'}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setActiveModule('library');
          setShowNewProductModal(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        New Product
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Desktop Sidebar (252px) */}
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <a
            href="#library"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('library');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            FolioPress
          </a>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Workspace modules">
          {NAV_ITEMS.map((item) => {
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
                {item.id === 'jobs' && queuedJobsCount > 0 ? (
                  <span className="font-mono text-xs font-medium text-amber-700 tabular-nums">
                    {queuedJobsCount}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {item.caption.split(' ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs">
          <div className="font-medium text-slate-800">
            {workspace?.settings.authorImprint ?? 'Northwood Picture Press'}
          </div>
          <div className="mt-1 text-slate-500">
            {googleConnected
              ? `Google connected (${googleUser?.email ?? 'Active'})`
              : 'Local studio · Connect Drive in Identity'}
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
          <div className="relative z-10 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-15 items-center justify-between border-b border-slate-200 px-5">
              <span className="font-display text-lg font-bold text-slate-900">FolioPress</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${
                      active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean SaaS Top Bar: Breadcrumb left, single contextual action right */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className="font-medium text-slate-500">Workspace</span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-display text-base font-semibold text-slate-900">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {renderPrimaryHeaderAction()}
          </div>
        </header>

        {/* Transient Notice Banner */}
        {notice && (
          <div
            role="status"
            className={`border-b px-5 py-2.5 text-xs font-medium lg:px-8 ${
              notice.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-5 py-6 lg:px-8">
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
              {activeModule === 'library' && (
                <LibraryView
                  products={workspace.products}
                  series={workspace.series}
                  assets={workspace.assets}
                  settings={workspace.settings}
                  googleConnected={googleConnected}
                  showNewProductModal={showNewProductModal}
                  onCloseNewProductModal={() => setShowNewProductModal(false)}
                  onOpenNewProductModal={() => setShowNewProductModal(true)}
                  onOpenModuleForProduct={openModuleForProduct}
                  onBootstrapGoogleSheet={handleBootstrapGoogleSheet}
                  onSyncGoogleSheets={handleSyncGoogleSheets}
                  onCreateProduct={async (payload) => {
                    const { product } = await workspaceApi.createProduct(payload);
                    await refreshWorkspace();
                    setActiveProductId(product.id);
                    showNotice(`Created "${product.title}" and initialized product storage folder.`);
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
                    const { product, plan } = await workspaceApi.createProjectFromTrend(payload);
                    await refreshWorkspace();
                    setActiveProductId(product.id);
                    setActiveModule('planning');
                    showNotice(
                      `Created Studio project "${product.title}" with ${plan.steps.length}-step starter batch plan.`
                    );
                  }}
                  onOpenExistingProject={(productId) => {
                    setActiveProductId(productId);
                    setActiveModule('planning');
                  }}
                />
              )}

              {activeModule === 'storage' && (
                <StorageView
                  products={workspace.products}
                  folders={workspace.folders}
                  assets={workspace.assets}
                  activeProductId={activeProductId}
                  googleConnected={googleConnected}
                  onSelectProduct={setActiveProductId}
                  onUploadAsset={async (payload) => {
                    const { asset } = await workspaceApi.uploadAsset(payload);
                    await refreshWorkspace();
                    showNotice(`Uploaded "${asset.name}" to product folder.`);
                  }}
                  onDeleteAsset={async (id) => {
                    await workspaceApi.deleteAsset(id);
                    await refreshWorkspace();
                    showNotice('Removed asset from storage.');
                  }}
                  onUploadAssetToDrive={(assetId) => handleUploadToDrive({ assetId })}
                />
              )}

              {activeModule === 'generation' && (
                <GenerationView
                  products={workspace.products}
                  assets={workspace.assets}
                  generations={workspace.generations}
                  settings={workspace.settings}
                  activeProductId={activeProductId}
                  onSelectProduct={setActiveProductId}
                  onGenerateText={async (payload) => {
                    await workspaceApi.generateText(payload);
                    await refreshWorkspace();
                    showNotice('Generated copy saved to product history.');
                  }}
                  onGenerateIllustration={async (payload) => {
                    const { asset } = await workspaceApi.generateIllustration(payload);
                    await refreshWorkspace();
                    showNotice(`Illustration "${asset.name}" saved to product storage folder.`);
                  }}
                />
              )}

              {activeModule === 'planning' && (
                <PlanningView
                  products={workspace.products}
                  plans={workspace.plans}
                  activeProductId={activeProductId}
                  onSelectProduct={setActiveProductId}
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
                  onQueuePlan={async (planId) => {
                    const { jobs } = await workspaceApi.queuePlan(planId);
                    await refreshWorkspace();
                    showNotice(`Queued ${jobs.length} background jobs.`);
                    setActiveModule('jobs');
                  }}
                  onDeletePlan={async (planId) => {
                    await workspaceApi.deletePlan(planId);
                    await refreshWorkspace();
                    showNotice('Deleted batch plan.');
                  }}
                />
              )}

              {activeModule === 'jobs' && (
                <JobsView
                  jobs={workspace.jobs}
                  products={workspace.products}
                  settings={workspace.settings}
                  autoPoll={autoPoll}
                  runningStep={runningStep}
                  onToggleAutoPoll={() => setAutoPoll((prev) => !prev)}
                  onRunNextJob={handleRunNextJob}
                  onRefreshJobs={async () => {
                    await refreshWorkspace();
                    showNotice('Polled latest job queue status.');
                  }}
                  onJobAction={async (jobId, action) => {
                    await workspaceApi.jobAction(jobId, action);
                    await refreshWorkspace();
                    showNotice(`Updated job status (${action}).`);
                  }}
                />
              )}

              {activeModule === 'export' && (
                <ExportView
                  products={workspace.products}
                  assets={workspace.assets}
                  exportsList={workspace.exports}
                  activeProductId={activeProductId}
                  googleConnected={googleConnected}
                  onSelectProduct={setActiveProductId}
                  onExportPdf={async (payload) => {
                    const { artifact } = await workspaceApi.exportPdf(payload);
                    await refreshWorkspace();
                    showNotice(`Built print-ready KDP PDF (${artifact.pageCount} pages).`);
                    return artifact;
                  }}
                  onExportBundle={async (payload) => {
                    const { artifact } = await workspaceApi.exportBundle(payload);
                    await refreshWorkspace();
                    showNotice(`Packaged downloadable bundle "${artifact.fileName}".`);
                    return artifact;
                  }}
                  onUploadArtifactToDrive={(artifactId) =>
                    handleUploadToDrive({ artifactId })
                  }
                />
              )}

              {activeModule === 'identity' && (
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
      </div>
    </div>
  );
}
