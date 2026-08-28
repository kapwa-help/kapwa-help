// src/router.test.tsx
import { describe, expect, it } from 'vitest';
import { floodWatchRouteConfig } from './router';

describe('floodWatchRouteConfig', () => {
  it('serves clean paths (plus legacy redirects) on the flood watch host', () => {
    expect(floodWatchRouteConfig(true).map((r) => r.path)).toEqual([
      '/',
      '/admin',
      '/login',
      '/floodwatch',
      '/floodwatch/admin',
      '/floodwatch/login',
    ]);
  });

  it('serves the landing page plus /floodwatch paths on other hosts', () => {
    expect(floodWatchRouteConfig(false).map((r) => r.path)).toEqual([
      '/',
      '/floodwatch',
      '/floodwatch/admin',
      '/floodwatch/login',
    ]);
  });
});
