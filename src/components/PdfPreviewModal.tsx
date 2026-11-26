import { useEffect } from 'react';
import { CheckCircle2, Download, FileText, X } from 'lucide-react';
import { formatBytes } from '../lib/workspaceLogic';
import { Button } from './ui/Button';

interface PdfPreviewModalProps {
  open: boolean;
  fileName: string;
  blobUrl: string | null;
  sizeBytes?: number;
  onDownload: () => void;
  onClose: () => void;
}

export function PdfPreviewModal({
  open,
  fileName,
  blobUrl,
  sizeBytes,
  onDownload,
  onClose,
}: PdfPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !blobUrl) return null;

  const canRenderInlinePdf =
    typeof navigator !== 'undefined' &&
    Boolean((navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF Preview: ${fileName}`}
      onClick={onClose}
    >
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl ${
          canRenderInlinePdf ? 'h-[88vh] max-w-4xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h3 className="truncate font-mono text-xs font-semibold text-text sm:text-sm">
              {fileName}
            </h3>
            <p className="text-[11px] text-text-muted">
              Verified KDP PDF{sizeBytes ? ` · ${formatBytes(sizeBytes)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={onDownload}
              className="whitespace-nowrap"
            >
              Download PDF
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close PDF preview"
              className="shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {canRenderInlinePdf ? (
          <div className="flex-1 bg-surface-tertiary">
            <iframe
              title={`Preview of ${fileName}`}
              src={blobUrl}
              className="h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle text-success">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              PDF integrity verified and ready to open
            </div>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
              Your browser does not embed inline PDF previews. Download the verified file below to
              open it in your device&apos;s PDF reader.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
              onClick={onDownload}
              className="mt-5"
            >
              Download {fileName}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
