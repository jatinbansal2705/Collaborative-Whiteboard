import type { WhiteboardDocument } from '@whiteboard/shared';
import { imageToElement, parseDocumentJson, parseSvgImport } from './import';
import { documentToPdf } from './pdf';
import { rasterizeSvg } from './raster';
import { documentToJson, documentToSvg } from './svg';
import {
  EXPORT_DEFAULT_SCALE,
  EXPORT_FILE_EXTENSIONS,
  EXPORT_FORMATS,
  EXPORT_MIME_TYPES,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ImportedBoardFile,
} from './types';

export function buildExportFilename(
  title: string,
  format: ExportFormat,
): string {
  const base =
    title
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, '')
      .replace(/\s+/g, '-') || 'board';
  return `${base}.${EXPORT_FILE_EXTENSIONS[format]}`;
}

export async function exportBoardDocument(
  document: WhiteboardDocument,
  format: ExportFormat,
  title: string,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const filename = buildExportFilename(title, format);
  if (format === 'json') {
    return {
      blob: new Blob([documentToJson(document)], {
        type: EXPORT_MIME_TYPES.json,
      }),
      filename,
      format,
    };
  }
  const svg = documentToSvg(document, options);
  if (format === 'svg') {
    return {
      blob: new Blob([svg], { type: EXPORT_MIME_TYPES.svg }),
      filename,
      format,
    };
  }
  const width = Math.max(
    1,
    Math.ceil(Number(/width="(\d+)"/.exec(svg)?.[1] ?? '100')),
  );
  const height = Math.max(
    1,
    Math.ceil(Number(/height="(\d+)"/.exec(svg)?.[1] ?? '100')),
  );
  const scale = options.scale ?? EXPORT_DEFAULT_SCALE;
  if (format === 'png' || format === 'jpeg') {
    const blob = await rasterizeSvg(svg, {
      format,
      scale,
      width,
      height,
      background: options.background,
    });
    return { blob, filename, format };
  }
  const bytes = await documentToPdf(document, options);
  return {
    blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
      type: EXPORT_MIME_TYPES.pdf,
    }),
    filename,
    format,
  };
}

export async function downloadExport(result: ExportResult): Promise<void> {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importFileKind(file: File): ImportedBoardFile['kind'] | null {
  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    return 'json';
  }
  if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
    return 'svg';
  }
  if (
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp)$/i.test(file.name)
  ) {
    return 'image';
  }
  return null;
}

export async function importBoardFile(file: File): Promise<ImportedBoardFile> {
  const kind = importFileKind(file);
  if (kind === null) {
    throw new Error(
      'Unsupported file type. Use a JSON, SVG, PNG, JPEG or WebP board file.',
    );
  }
  if (kind === 'json') {
    const text = await file.text();
    const result = parseDocumentJson(text);
    if (!result.ok || result.document === undefined) {
      throw new Error(result.reason ?? 'The board file is invalid.');
    }
    return { kind, elements: result.document.elements };
  }
  if (kind === 'svg') {
    const text = await file.text();
    return { kind, elements: parseSvgImport(text) };
  }
  const dataUrl = await fileToDataUrl(file);
  return { kind, elements: [imageToElement(dataUrl)] };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

export type { ExportFormat, ExportOptions, ExportResult };
export { EXPORT_FORMATS, EXPORT_MIME_TYPES };
