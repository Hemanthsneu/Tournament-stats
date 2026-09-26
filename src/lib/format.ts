export const signed = (n: number, digits = 3) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;
export const signedInt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const num = (n: number, digits = 0) =>
  Number.isInteger(n) && digits === 0 ? String(n) : n.toFixed(digits);
