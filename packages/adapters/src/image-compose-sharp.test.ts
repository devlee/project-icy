import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { SharpImageCompose } from "./image-compose-sharp";

async function solidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

describe("SharpImageCompose", () => {
  it("builds side-by-side composite and platform exports", async () => {
    const anime = await solidPng(200, 300, { r: 40, g: 80, b: 200 });
    const real = await solidPng(220, 280, { r: 200, g: 120, b: 60 });
    const compose = new SharpImageCompose();
    const result = await compose.composeSideBySide({
      anime,
      real,
      declaration: "AI Generated · test",
    });

    expect(result.composite.width).toBeGreaterThan(200);
    expect(result.composite.height).toBeGreaterThan(200);
    expect(result.platforms).toHaveLength(4);
    expect(result.platforms.map((p) => `${p.platform}-${p.label}`).sort()).toEqual(
      ["bilibili-16x10", "generic-1x1", "x-16x9", "xiaohongshu-3x4"].sort(),
    );

    const xhs = result.platforms.find((p) => p.platform === "xiaohongshu")!;
    expect(xhs.width).toBe(1080);
    expect(xhs.height).toBe(1440);
    const meta = await sharp(result.composite.data).metadata();
    expect(meta.format).toBe("png");
  });
});
