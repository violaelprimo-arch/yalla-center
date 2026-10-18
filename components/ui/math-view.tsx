import React from 'react';
import katex from 'katex';
import { cn } from '@/lib/utils';

export interface MathViewProps {
  math: string;
  display?: boolean;
  className?: string;
}

/**
 * Renders mathematical expressions using KaTeX with strict LTR isolation
 * Handles Egyptian secondary curriculum science/math equations inside Arabic RTL text.
 */
export function MathView({ math, display = false, className }: MathViewProps) {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });
    } catch (error) {
      console.error('KaTeX rendering error:', error);
      return `<span class="text-destructive font-mono text-xs">[خطأ في الصيغة الرياضية: ${math}]</span>`;
    }
  }, [math, display]);

  return (
    <span
      dir="ltr"
      className={cn(
        'inline-block select-text font-sans antialiased text-start',
        display && 'block w-full text-center overflow-x-auto py-2 my-2',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
