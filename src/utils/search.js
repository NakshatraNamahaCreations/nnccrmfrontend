// One search rule for every search box: each word typed must appear somewhere, in any order.
// Case, spaces, dashes and dots are ignored, so "rent angadi" finds "RentAngadi" and
// "98450 12345" finds "+91-98450-12345".
const low = (v) => String(v ?? "").toLowerCase();
const squash = (s) => s.replace(/[\s.,:;'"_/()+#&-]/g, "");

export const searchWords = (q) => low(q).trim().split(/\s+/).filter(Boolean);

// matchesSearch(q, a, b, [c, d], ...) → true when every word of q is in one of the values
export function matchesSearch(q, ...vals) {
  const words = Array.isArray(q) ? q : searchWords(q);
  if (!words.length) return true;
  const hay = vals.flat(Infinity).map(low).join(" | "), flat = squash(hay);
  return words.every(w => hay.includes(w) || (squash(w) !== "" && flat.includes(squash(w))));
}
