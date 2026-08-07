import { describe, expect, it, vi } from 'vitest';
import { createEmptyWhiteboardDocument } from '@whiteboard/shared';

const mockPage = { drawImage: vi.fn() };
const mockPdf = {
  embedPng: vi.fn(),
  addPage: vi.fn(() => mockPage),
  save: vi.fn(),
};

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: vi.fn(async () => mockPdf),
  },
}));

vi.mock('@/lib/exchange/raster', () => ({
  rasterizeSvg: vi.fn(),
}));

import { documentToPdf } from '@/lib/exchange/pdf';
import { rasterizeSvg } from '@/lib/exchange/raster';

describe('documentToPdf', () => {
  function mockPng(bytes: Uint8Array): {
    arrayBuffer: () => Promise<ArrayBuffer>;
  } {
    return { arrayBuffer: async () => bytes.buffer as ArrayBuffer };
  }

  it('rasterizes the svg at 2x and embeds the png in a single page', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.mocked(rasterizeSvg).mockResolvedValue(mockPng(bytes) as Blob);
    vi.mocked(mockPdf.embedPng).mockResolvedValue('image-ref');
    vi.mocked(mockPdf.save).mockResolvedValue(new Uint8Array([9, 9, 9]));

    const result = await documentToPdf(createEmptyWhiteboardDocument());

    expect(rasterizeSvg).toHaveBeenCalledWith(
      expect.stringContaining('<svg'),
      expect.objectContaining({ format: 'png', scale: 2 }),
    );
    expect(mockPdf.embedPng).toHaveBeenCalledWith(bytes);
    expect(mockPdf.addPage).toHaveBeenCalledTimes(1);
    expect(mockPage.drawImage).toHaveBeenCalledWith('image-ref', {
      x: 0,
      y: 0,
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(result).toEqual(new Uint8Array([9, 9, 9]));
  });

  it('honours an explicit scale and background', async () => {
    vi.mocked(rasterizeSvg).mockResolvedValue(
      mockPng(new Uint8Array([0])) as Blob,
    );
    vi.mocked(mockPdf.embedPng).mockResolvedValue('image-ref');
    vi.mocked(mockPdf.save).mockResolvedValue(new Uint8Array([]));

    await documentToPdf(createEmptyWhiteboardDocument(), {
      scale: 3,
      background: '#ffffff',
    });

    expect(rasterizeSvg).toHaveBeenCalledWith(
      expect.stringContaining('<svg'),
      expect.objectContaining({ scale: 3, background: '#ffffff' }),
    );
  });
});
