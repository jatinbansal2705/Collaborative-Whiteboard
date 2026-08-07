import type { WhiteboardDocument } from '@whiteboard/shared';
import { rasterizeSvg } from './raster';
import { documentToSvg } from './svg';
import type { ExportOptions } from './types';

/** Builds a single-page PDF embedding the document rasterized at 2x. */
export async function documentToPdf(
  document: WhiteboardDocument,
  options: ExportOptions = {},
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const svg = documentToSvg(document, options);
  const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? '100');
  const height = Number(/height="(\d+)"/.exec(svg)?.[1] ?? '100');
  const scale = options.scale ?? 2;
  const png = await rasterizeSvg(svg, {
    format: 'png',
    scale,
    width,
    height,
    background: options.background,
  });
  const bytes = new Uint8Array(await png.arrayBuffer());
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(bytes);
  const page = pdf.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return pdf.save();
}
