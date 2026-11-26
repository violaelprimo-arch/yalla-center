'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionTheme } from '@/lib/motion/context';

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface AnimatedDataChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  color?: 'blue' | 'cyan' | 'emerald';
  unit?: string;
  className?: string;
}

export function AnimatedDataChart({
  data,
  title,
  height = 200,
  color = 'cyan',
  unit = 'ج.م',
  className = '',
}: AnimatedDataChartProps) {
  const { options } = useMotionTheme();
  const isReduced = options.reducedMotion;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = 560;
  const chartHeight = height - 40;
  const paddingX = 40;

  // Points for line and area path
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1 || 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - (d.value / maxValue) * (chartHeight - 30) - 10;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  const colorThemes = {
    blue: {
      stroke: '#3B82F6',
      gradStart: '#3B82F6',
      gradEnd: '#1E40AF',
    },
    cyan: {
      stroke: '#06B6D4',
      gradStart: '#06B6D4',
      gradEnd: '#38BDF8',
    },
    emerald: {
      stroke: '#10B981',
      gradStart: '#10B981',
      gradEnd: '#059669',
    },
  }[color];

  return (
    <div
      className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${className}`}
      dir="rtl"
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {title}
          </h3>
          {hoveredIdx !== null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {data[hoveredIdx].label}: {data[hoveredIdx].value.toLocaleString('ar-EG')} {unit}
            </span>
          )}
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id={`chartArea-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={colorThemes.gradStart} stopOpacity="0.35" />
              <stop offset="1" stopColor={colorThemes.gradEnd} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = chartHeight - pct * (chartHeight - 30) - 10;
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeDasharray="4 4"
                />
                <text
                  x={chartWidth - paddingX + 8}
                  y={y + 3}
                  fontSize="9"
                  fill="currentColor"
                  fillOpacity="0.4"
                  textAnchor="start"
                >
                  {Math.round(maxValue * pct)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <motion.path
            d={areaD}
            fill={`url(#chartArea-${color})`}
            initial={isReduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          />

          {/* Smooth Curved Line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke={colorThemes.stroke}
            strokeWidth="3"
            strokeLinecap="round"
            initial={isReduced ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: isReduced ? 0.001 : 0.85, ease: 'easeOut' }}
          />

          {/* Points & Hover targets */}
          {points.map((pt, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {/* Invisible wide hit area */}
              <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

              {/* Point Node */}
              <motion.circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === i ? 6 : 3.5}
                fill={hoveredIdx === i ? '#FFFFFF' : colorThemes.stroke}
                stroke={colorThemes.stroke}
                strokeWidth={hoveredIdx === i ? 3 : 2}
                transition={{ duration: 0.15 }}
              />

              {/* X Axis Label */}
              <text
                x={pt.x}
                y={chartHeight + 18}
                fontSize="10"
                fill="currentColor"
                fillOpacity={hoveredIdx === i ? 0.9 : 0.45}
                fontWeight={hoveredIdx === i ? 'bold' : 'normal'}
                textAnchor="middle"
              >
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
