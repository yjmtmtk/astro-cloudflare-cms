export function computeFitDimensions(
  srcW: number,
  srcH: number,
  maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(srcW, srcH);
  if (longest <= maxEdge) return { width: srcW, height: srcH };
  const scale = maxEdge / longest;
  return { width: Math.round(srcW * scale), height: Math.round(srcH * scale) };
}

/**
 * Browser-only: resize an image File to fit within `maxEdge` (no upscale) and encode webp.
 * Not unit-tested (no canvas in workerd); covered by build + live smoke.
 */
export async function resizeToWebp(file: File, maxEdge = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = computeFitDimensions(bitmap.width, bitmap.height, maxEdge);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/webp', quality });
}
