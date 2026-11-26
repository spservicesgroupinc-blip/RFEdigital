import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Modal } from '../ui/Modal';
import type { Series } from '../../types/workspace';

interface NewSeriesModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    description: string;
    targetAge: string;
    marketplace: Series['marketplace'];
  }) => Promise<void>;
}

export function NewSeriesModal({ open, onClose, onCreate }: NewSeriesModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAge, setTargetAge] = useState('Ages 4–8');
  const [marketplace, setMarketplace] = useState<Series['marketplace']>('Amazon KDP');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Series name must be at least 2 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        targetAge: targetAge.trim(),
        marketplace,
      });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create series.');
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" form="new-series-form" isLoading={submitting}>
        Create Series
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="New Publishing Series" footer={footer}>
      <form id="new-series-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="series-name" className="block text-xs font-medium text-text-secondary">
            Series Name *
          </label>
          <Input
            id="series-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Harbor Bay Tales"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="series-age" className="block text-xs font-medium text-text-secondary">
              Audience
            </label>
            <Input
              id="series-age"
              value={targetAge}
              onChange={(e) => setTargetAge(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="series-market" className="block text-xs font-medium text-text-secondary">
              Marketplace
            </label>
            <Select
              id="series-market"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value as Series['marketplace'])}
              className="mt-1"
            >
              <option value="Amazon KDP">Amazon KDP</option>
              <option value="Etsy Digital">Etsy Digital</option>
              <option value="IngramSpark">IngramSpark</option>
            </Select>
          </div>
        </div>
        <div>
          <label htmlFor="series-desc" className="block text-xs font-medium text-text-secondary">
            Series Description
          </label>
          <Textarea
            id="series-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>
      </form>
    </Modal>
  );
}
