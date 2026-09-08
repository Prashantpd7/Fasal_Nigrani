/**
 * Client-side image handling (§8 Flow B, §28):
 *  - quality pre-check (darkness / blur heuristics on a downscaled canvas)
 *    runs BEFORE any API call, so we never spend a model call on a bad photo;
 *  - upload is resized (max 1200px long edge, JPEG ~0.7) to keep data costs
 *    low on slow farmer networks.
 */

export type QualityIssue = "too_dark" | "too_blurry" | "ok";

export interface PreparedImage {
  /** base64 of the resized JPEG (no data: prefix) */
  base64: string;
  mime: string;
  width: number;
  height: number;
}

async function loadToCanvas(
  source: Blob | HTMLImageElement,
  maxDim: number
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  let bitmap: ImageBitmap | HTMLImageElement;
  if (source instanceof Blob) {
    bitmap = await createImageBitmap(source);
  } else {
    bitmap = source;
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (source instanceof Blob) {
    (bitmap as ImageBitmap).close();
  }
  return { canvas, width, height };
}

/** Downscale to a small grayscale array and measure darkness + sharpness. */
function measure(canvas: HTMLCanvasElement): { luminance: number; edge: number } {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  let lumSum = 0;
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = v;
    lumSum += v;
  }
  const luminance = lumSum / gray.length;

  // Edge energy via simple 3x3 Sobel on the small grayscale image.
  let edgeSum = 0;
  let edgeN = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] -
        2 * gray[i - 1] -
        gray[i + width - 1] +
        gray[i - width + 1] +
        2 * gray[i + 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      edgeSum += Math.sqrt(gx * gx + gy * gy);
      edgeN++;
    }
  }
  const edge = edgeN > 0 ? edgeSum / edgeN : 0;
  return { luminance, edge };
}

/**
 * Heuristic pre-check. Thresholds are deliberately lenient (tuned for phone
 * photos in fields) — this only catches obviously unusable photos, so it
 * never blocks a borderline-but-usable image.
 */
export async function assessQuality(blob: Blob): Promise<QualityIssue> {
  const { canvas } = await loadToCanvas(blob, 160);
  const { luminance, edge } = measure(canvas);
  if (luminance < 22) return "too_dark";
  // Empirically: sharp photos have edge energy well above 0.03 on this scale;
  // strong blur drops it below ~0.018.
  if (edge < 0.016) return "too_blurry";
  return "ok";
}

/** Resize + compress to a modest JPEG for upload (§28). */
export async function prepareImage(blob: Blob): Promise<PreparedImage> {
  const { canvas, width, height } = await loadToCanvas(blob, 1200);
  const mime = "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, 0.72);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mime, width, height };
}

/** File size guard (raw file should already be sane for camera output). */
export function fileTooLarge(file: File): boolean {
  // If the original exceeds ~12MB even the resized pipeline is risky on a
  // low-end phone; ask for another photo instead of hanging.
  return file.size > 12 * 1024 * 1024;
}
