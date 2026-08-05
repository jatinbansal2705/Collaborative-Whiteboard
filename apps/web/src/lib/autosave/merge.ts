import type { WhiteboardDocument } from '@whiteboard/shared';

/**
 * Merges the local (dirty) document with the authoritative server document
 * under element-level last-writer-wins (ADR-0004). Each element resolves by
 * `version`; on a tie the authoritative copy wins because it is the persisted
 * state. Elements that exist only locally (created offline) are kept and
 * appended last so they stay on top of the z-order.
 *
 * Used when an autosave conflicts: the client re-merges against the conflict
 * payload's `currentRevision` + `data`, applies the result locally, then
 * retries the save (ADR-0005).
 */
export function mergeDocuments(
  local: WhiteboardDocument,
  authoritative: WhiteboardDocument,
): WhiteboardDocument {
  const authoritativeById = new Map(
    authoritative.elements.map((element) => [element.id, element]),
  );
  const localById = new Map(
    local.elements.map((element) => [element.id, element]),
  );

  const elements = authoritative.elements.map((element) => {
    const localElement = localById.get(element.id);
    if (localElement !== undefined && localElement.version > element.version) {
      return localElement;
    }
    return element;
  });

  for (const element of local.elements) {
    if (!authoritativeById.has(element.id)) {
      elements.push(element);
    }
  }

  return { schemaVersion: authoritative.schemaVersion, elements };
}

/** Order-sensitive structural equality used to skip redundant saves. */
export function documentsEqual(
  first: WhiteboardDocument,
  second: WhiteboardDocument,
): boolean {
  if (first.elements.length !== second.elements.length) {
    return false;
  }
  return first.elements.every((element, index) => {
    const other = second.elements[index];
    return (
      other !== undefined && JSON.stringify(element) === JSON.stringify(other)
    );
  });
}
