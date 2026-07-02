/**
 * Returns the delay in milliseconds between now and the target ISO date.
 * Throws if the date is invalid or not in the future.
 */
export function computeDelayMs(scheduledAtIso: string): number {
  const target = new Date(scheduledAtIso);

  if (Number.isNaN(target.getTime())) {
    throw new Error(`Invalid scheduledAt datetime: ${scheduledAtIso}`);
  }

  const delay = target.getTime() - Date.now();

  if (delay <= 0) {
    throw new Error('scheduledAt must be a future datetime');
  }

  return delay;
}

export function isFutureDate(iso: string): boolean {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}
