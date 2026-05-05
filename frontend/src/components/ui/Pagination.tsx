import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  const delta = 2;

  for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
    pages.push(i);
  }

  if (page - delta > 2) pages.unshift('...');
  if (page + delta < totalPages - 1) pages.push('...');

  pages.unshift(1);
  if (totalPages > 1) pages.push(totalPages);

  const uniquePages = [...new Set(pages)];

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-50 disabled:pointer-events-none hover:bg-gray-50 transition-colors"
      >
        Prev
      </button>
      {uniquePages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              p === page
                ? 'bg-primary-600 text-white'
                : 'border border-gray-300 hover:bg-gray-50',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-50 disabled:pointer-events-none hover:bg-gray-50 transition-colors"
      >
        Next
      </button>
    </div>
  );
}