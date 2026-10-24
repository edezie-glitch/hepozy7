import { describe, it, expect } from 'vitest';
import { formatQuotaResetCountdown } from '@/lib/quota';

describe('formatQuotaResetCountdown', () => {
  it('returns friendly fallback when resetAt is null or undefined', () => {
    expect(formatQuotaResetCountdown(null)).toBe('Quota will reset shortly.');
    expect(formatQuotaResetCountdown(undefined)).toBe('Quota will reset shortly.');
    expect(formatQuotaResetCountdown('')).toBe('Quota will reset shortly.');
  });

  it('returns friendly fallback when resetAt is an invalid date string', () => {
    expect(formatQuotaResetCountdown('not-a-valid-date')).toBe('Quota will reset shortly.');
  });

  it('returns reset notice if resetAt is in the past', () => {
    const pastDate = new Date(Date.now() - 1000 * 60).toISOString();
    expect(formatQuotaResetCountdown(pastDate)).toBe('Quota has reset. You can now send messages.');
  });

  it('formats countdown with both hours and minutes', () => {
    const fixedNow = new Date('2026-10-14T12:00:00Z');
    // 2 hours and 15 minutes in the future
    const resetDate = new Date('2026-10-14T14:15:00Z').toISOString();

    const result = formatQuotaResetCountdown(resetDate, fixedNow);
    expect(result).toContain('in 2 hours 15 minutes');
  });

  it('formats countdown with minutes only when less than one hour remains', () => {
    const fixedNow = new Date('2026-10-14T12:00:00Z');
    // 45 minutes in the future
    const resetDate = new Date('2026-10-14T12:45:00Z').toISOString();

    const result = formatQuotaResetCountdown(resetDate, fixedNow);
    expect(result).toContain('in 45 minutes');
  });

  it('formats countdown with single hour and single minute singular forms', () => {
    const fixedNow = new Date('2026-10-14T12:00:00Z');
    // 1 hour and 1 minute in the future
    const resetDate = new Date('2026-10-14T13:01:00Z').toISOString();

    const result = formatQuotaResetCountdown(resetDate, fixedNow);
    expect(result).toContain('in 1 hour 1 minute');
  });

  it('formats countdown with exact hours when minutes remainder is zero', () => {
    const fixedNow = new Date('2026-10-14T12:00:00Z');
    // exactly 3 hours in the future
    const resetDate = new Date('2026-10-14T15:00:00Z').toISOString();

    const result = formatQuotaResetCountdown(resetDate, fixedNow);
    expect(result).toContain('in 3 hours');
  });
});
