'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonTableRows } from '@/components/ui/skeleton';

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table
      ref={ref}
      dir="rtl"
      className={cn('w-full caption-bottom text-sm text-start', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-muted/60 dark:bg-brand-navy-850/90 border-b border-border [&_tr]:border-b',
      className
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0 divide-y divide-border/70', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-border bg-muted/50 font-semibold [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border/70 transition-colors hover:bg-muted/40 dark:hover:bg-brand-navy-800/40 data-[state=selected]:bg-accent/50',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, numeric = false, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-11 px-4 text-start align-middle text-xs font-bold text-muted-foreground whitespace-nowrap',
        numeric && 'tabular-nums',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, numeric = false, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3.5 align-middle text-start text-sm text-foreground',
        numeric && 'tabular-nums font-medium',
        className
      )}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-3 text-xs text-muted-foreground text-start px-4 pb-3', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  numeric?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (row: T, index: number) => string;
  loading?: boolean;
  loadingRows?: number;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filterSlot?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: T) => void;
  caption?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  loadingRows = 5,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'ابحث في الجدول...',
  filterSlot,
  emptyTitle = 'لا توجد بيانات مطابقة',
  emptyDescription,
  emptyIcon,
  onRowClick,
  caption,
  className,
}: DataTableProps<T>) {
  const [sortState, setSortState] = React.useState<{
    key: string | null;
    direction: SortDirection;
  }>({ key: null, direction: null });

  const handleToggleSort = (column: DataTableColumn<T>) => {
    const isSortable = column.sortable ?? Boolean(column.sortValue);
    if (!isSortable) return;

    setSortState((prev) => {
      if (prev.key !== column.key) {
        return { key: column.key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key: column.key, direction: 'desc' };
      }
      return { key: null, direction: null };
    });
  };

  const sortedData = React.useMemo(() => {
    if (!sortState.key || !sortState.direction) return data;
    const col = columns.find((c) => c.key === sortState.key);
    if (!col) return data;

    const extract = (row: T): string | number => {
      if (col.sortValue) return col.sortValue(row);
      const raw = (row as Record<string, unknown>)[col.key];
      if (typeof raw === 'number' || typeof raw === 'string') return raw;
      return raw == null ? '' : String(raw);
    };

    const copy = [...data];
    copy.sort((a, b) => {
      const va = extract(a);
      const vb = extract(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), 'ar');
      }
      return sortState.direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, columns, sortState]);

  const showToolbar = Boolean(onSearchChange || filterSlot);

  return (
    <div
      dir="rtl"
      className={cn(
        'w-full rounded-2xl border border-border bg-card text-card-foreground shadow-soft-sm overflow-hidden',
        className
      )}
    >
      {showToolbar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-border bg-muted/20 dark:bg-brand-navy-900/40">
          {onSearchChange ? (
            <div className="relative flex-1 max-w-md">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <input
                type="search"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full h-10 ps-9 pe-3 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 transition-colors"
              />
            </div>
          ) : (
            <div />
          )}
          {filterSlot && <div className="flex items-center gap-2 flex-wrap">{filterSlot}</div>}
        </div>
      )}

      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const isSortable = column.sortable ?? Boolean(column.sortValue);
              const isActive = sortState.key === column.key && sortState.direction !== null;
              const ariaSort: 'ascending' | 'descending' | 'none' | undefined = isSortable
                ? isActive
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;

              return (
                <TableHead
                  key={column.key}
                  numeric={column.numeric}
                  aria-sort={ariaSort}
                  className={column.headerClassName}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => handleToggleSort(column)}
                      className={cn(
                        'inline-flex items-center gap-1.5 font-bold text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 rounded px-1 -mx-1 py-0.5',
                        isActive ? 'text-brand-cyan-600 dark:text-brand-cyan-400' : 'text-muted-foreground'
                      )}
                    >
                      <span>{column.header}</span>
                      {isActive ? (
                        sortState.direction === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-3">
                <SkeletonTableRows
                  rows={loadingRows}
                  columns={Math.min(columns.length, 6)}
                />
              </TableCell>
            </TableRow>
          ) : sortedData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-12 px-6 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-12 w-12 rounded-2xl bg-muted/70 dark:bg-brand-navy-800/70 flex items-center justify-center text-brand-cyan-600 dark:text-brand-cyan-400 mb-1">
                    {emptyIcon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
                  </div>
                  <p className="text-sm font-bold text-foreground">{emptyTitle}</p>
                  {emptyDescription && (
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {emptyDescription}
                    </p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, index) => (
              <TableRow
                key={keyExtractor(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  onRowClick &&
                    'cursor-pointer focus-visible:outline-none focus-visible:bg-accent/50'
                )}
              >
                {columns.map((column) => {
                  const content = column.accessor
                    ? column.accessor(row)
                    : ((row as Record<string, unknown>)[column.key] as React.ReactNode);
                  return (
                    <TableCell
                      key={column.key}
                      numeric={column.numeric}
                      className={column.className}
                    >
                      {content}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
