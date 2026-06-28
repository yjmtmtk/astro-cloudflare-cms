import { config } from 'virtual:acc-config';
import { useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function CategorySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch(`${config.adminBasePath}/api/categories`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: unknown) => setCategories(data as Category[]))
      .catch(() => {/* ignore fetch errors gracefully */});
  }, []);

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
    >
      <option value="">（カテゴリなし）</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}
