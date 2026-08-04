/** Creates a collision-resistant element id. */
export function createElementId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `el-${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `el-${Date.now().toString(36)}-${random}`;
}
