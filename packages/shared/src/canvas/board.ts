import { z } from 'zod';
import { whiteboardElementSchema, type WhiteboardElement } from './elements';

/**
 * The serialized board document (the `data` payload stored by the API and
 * exchanged via `board:data` in Phase 12). Kept separate from the element
 * schema so future phases can add metadata (layers, camera state) without
 * breaking element validation.
 */
export const BOARD_DOCUMENT_SCHEMA_VERSION = 1;

export const whiteboardDocumentSchema = z.object({
  schemaVersion: z.literal(BOARD_DOCUMENT_SCHEMA_VERSION),
  elements: z.array(whiteboardElementSchema),
});
export type WhiteboardDocument = z.infer<typeof whiteboardDocumentSchema>;

export function createEmptyWhiteboardDocument(): WhiteboardDocument {
  return { schemaVersion: BOARD_DOCUMENT_SCHEMA_VERSION, elements: [] };
}

export function documentFromElements(
  elements: WhiteboardElement[],
): WhiteboardDocument {
  return { schemaVersion: BOARD_DOCUMENT_SCHEMA_VERSION, elements };
}

/** Parses an unknown value into a validated document, or `null` when invalid. */
export function parseWhiteboardDocument(
  value: unknown,
): WhiteboardDocument | null {
  const result = whiteboardDocumentSchema.safeParse(value);
  return result.success ? result.data : null;
}
