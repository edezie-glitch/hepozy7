/**
 * Formats a quota reset ISO timestamp into a human-readable countdown string.
 *
 * @param resetAt - ISO timestamp or date string from the backend (quota_reset_at)
 * @param referenceNow - Optional reference Date for deterministic testing
 * @returns Human-readable countdown string
 */
export function formatQuotaResetCountdown(
  resetAt?: string | null,
  referenceNow?: Date
): string {
  if (!resetAt || typeof resetAt !== 'string' || resetAt.trim() === '') {
    return 'Quota will reset shortly.';
  }

  const targetDate = new Date(resetAt);
  if (isNaN(targetDate.getTime())) {
    return 'Quota will reset shortly.';
  }

  const now = referenceNow || new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Quota has reset. You can now send messages.';
  }

  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  const countdownText = parts.length > 0 ? parts.join(' ') : 'less than a minute';
  return `You can send again in ${countdownText}.`;
}
