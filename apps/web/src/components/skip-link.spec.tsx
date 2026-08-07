import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SkipLink } from '@/components/skip-link';

afterEach(() => {
  cleanup();
});

describe('SkipLink', () => {
  it('renders a link to main content', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.getAttribute('href')).toBe('#main-content');
  });

  it('is visually hidden until focused', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.className).toContain('sr-only');
    expect(link.className).toContain('focus:not-sr-only');
  });
});
