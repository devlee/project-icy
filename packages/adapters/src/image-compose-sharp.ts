import sharp from "sharp";
import type {
  ComposeSideBySideInput,
  ComposeSideBySideResult,
  ImageComposePort,
  PlatformExport,
} from "@icy/core";

const GAP = 4;
const BAR_HEIGHT = 48;
const MAX_SIDE_HEIGHT = 1600;

const PLATFORM_SPECS: Array<{
  platform: PlatformExport["platform"];
  label: string;
  width: number;
  height: number;
}> = [
  { platform: "xiaohongshu", label: "3x4", width: 1080, height: 1440 },
  { platform: "x", label: "16x9", width: 1600, height: 900 },
  { platform: "generic", label: "1x1", width: 1080, height: 1080 },
  { platform: "bilibili", label: "16x10", width: 1920, height: 1200 },
];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function declarationSvg(width: number, height: number, text: string): Buffer {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${height - BAR_HEIGHT}" width="${width}" height="${BAR_HEIGHT}" fill="rgba(0,0,0,0.55)"/>
  <text x="${width / 2}" y="${height - BAR_HEIGHT / 2 + 5}"
    fill="#ffffff" font-size="18" font-family="sans-serif"
    text-anchor="middle">${escapeXml(text)}</text>
</svg>`;
  return Buffer.from(svg);
}

export class SharpImageCompose implements ImageComposePort {
  async composeSideBySide(
    input: ComposeSideBySideInput,
  ): Promise<ComposeSideBySideResult> {
    const animeMeta = await sharp(input.anime).metadata();
    const realMeta = await sharp(input.real).metadata();
    const ah = animeMeta.height ?? 1;
    const rh = realMeta.height ?? 1;
    const targetH = Math.min(MAX_SIDE_HEIGHT, Math.max(ah, rh));

    const left = await sharp(input.anime)
      .resize({ height: targetH, fit: "inside" })
      .png()
      .toBuffer({ resolveWithObject: true });
    const right = await sharp(input.real)
      .resize({ height: targetH, fit: "inside" })
      .png()
      .toBuffer({ resolveWithObject: true });

    const leftW = left.info.width;
    const rightW = right.info.width;
    const contentH = Math.max(left.info.height, right.info.height);
    const width = leftW + GAP + rightW;
    const height = contentH + BAR_HEIGHT;

    const compositeBuf = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 18, g: 18, b: 20 },
      },
    })
      .composite([
        { input: left.data, left: 0, top: Math.floor((contentH - left.info.height) / 2) },
        {
          input: right.data,
          left: leftW + GAP,
          top: Math.floor((contentH - right.info.height) / 2),
        },
        {
          input: declarationSvg(width, height, input.declaration),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const compositeMeta = await sharp(compositeBuf).metadata();
    const composite = {
      data: compositeBuf,
      width: compositeMeta.width ?? width,
      height: compositeMeta.height ?? height,
    };

    const platforms: PlatformExport[] = [];
    for (const spec of PLATFORM_SPECS) {
      const data = await sharp(compositeBuf)
        .resize(spec.width, spec.height, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      platforms.push({
        platform: spec.platform,
        label: spec.label,
        data,
        width: spec.width,
        height: spec.height,
      });
    }

    return { composite, platforms };
  }

  async enhanceImage(input: { image: Buffer }) {
    const out = await sharp(input.image)
      .sharpen({ sigma: 0.8 })
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      data: out.data,
      width: out.info.width,
      height: out.info.height,
    };
  }
}
