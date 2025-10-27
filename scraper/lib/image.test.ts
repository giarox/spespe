import test from "node:test";
import assert from "node:assert/strict";
import { getImgProxyFitDimensions, isHighResUrl, HI_RES_MIN_DIMENSION } from "./image";

test("getImgProxyFitDimensions extracts width/height from rs:fit directive", () => {
  const dims = getImgProxyFitDimensions("https://example.com/rs:fit:2400:2400/some-image.png");
  assert.deepEqual(dims, { width: 2400, height: 2400 });
});

test("getImgProxyFitDimensions returns null when no directive is present", () => {
  assert.equal(getImgProxyFitDimensions("https://example.com/image.png"), null);
});

test("isHighResUrl enforces minimum dimension threshold", () => {
  const below = `https://example.com/rs:fit:${HI_RES_MIN_DIMENSION - 1}:${HI_RES_MIN_DIMENSION - 1}/image.png`;
  const meets = `https://example.com/rs:fit:${HI_RES_MIN_DIMENSION}:${HI_RES_MIN_DIMENSION}/image.png`;
  assert.equal(isHighResUrl(below), false);
  assert.equal(isHighResUrl(meets), true);
});
