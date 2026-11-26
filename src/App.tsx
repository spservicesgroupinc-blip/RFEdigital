import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Cpu,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from 'lucide-react';
import type {
  BuilderStep,
  GalleryImage,
  KdpTrimSize,
  ModuleId,
  ProductCategory,
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
import { StudioView } from './components/StudioView';
import { AssetsView } from './components/AssetsView';
import { PlanningView } from './components/PlanningView';
import { JobsView } from './components/JobsView';
import { ExportView } from './components/ExportView';
import { IdentityView } from './components/IdentityView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  DesktopSidebar,
  MobileDrawer,
  MobileBottomNav,
  TopHeader,
  NoticeBanner,
} from './components/layout';

const NAV_ITEMS: Array<{
  id: ModuleId;
  group: 'primary' | 'secondary';
  label: string;
  caption: string;
  icon: typeof BookOpen;
}> = [
  { id: 'dashboard', group: 'primary', label: 'Dashboard', caption: 'Products & Books', icon: LayoutDashboard },
  { id: 'studio', group: 'primary', label: 'Studio', caption: 'Create & Generate', icon: Layers },
  { id: 'assets', group: 'primary', label: 'Assets', caption: 'Images & Files', icon: FolderKanban },
  { id: 'trends', group: 'secondary', label: 'Market Trends', caption: 'Find Niches', icon: TrendingUp },
  { id: 'background-runs', group: 'secondary', label: 'Background Runs', caption: 'Plans & Jobs', icon: Cpu },
  { id: 'settings', group: 'secondary', label: 'Settings', caption: 'Google & Keys', icon: Settings },
];

const MOBILE_PRIMARY_TABS: Array<{ id: ModuleId; label: string; icon: typeof BookOpen }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'studio', label: 'Studio', icon: Layers },
  { id: 'assets', label: 'Assets', icon: FolderKanban },
];

/** Map old and current URL path segments to the active module id. */
function getInitialModuleFromPath(): ModuleId {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const redirects: Record<string, ModuleId> = {
    dashboard: 'dashboard',
    studio: 'studio',
    assets: 'assets',
    trends: 'trends',
    'background-runs': 'background-runs',
    settings: 'settings',
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
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [autoPoll, setAutoPoll] = useState(false);
  const [runningStep, setRunningStep] = useState(false);

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
    setActiveModule('studio');
  };

  const handleUseGalleryImageInBuilder = (img: GalleryImage) => {
    setBuilderGalleryImageId(img.id);
    setBuilderStep(2);
    setActiveModule('studio');
    showNotice(`Attached "${img.label}" from your Image Gallery — click Generate All Pages From Photo.`);
  };

  const handleGeneratePagesFromGalleryImage = (img: GalleryImage) => {
    setBuilderGalleryImageId(img.id);
    setBuilderStep(2);
    setActiveModule('studio');
    showNotice(`Attached "${img.label}" — generate story-matched pages from the Generate tab.`);
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

  const activeNav = useMemo(
    () => NAV_ITEMS.find((item) => item.id === activeModule) ?? NAV_ITEMS[0],
    [activeModule]
  );
  const queuedJobsCount = workspace?.jobs.filter((j) => j.status === 'queued').length ?? 0;

  const primaryHeaderAction = useMemo(() => {
    if (activeModule === 'dashboard') {
      return {
        label: 'New Product',
        shortLabel: 'New',
        onClick: () => setShowNewProductModal(true),
      };
    }
    if (activeModule === 'background-runs') {
      return {
        label: runningStep ? 'Processing…' : 'Run Step',
        shortLabel: runningStep ? '…' : 'Run',
        onClick: () => handleRunNextJob(),
        disabled: runningStep || queuedJobsCount === 0,
        isLoading: runningStep,
      };
    }
    return {
      label: 'New Product',
      shortLabel: 'New',
      onClick: () => {
        setActiveModule('dashboard');
        setShowNewProductModal(true);
      },
    };
  }, [activeModule, queuedJobsCount, runningStep]);

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] overflow-x-clip bg-surface-secondary text-text">
      <DesktopSidebar
        brand="FolioPress"
        navItems={NAV_ITEMS}
        activeModule={activeModule}
        onNavigate={setActiveModule}
        workspace={workspace}
        googleConnected={googleConnected}
        googleUser={googleUser}
        queuedJobsCount={queuedJobsCount}
      />

      <MobileDrawer
        brand="FolioPress"
        logo="/pwa-192x192.png"
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        navItems={NAV_ITEMS}
        activeModule={activeModule}
        onNavigate={setActiveModule}
        workspace={workspace}
        googleConnected={googleConnected}
        googleUser={googleUser}
        queuedJobsCount={queuedJobsCount}
        onInstalled={() => {
          setMobileNavOpen(false);
          showNotice('FolioPress installed to your device home screen.');
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          activeLabel={activeNav.label}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          primaryAction={primaryHeaderAction}
          onInstalledPWA={() =>
            showNotice('FolioPress installed! Launch anytime from your home screen.')
          }
        />

        {notice && (
          <NoticeBanner
            tone={notice.tone}
            text={notice.text}
            onDismiss={() => setNotice(null)}
          />
        )}

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-4 pb-24 sm:px-5 sm:py-6 sm:pb-24 lg:px-8 lg:pb-8">
          {loading ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
              <div className="h-72 animate-pulse rounded-lg border border-border bg-surface" />
            </div>
          ) : loadError || !workspace ? (
            <div className="rounded-lg border border-danger-100 bg-surface p-8 text-center">
              <p className="text-sm font-semibold text-danger">{loadError || 'Unable to load workspace.'}</p>
              <button
                type="button"
                onClick={refreshWorkspace}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-medium text-text-inverse hover:bg-primary-hover"
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
                <StudioView
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
                  onGenerateProduct={async (payload) => {
                    const { artifact } = await workspaceApi.generateProduct(payload);
                    await refreshWorkspace();
                    showNotice(`Generated full book — KDP PDF ready (${artifact.pageCount} pages).`);
                    return artifact;
                  }}
                  onUploadArtifactToDrive={(artifactId) => handleUploadToDrive({ artifactId })}
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
                <div className="space-y-6">
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
                    }}
                    onDeletePlan={async (planId) => {
                      await workspaceApi.deletePlan(planId);
                      await refreshWorkspace();
                      showNotice('Deleted batch plan.');
                    }}
                  />
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
                </div>
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

        <MobileBottomNav
          tabs={MOBILE_PRIMARY_TABS}
          moreTabs={NAV_ITEMS.filter((i) => i.group === 'secondary').map((i) => i.id)}
          activeModule={activeModule}
          onNavigate={setActiveModule}
          onOpenMore={() => setMobileNavOpen(true)}
          queuedJobsCount={queuedJobsCount}
        />

        <OfflineIndicator />
      </div>
    </div>
  );
}
