import { ArrowRight, Copy, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Textarea } from '../ui/Textarea';

interface ManuscriptEditorProps {
  notesDraft: string;
  setNotesDraft: React.Dispatch<React.SetStateAction<string>>;
  notesDirty: boolean;
  setNotesDirty: React.Dispatch<React.SetStateAction<boolean>>;
  savingNotes: boolean;
  copiedNotes: boolean;
  setCopiedNotes: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveNotes: () => Promise<void>;
  onContinueToDownload: () => void;
}

export function ManuscriptEditor({
  notesDraft,
  setNotesDraft,
  notesDirty,
  setNotesDirty,
  savingNotes,
  copiedNotes,
  setCopiedNotes,
  handleSaveNotes,
  onContinueToDownload,
}: ManuscriptEditorProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        action={
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => {
              navigator.clipboard?.writeText(notesDraft).catch(() => {});
              setCopiedNotes(true);
              setTimeout(() => setCopiedNotes(false), 1600);
            }}
          >
            {copiedNotes ? 'Copied' : 'Copy'}
          </Button>
        }
      >
        <CardTitle>Full Story Manuscript &amp; Copy</CardTitle>
        <CardDescription>
          Write or edit your manuscript here, then click <span className="font-medium text-text-secondary">Auto-Fill Story Text</span> to place each spread onto its matching page.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <Textarea
          rows={14}
          aria-label="Product manuscript and listing copy"
          value={notesDraft}
          onChange={(e) => {
            setNotesDraft(e.target.value);
            setNotesDirty(true);
          }}
          placeholder="Write or paste your story spreads here (e.g., Page 1: Zebo wagged his tail at the garden gate...)"
          className="flex-1"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
          <Button
            variant="outline"
            size="md"
            leadingIcon={<Save className="h-3.5 w-3.5" />}
            disabled={!notesDirty || savingNotes}
            onClick={handleSaveNotes}
          >
            {savingNotes ? 'Saving…' : notesDirty ? 'Save Copy Edits' : 'Saved'}
          </Button>

          <Button
            variant="primary"
            size="md"
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={async () => {
              if (notesDirty) await handleSaveNotes();
              onContinueToDownload();
            }}
          >
            Continue to Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
