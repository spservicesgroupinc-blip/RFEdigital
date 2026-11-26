import type { Product } from '../../types/workspace';
import { Select } from '../ui/Select';

interface ProductSelectorProps {
  products: Product[];
  productId: string;
  creatingNew: boolean;
  onChange: (value: string) => void;
}

export function ProductSelector({ products, productId, creatingNew, onChange }: ProductSelectorProps) {
  if (products.length === 0) return null;

  return (
    <Select
      aria-label="Switch active product"
      value={creatingNew ? '__new__' : productId}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[220px]"
    >
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
      <option value="__new__">+ Start New Book / Product</option>
    </Select>
  );
}
