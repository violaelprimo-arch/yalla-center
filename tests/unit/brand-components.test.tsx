import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { BrandIcon } from '@/components/brand/brand-icon';
import { BrandLogoDark } from '@/components/brand/brand-logo-dark';
import { BrandLogoLight } from '@/components/brand/brand-logo-light';
import { BrandLogo } from '@/components/brand/brand-logo';

describe('Brand Components Asset Integrity & Aspect Ratio Preservation', () => {
  it('renders BrandIcon with square aspect-ratio wrapper', () => {
    const { container } = render(<BrandIcon size="md" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/brand/yalla-center-icon.png');
    expect(container.firstChild).toHaveClass('aspect-square');
  });

  it('renders BrandLogoDark referencing official dark logo', () => {
    const { container } = render(<BrandLogoDark width={160} height={40} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/brand/yalla-center-logo-dark.png');
  });

  it('renders BrandLogoLight referencing official light logo', () => {
    const { container } = render(<BrandLogoLight width={160} height={40} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/brand/yalla-center-logo-light.png');
  });

  it('renders adaptive BrandLogo with CSS dark:hidden and hidden dark:block toggles', () => {
    const { container } = render(<BrandLogo theme="auto" />);
    const darkWrapper = container.querySelector('.hidden.dark\\:block');
    const lightWrapper = container.querySelector('.dark\\:hidden');
    expect(darkWrapper).not.toBeNull();
    expect(lightWrapper).not.toBeNull();
  });
});
