export function sameJson(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
}
