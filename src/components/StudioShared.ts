import type { PageTextLayout } from '../types/workspace';

/** Text-placement options shared by the Generate and Download studio panels. */
export const PAGE_LAYOUT_OPTIONS: Array<{ value: PageTextLayout; label: string; short: string }> = [
  {
    value: 'below-image',
    label: 'Below Illustration — Classic Picture Book',
    short: 'Below Art',
  },
  {
    value: 'overlay-bottom',
    label: 'Story Card Over Art — Bottom Banner',
    short: 'Bottom Card',
  },
  {
    value: 'overlay-top',
    label: 'Story Card Over Art — Top Banner',
    short: 'Top Card',
  },
  {
    value: 'facing-page',
    label: 'Facing-Page Spread — Story Left, Art Right',
    short: 'Facing Spread',
  },
  {
    value: 'none',
    label: 'Artwork Only — No Text',
    short: 'Art Only',
  },
];
