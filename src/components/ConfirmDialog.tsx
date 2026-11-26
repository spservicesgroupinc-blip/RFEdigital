import { useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelBtnRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const footer = (
    <>
      <Button
        ref={cancelBtnRef}
        type="button"
        variant="outline"
        size="md"
        onClick={onCancel}
        disabled={busy}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant={tone === 'danger' ? 'danger' : 'primary'}
        size="md"
        onClick={onConfirm}
        isLoading={busy}
      >
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={footer}
    >
      {null}
    </Modal>
  );
}
