export function sameReference(left, right) {
  return left.object === right.object && left.generation === right.generation;
}
