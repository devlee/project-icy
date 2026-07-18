import type { FactorCategory } from "@icy/shared";

export type FactorPreset = {
  category: FactorCategory;
  name: string;
  promptFragment: string;
  negativeFragment?: string;
};

/** Common scene / outfit / lighting / style presets for MVP seeding (not the full 300 library). */
export const FACTOR_PRESETS: FactorPreset[] = [
  // scene
  { category: "scene", name: "海边", promptFragment: "sunny beach, ocean horizon, soft sand" },
  { category: "scene", name: "咖啡馆", promptFragment: "cozy cafe interior, warm wood, soft bokeh" },
  { category: "scene", name: "雨夜街巷", promptFragment: "rainy night street, neon reflections, wet asphalt" },
  { category: "scene", name: "樱花树下", promptFragment: "under cherry blossom tree, falling petals, spring" },
  { category: "scene", name: "屋顶天台", promptFragment: "rooftop at dusk, city skyline, wind" },
  { category: "scene", name: "图书馆", promptFragment: "quiet library, tall bookshelves, soft daylight" },
  { category: "scene", name: "神社石阶", promptFragment: "shrine stone steps, torii gate, moss" },
  { category: "scene", name: "教室窗边", promptFragment: "classroom by the window, afternoon light, desks" },
  { category: "scene", name: "雪原", promptFragment: "snowy field, soft snowfall, pale sky" },
  { category: "scene", name: "地铁站台", promptFragment: "subway platform, fluorescent lights, empty tracks" },

  // outfit
  { category: "outfit", name: "校服", promptFragment: "school uniform, neat collar, pleated skirt or trousers" },
  { category: "outfit", name: "便装卫衣", promptFragment: "casual hoodie, jeans, sneakers" },
  { category: "outfit", name: "浴衣", promptFragment: "yukata, obi sash, summer festival wear" },
  { category: "outfit", name: "大衣围巾", promptFragment: "long coat, wool scarf, winter layers" },
  { category: "outfit", name: "连衣裙", promptFragment: "simple dress, soft fabric, clean silhouette" },
  { category: "outfit", name: "运动装", promptFragment: "sportswear, athletic jacket, sneakers" },
  { category: "outfit", name: "西装", promptFragment: "tailored suit, crisp shirt, formal look" },
  { category: "outfit", name: "针织开衫", promptFragment: "knit cardigan over blouse, soft texture" },

  // lighting
  { category: "lighting", name: "柔光窗光", promptFragment: "soft window light, gentle shadows" },
  { category: "lighting", name: "逆光轮廓", promptFragment: "backlit silhouette, rim light, glowing edges" },
  { category: "lighting", name: "金色黄昏", promptFragment: "golden hour sunlight, warm glow" },
  { category: "lighting", name: "霓虹夜色", promptFragment: "neon night lighting, magenta and cyan accents" },
  { category: "lighting", name: "阴天漫射", promptFragment: "overcast soft light, even diffusion" },
  { category: "lighting", name: "烛光", promptFragment: "candlelight, warm flicker, intimate mood" },
  { category: "lighting", name: "舞台聚光", promptFragment: "stage spotlight, dramatic contrast" },
  { category: "lighting", name: "月光", promptFragment: "cool moonlight, soft blue tones" },

  // style
  {
    category: "style",
    name: "清透日系",
    promptFragment: "clean japanese illustration style, soft colors",
    negativeFragment: "muddy colors, heavy grain",
  },
  {
    category: "style",
    name: "胶片感",
    promptFragment: "film photography look, subtle grain, natural color",
    negativeFragment: "oversaturated, plastic skin",
  },
  {
    category: "style",
    name: "电影宽画幅",
    promptFragment: "cinematic widescreen framing, shallow depth of field",
  },
  {
    category: "style",
    name: "柔焦氛围",
    promptFragment: "soft focus atmosphere, dreamy haze",
    negativeFragment: "harsh sharpness, clinical lighting",
  },
  {
    category: "style",
    name: "高对比黑白",
    promptFragment: "high contrast black and white, graphic tones",
  },
  {
    category: "style",
    name: "水彩淡彩",
    promptFragment: "watercolor wash, delicate pastel tones",
  },
];
