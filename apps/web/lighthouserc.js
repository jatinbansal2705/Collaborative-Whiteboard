/* global module */
/**
 * Lighthouse CI budget assertions (docs/PERFORMANCE.md).
 * Thresholds match the PRD: LCP < 2.5s, CLS < 0.1, TBT < 200ms, and
 * WCAG AA accessibility >= 0.95. Run with:
 *   npx lhci autorun --config=./lighthouserc.js
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3001/',
        'http://localhost:3001/login',
        'http://localhost:3001/signup',
      ],
      numberOfRuns: 2,
      settings: {
        preset: 'desktop',
        throttlingMethod: 'simulate',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'aria-allowed-attr': ['error'],
        'aria-valid-attr-value': ['error'],
        'button-name': ['error'],
        'link-name': ['error'],
        'color-contrast': ['error'],
        'focus-traps': ['error'],
        'interactive-element-affordance': ['warn'],
        tabindex: ['warn'],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
