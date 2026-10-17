/** Encabezado de columna ordenable. */
import { ArrowDownUp, ArrowDown, ArrowUp } from 'lucide-preact';

export function SortTh({ label, k, sort, setSort, num, class: cls }) {
  const active = sort?.key === k;
  const Icon = !active ? ArrowDownUp : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th class={['sortable', num && 'num', cls].filter(Boolean).join(' ')} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} onClick={() => setSort(k)} scope="col">
      {label}
      <Icon class="sort-ico" aria-hidden="true" />
    </th>
  );
}
