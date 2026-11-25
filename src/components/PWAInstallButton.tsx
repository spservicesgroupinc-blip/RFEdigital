import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'full';
  onInstalled?: () => void;
}

export function PWAInstallButton({
  variant = 'header',
  onInstalled,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Automatically hide when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onInstalled?.();
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install FolioPress app to home screen"
        className={
          variant === 'full'
            ? 'inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap'
            : 'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:px-3 whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-3.5 w-3.5 text-blue-700 shrink-0" aria-hidden="true" />
        <span>{variant === 'full' ? 'Install FolioPress App' : 'Install'}</span>
      </button>

      {showGuideModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
          >
            <div className="safe-bottom max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-6 shadow-xl sm:rounded-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="FolioPress app icon"
                  className="h-11 w-11 shrink-0 rounded-xl border border-slate-200"
                />
                <div>
                  <h2
                    id="pwa-install-guide-title"
                    className="text-base font-semibold text-slate-900"
                  >
                    Install FolioPress on Your Device
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Launch full-screen from your home screen with offline access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs leading-relaxed text-slate-700">
              {isIOS ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Share className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    iPhone &amp; iPad (Safari)
                  </div>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-700">
                    <li>
                      Open this app directly in <strong>Safari</strong>.
                    </li>
                    <li>
                      Tap the <strong>Share</strong> button in the bottom toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>, then tap{' '}
                      <strong>Add</strong>.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Smartphone className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    Android (Chrome / Edge)
                  </div>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-700">
                    <li>
                      Open this app directly in <strong>Chrome</strong> (outside an embedded preview).
                    </li>
                    <li>
                      Tap the <strong>⋮ Menu</strong> button in the top-right corner.
                    </li>
                    <li>
                      Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Share className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                      iPhone / iPad (Safari)
                    </div>
                    <p className="mt-1 text-slate-600">
                      Open the app URL in Safari, tap <strong>Share</strong>, then tap{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Smartphone className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                      Android &amp; Desktop (Chrome / Edge)
                    </div>
                    <p className="mt-1 text-slate-600">
                      Open the app URL in its own browser tab and click the{' '}
                      <strong>Install</strong> icon in the address bar (or browser menu &rarr;{' '}
                      <strong>Install FolioPress Studio</strong>).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800"
            >
              Got It
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
