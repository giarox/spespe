export const HI_RES_MIN_DIMENSION = Number(process.env.LIDL_HI_RES_MIN_DIMENSION ?? 2400);

/**
 * Extract the WIDTH/HEIGHT tuple from Schwarz imgproxy rs:fit directives.
 */
export function getImgProxyFitDimensions(url: string): { width: number; height: number } | null {
  const match = url.match(/rs:fit:(\d+):(\d+)/);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  return { width, height };
}

export function isHighResUrl(url: string): boolean {
  const fit = getImgProxyFitDimensions(url);
  if (!fit) {
    return false;
  }
  return Math.max(fit.width, fit.height) >= HI_RES_MIN_DIMENSION;
}
