/** Encabezado de columna ordenable. */
import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react';
import type { SortState } from '../lib/hooks';
import { cx } from './controls';

export function SortTh({
  label,
  k,
  sort,
  setSort,
  num,
  className,
}: {
  label: string;
  k: string;
  sort: SortState | null | undefined;
  setSort: (k: string) => void;
  num?: boolean;
  className?: string;
}) {
  const active = sort?.key === k;
  const Icon = !active ? ArrowDownUp : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={cx('sortable', num && 'num', className)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      onClick={() => setSort(k)}
      scope="col"
    >
      {label}
      <Icon className="sort-ico" aria-hidden="true" />
    </th>
  );
}
