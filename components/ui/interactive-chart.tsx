'use client';

import * as React from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface ChartDataPoint {
  id?: string;
  label: string;
  value: number;
  color?: string;
  secondaryLabel?: string;
}

export interface InteractiveChartBaseProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  loading?: boolean;
  className?: string;
}

export interface InteractiveDonutChartProps extends InteractiveChartBaseProps {
  centerLabel?: string;
  centerValue?: string | number;
}

export interface InteractiveChartProps extends InteractiveDonutChartProps {
  type: 'bar' | 'line' | 'donut';
}

const DEFAULT_PALETTE = [
  '#00A3FF', // Electric Cyan
  '#0066FF', // Royal Blue
  '#00C2FF', // Cyan Accent
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#38BDF8', // Sky Cyan
];

function sanitizeValue(val: number): number {
  return Number.isFinite(val) && val > 0 ? val : 0;
}

function defaultFormat(value: number): string {
  return value.toLocaleString('ar-EG');
}

function ChartShell({
  title,
  subtitle,
  activePoint,
  valueFormatter,
  loading,
  height,
  isEmpty,
  emptyLabel,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  activePoint: ChartDataPoint | null;
  valueFormatter: (value: number) => string;
  loading?: boolean;
  height: number;
  isEmpty: boolean;
  emptyLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground p-5 shadow-soft-sm',
        className
      )}
    >
      {(title || subtitle || activePoint) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="space-y-0.5 text-start">
            {title && <h3 className="text-base font-bold text-foreground">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {activePoint && !loading && !isEmpty && (
            <div
              role="status"
              aria-live="polite"
              data-testid="chart-tooltip"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-cyan-500/30 bg-brand-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-foreground self-start sm:self-auto"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activePoint.color ?? '#00A3FF' }}
              />
              <span>{activePoint.label}:</span>
              <span className="font-extrabold text-brand-cyan-600 dark:text-brand-cyan-400 tabular-nums">
                {valueFormatter(sanitizeValue(activePoint.value))}
              </span>
              {activePoint.secondaryLabel && (
                <span className="text-muted-foreground">({activePoint.secondaryLabel})</span>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div
          role="status"
          aria-label="جاري التحميل..."
          className="flex items-end gap-3 pt-4"
          style={{ height }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rect"
              className="flex-1 rounded-t-lg"
              style={{ height: `${40 + ((i * 19) % 55)}%` }}
            />
          ))}
          <span className="sr-only">جاري التحميل...</span>
        </div>
      ) : isEmpty ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/20"
          style={{ height }}
        >
          <BarChart3 className="h-7 w-7 text-brand-cyan-500/70" aria-hidden="true" />
          <p className="text-sm font-medium">{emptyLabel}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function InteractiveBarChart({
  data,
  title,
  subtitle,
  height = 220,
  valueFormatter = defaultFormat,
  emptyLabel = 'لا توجد بيانات للعرض',
  loading = false,
  className,
}: InteractiveChartBaseProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const gradientId = React.useId();

  const safeData = React.useMemo(
    () =>
      data.map((d, idx) => ({
        ...d,
        value: sanitizeValue(d.value),
        color: d.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
      })),
    [data]
  );

  const maxValue = React.useMemo(() => {
    const max = Math.max(0, ...safeData.map((d) => d.value));
    return max > 0 ? max : 1;
  }, [safeData]);

  const svgWidth = 560;
  const svgHeight = Math.max(160, height);
  const padTop = 16;
  const padBottom = 34;
  const padX = 20;
  const plotHeight = svgHeight - padTop - padBottom;
  const plotWidth = svgWidth - padX * 2;
  const slotWidth = safeData.length > 0 ? plotWidth / safeData.length : plotWidth;
  const barWidth = Math.min(44, Math.max(14, slotWidth * 0.56));

  const activePoint = activeIndex !== null ? safeData[activeIndex] ?? null : null;

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      activePoint={activePoint}
      valueFormatter={valueFormatter}
      loading={loading}
      height={height}
      isEmpty={safeData.length === 0}
      emptyLabel={emptyLabel}
      className={className}
    >
      <div className="w-full overflow-x-auto">
        <svg
          role="img"
          aria-label={title ?? 'مخطط أعمدة تفاعلي'}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[320px] select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00C2FF" />
              <stop offset="100%" stopColor="#0066FF" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padX}
                x2={svgWidth - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.09}
                strokeDasharray="4 4"
              />
            );
          })}

          {safeData.map((point, idx) => {
            const ratio = point.value / maxValue;
            const barH = point.value > 0 ? Math.max(4, ratio * plotHeight) : 2;
            const x = padX + idx * slotWidth + (slotWidth - barWidth) / 2;
            const y = padTop + plotHeight - barH;
            const isActive = activeIndex === idx;

            return (
              <g
                key={point.id ?? `${point.label}-${idx}`}
                tabIndex={0}
                role="button"
                aria-label={`${point.label}: ${valueFormatter(point.value)}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(idx)}
                onBlur={() => setActiveIndex(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev === idx ? null : idx));
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={6}
                  fill={point.color ?? `url(#${gradientId})`}
                  fillOpacity={activeIndex === null || isActive ? 1 : 0.45}
                  className="transition-opacity duration-150 motion-reduce:transition-none"
                />
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px] font-medium"
                >
                  {point.label.length > 10 ? `${point.label.slice(0, 10)}…` : point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartShell>
  );
}

export function InteractiveLineChart({
  data,
  title,
  subtitle,
  height = 220,
  valueFormatter = defaultFormat,
  emptyLabel = 'لا توجد بيانات للعرض',
  loading = false,
  className,
}: InteractiveChartBaseProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const areaGradientId = React.useId();

  const safeData = React.useMemo(
    () =>
      data.map((d) => ({
        ...d,
        value: sanitizeValue(d.value),
        color: d.color ?? '#00A3FF',
      })),
    [data]
  );

  const maxValue = React.useMemo(() => {
    const max = Math.max(0, ...safeData.map((d) => d.value));
    return max > 0 ? max : 1;
  }, [safeData]);

  const svgWidth = 560;
  const svgHeight = Math.max(160, height);
  const padTop = 18;
  const padBottom = 34;
  const padX = 28;
  const plotHeight = svgHeight - padTop - padBottom;
  const plotWidth = svgWidth - padX * 2;

  const coords = safeData.map((point, idx) => {
    const x =
      safeData.length <= 1
        ? padX + plotWidth / 2
        : padX + (idx / (safeData.length - 1)) * plotWidth;
    const y = padTop + plotHeight - (point.value / maxValue) * plotHeight;
    return { x, y, point };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(' ');

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${(padTop + plotHeight).toFixed(2)} L ${coords[0].x.toFixed(2)} ${(padTop + plotHeight).toFixed(2)} Z`
      : '';

  const activePoint = activeIndex !== null ? safeData[activeIndex] ?? null : null;

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      activePoint={activePoint}
      valueFormatter={valueFormatter}
      loading={loading}
      height={height}
      isEmpty={safeData.length === 0}
      emptyLabel={emptyLabel}
      className={className}
    >
      <div className="w-full overflow-x-auto">
        <svg
          role="img"
          aria-label={title ?? 'مخطط خطي تفاعلي'}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[320px] select-none"
        >
          <defs>
            <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00A3FF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#00A3FF" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padX}
                x2={svgWidth - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.09}
                strokeDasharray="4 4"
              />
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${areaGradientId})`} />}

          {coords.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#00A3FF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map(({ x, y, point }, idx) => {
            const isActive = activeIndex === idx;
            return (
              <g
                key={point.id ?? `${point.label}-${idx}`}
                tabIndex={0}
                role="button"
                aria-label={`${point.label}: ${valueFormatter(point.value)}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(idx)}
                onBlur={() => setActiveIndex(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev === idx ? null : idx));
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 7 : 5}
                  fill={isActive ? '#00C2FF' : '#0066FF'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px] font-medium"
                >
                  {point.label.length > 10 ? `${point.label.slice(0, 10)}…` : point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartShell>
  );
}

export function InteractiveDonutChart({
  data,
  title,
  subtitle,
  height = 220,
  valueFormatter = defaultFormat,
  emptyLabel = 'لا توجد بيانات للعرض',
  loading = false,
  centerLabel,
  centerValue,
  className,
}: InteractiveDonutChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const safeData = React.useMemo(
    () =>
      data.map((d, idx) => ({
        ...d,
        value: sanitizeValue(d.value),
        color: d.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
      })),
    [data]
  );

  const total = React.useMemo(
    () => safeData.reduce((acc, item) => acc + item.value, 0),
    [safeData]
  );

  const size = Math.min(200, Math.max(150, height));
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const activePoint = activeIndex !== null ? safeData[activeIndex] ?? null : null;

  let cumulativeFraction = 0;

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      activePoint={activePoint}
      valueFormatter={valueFormatter}
      loading={loading}
      height={height}
      isEmpty={safeData.length === 0}
      emptyLabel={emptyLabel}
      className={className}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            role="img"
            aria-label={title ?? 'مخطط دائري تفاعلي'}
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-full -rotate-90 select-none"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth={strokeWidth}
            />
            {total > 0 &&
              safeData.map((slice, idx) => {
                const fraction = slice.value / total;
                const dashLength = fraction * circumference;
                const dashOffset = -cumulativeFraction * circumference;
                cumulativeFraction += fraction;
                const isActive = activeIndex === idx;

                return (
                  <circle
                    key={slice.id ?? `${slice.label}-${idx}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${dashLength.toFixed(2)} ${circumference.toFixed(2)}`}
                    strokeDashoffset={dashOffset.toFixed(2)}
                    strokeOpacity={activeIndex === null || isActive ? 1 : 0.45}
                    tabIndex={0}
                    role="button"
                    aria-label={`${slice.label}: ${valueFormatter(slice.value)}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(idx)}
                    onBlur={() => setActiveIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveIndex((prev) => (prev === idx ? null : idx));
                      }
                    }}
                    className="cursor-pointer outline-none transition-opacity duration-150 motion-reduce:transition-none"
                  />
                );
              })}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="text-lg font-extrabold text-foreground tabular-nums">
              {activePoint
                ? valueFormatter(activePoint.value)
                : centerValue !== undefined
                  ? centerValue
                  : valueFormatter(total)}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-full">
              {activePoint ? activePoint.label : centerLabel ?? 'الإجمالي'}
            </span>
          </div>
        </div>

        <ul className="flex-1 w-full space-y-2">
          {safeData.map((slice, idx) => {
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            const isActive = activeIndex === idx;
            return (
              <li key={slice.id ?? `${slice.label}-${idx}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(idx)}
                  onBlur={() => setActiveIndex(null)}
                  onClick={() => setActiveIndex((prev) => (prev === idx ? null : idx))}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500',
                    isActive ? 'bg-accent/70' : 'hover:bg-muted/60'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-semibold text-foreground truncate">
                      {slice.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="font-bold text-foreground">
                      {valueFormatter(slice.value)}
                    </span>
                    <span className="text-muted-foreground">({pct}%)</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartShell>
  );
}

export function InteractiveChart({ type, ...props }: InteractiveChartProps) {
  if (type === 'line') {
    return <InteractiveLineChart {...props} />;
  }
  if (type === 'donut') {
    return <InteractiveDonutChart {...props} />;
  }
  return <InteractiveBarChart {...props} />;
}
