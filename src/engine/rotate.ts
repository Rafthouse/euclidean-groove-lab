/**
 * Cyclically rotate an array by an integer amount.
 *
 * Positive `amount` rotates LEFT: the element at index `amount` moves to index
 * 0 (the groove advances -- a later step becomes the downbeat). Negative
 * rotates right. The result is always the same length; `amount` is taken modulo
 * the length, so any integer is valid.
 *
 * Musically this is the "rotation" knob: it changes WHICH onsets land on the
 * downbeat relative to a FIXED meter, without changing the pattern's interval
 * structure. (Contrast with `phase`, which slides the groove in continuous
 * time.)
 */
export function rotate<T>(items: readonly T[], amount: number): T[] {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`rotate: amount must be an integer, got ${amount}`);
  }
  const n = items.length;
  if (n === 0) return [];
  const k = ((amount % n) + n) % n;
  return items.slice(k).concat(items.slice(0, k));
}
