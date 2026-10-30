// GST on a lead: `value` (Total Amount Agreed) is the amount before GST;
// GST is added on top at `gstRate` % when `gstApplicable` is on.

export const GST_RATES = [5, 12, 18, 28];

export function calcGst(value, gstApplicable, gstRate) {
  const base = Number(value) || 0;
  const rate = gstApplicable ? Number(gstRate) || 0 : 0;
  const gst  = Math.round((base * rate) / 100);
  return { base, rate, gst, total: base + gst };
}

// Remaining = grand total (incl. GST when applicable) minus the advance received
export function calcRemaining(value, advanceReceived, gstApplicable, gstRate) {
  const { total } = calcGst(value, gstApplicable, gstRate);
  return Math.max(0, total - (Number(advanceReceived) || 0));
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
