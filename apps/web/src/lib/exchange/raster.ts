import type { ExportOptions, ExportFormat } from './types';

export interface RasterizeOptions {
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  background?: string | null;
}

/** Renders an SVG string onto a canvas of the given pixel size. */
export async function renderSvgToCanvas(
  svg: string,
  options: RasterizeOptions,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(options.width));
    canvas.height = Math.max(1, Math.round(options.height));
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('Canvas 2D context is not available');
    }
    if (options.background !== null && options.background !== undefined) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render the board image'));
    image.src = src;
  });
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: 'image/png' | 'image/jpeg',
  quality?: number,
): Promise<Blob> {
  if (mime === 'image/jpeg') {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob === null) {
            reject(new Error('Could not encode the board image'));
          } else {
            resolve(blob);
          }
        },
        mime,
        quality ?? 0.92,
      );
    });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('Could not encode the board image'));
      } else {
        resolve(blob);
      }
    }, mime);
  });
}

/**
 * Rasterizes an SVG string. For JPEG a solid background is forced because the
 * format cannot represent transparency.
 */
export async function rasterizeSvg(
  svg: string,
  options: {
    format: 'png' | 'jpeg';
    scale: number;
    width: number;
    height: number;
    background?: string | null;
  },
): Promise<Blob> {
  const mime = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const background =
    options.format === 'jpeg'
      ? (options.background ?? '#ffffff')
      : options.background;
  const canvas = await renderSvgToCanvas(svg, {
    mime,
    width: options.width * options.scale,
    height: options.height * options.scale,
    background,
  });
  return canvasToBlob(
    canvas,
    mime,
    options.format === 'jpeg' ? 0.92 : undefined,
  );
}

export interface ExportSvgResult {
  svg: string;
  width: number;
  height: number;
}

export type RasterFormat = Extract<ExportFormat, 'png' | 'jpeg'>;

export function resolveExportOptions(
  options: ExportOptions,
): Required<Pick<ExportOptions, 'scale'>> {
  return { scale: options.scale ?? 2 };
}
