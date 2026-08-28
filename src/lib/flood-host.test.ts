import { describe, expect, it } from 'vitest';
import { FLOOD_WATCH_HOST, floodPath, isFloodWatchHost } from './flood-host';

describe('flood-host', () => {
  it('detects the flood watch host', () => {
    expect(isFloodWatchHost(FLOOD_WATCH_HOST)).toBe(true);
    expect(isFloodWatchHost('kapwahelp.org')).toBe(false);
    expect(isFloodWatchHost('localhost')).toBe(false);
  });

  it('returns clean paths on the subdomain', () => {
    expect(floodPath('/', FLOOD_WATCH_HOST)).toBe('/');
    expect(floodPath('/admin', FLOOD_WATCH_HOST)).toBe('/admin');
    expect(floodPath('/login', FLOOD_WATCH_HOST)).toBe('/login');
  });

  it('returns /floodwatch paths on other hosts', () => {
    expect(floodPath('/', 'kapwahelp.org')).toBe('/floodwatch');
    expect(floodPath('/admin', 'localhost')).toBe('/floodwatch/admin');
    expect(floodPath('/login', 'kapwahelp.org')).toBe('/floodwatch/login');
  });

  it('defaults to window.location.hostname (localhost in jsdom)', () => {
    expect(floodPath('/admin')).toBe('/floodwatch/admin');
  });
});
