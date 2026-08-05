import type { WhiteboardElement } from '@whiteboard/shared';

export const EXPORT_FORMATS = ['json', 'svg', 'png', 'jpeg', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Raster export resolution relative to the document's world units. */
export const EXPORT_DEFAULT_SCALE = 2;
export const EXPORT_MAX_SCALE = 8;

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
};

export interface ExportOptions {
  /** Raster (png/jpeg/pdf) pixel scale relative to world units. */
  scale?: number;
  /** Background colour; `null` keeps transparency (png/svg only). */
  background?: string | null;
  /** World-unit padding added around the document bounds. */
  padding?: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  format: ExportFormat;
}

export type ImportFileKind = 'json' | 'svg' | 'image';

export interface ImportedBoardFile {
  kind: ImportFileKind;
  elements: WhiteboardElement[];
}

export const EXPORT_FILE_EXTENSIONS: Record<ExportFormat, string> = {
  json: 'json',
  svg: 'svg',
  png: 'png',
  jpeg: 'jpg',
  pdf: 'pdf',
};
