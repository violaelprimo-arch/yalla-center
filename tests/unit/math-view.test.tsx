import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { MathView } from '@/components/ui/math-view';

describe('MathView Component & KaTeX BiDi Integration', () => {
  it('renders inline math with dir="ltr" isolation in Arabic context', () => {
    const { container } = render(<MathView math="E = mc^2" />);
    const span = container.querySelector('span[dir="ltr"]');
    expect(span).not.toBeNull();
    expect(span?.innerHTML).toContain('katex');
  });

  it('renders display equation block mode', () => {
    const { container } = render(
      <MathView math="\\int_{0}^{\\pi} \\sin(x) dx = 2" display />
    );
    const span = container.querySelector('span[dir="ltr"]');
    expect(span).not.toBeNull();
    expect(span?.className).toContain('block');
  });

  it('gracefully handles invalid math syntax without throwing runtime errors', () => {
    const { container } = render(<MathView math="\\invalid{macro" />);
    expect(container.innerHTML).toBeDefined();
  });
});
