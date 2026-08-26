/**
 * 生成 PWA 应用图标（纯 Node 实现，无第三方依赖）。
 *
 * 用法：node scripts/generate-icons.mjs
 * 输出：public/ 下的 icon-192.png、icon-512.png（purpose: any，圆角透明底）
 *      icon-maskable-192.png、icon-maskable-512.png（purpose: maskable，全出血背景）
 *      apple-touch-icon.png（180x180，全出血背景，iOS 添加到主屏幕用）
 *
 * 图形沿用原 SVG 设计：#FAFAFA 底 + 白色笔记卡片（黑色描边）+ 三条书写线，
 * 使用带符号距离场（SDF）逐像素绘制，天然抗锯齿。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// ===== 设计稿（192 坐标系，与原 icon SVG 完全一致）=====
const BG = [0xfa, 0xfa, 0xfa]; // #FAFAFA 背景
const CARD = [0xff, 0xff, 0xff]; // #FFFFFF 卡片
const INK = [0x1a, 0x1a, 0x1a]; // #1A1A1A 线条
const CORNER_R = 24; // 背景圆角半径（any 图标用）
const CARD_RECT = { x: 48, y: 40, w: 96, h: 112, r: 8 }; // 笔记卡片
const STROKE = 4; // 描边宽度
const LINES = [
  [64, 72, 128, 72],
  [64, 96, 128, 96],
  [64, 120, 104, 120],
]; // 三条书写线（起止点）

// ===== PNG 编码 =====
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** RGBA 像素缓冲（Float32 每通道）编码为 PNG */
function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (width * 4 + 1) + 1 + x * 4;
      raw[di] = Math.round(rgba[si]);
      raw[di + 1] = Math.round(rgba[si + 1]);
      raw[di + 2] = Math.round(rgba[si + 2]);
      raw[di + 3] = Math.round(rgba[si + 3]);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ===== SDF 绘制原语 =====
/** 圆角矩形的有符号距离（负值在内部） */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ax, ay) - r;
}

/** 点到线段距离（用于圆头线条） */
function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/** 距离 → 1px 抗锯齿覆盖率 */
function coverage(d) {
  return Math.max(0, Math.min(1, 0.5 - d));
}

/** source-over 合成 src（含 alpha）到 dst */
function blend(dst, i, color, alpha) {
  if (alpha <= 0) return;
  const da = dst[i + 3] / 255;
  const sa = alpha;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) {
    dst[i + 3] = 0;
    return;
  }
  for (let c = 0; c < 3; c++) {
    dst[i + c] = (color[c] * sa + dst[i + c] * da * (1 - sa)) / outA;
  }
  dst[i + 3] = outA * 255;
}

/**
 * 渲染图标。
 * @param size 输出尺寸（px）
 * @param maskable true=全出血方形背景（maskable / apple-touch）；false=圆角透明背景（any）
 */
function renderIcon(size, maskable) {
  const rgba = new Float32Array(size * size * 4);
  const s = size / 192; // 设计稿坐标 → 输出像素
  const card = {
    cx: (CARD_RECT.x + CARD_RECT.w / 2) * s,
    cy: (CARD_RECT.y + CARD_RECT.h / 2) * s,
    hw: (CARD_RECT.w / 2) * s,
    hh: (CARD_RECT.h / 2) * s,
    r: CARD_RECT.r * s,
  };
  const half = s / 2; // 半像素，用于像素中心采样

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + half;
      const py = y + half;
      const i = (y * size + x) * 4;

      // 1. 背景
      if (maskable) {
        rgba[i] = BG[0];
        rgba[i + 1] = BG[1];
        rgba[i + 2] = BG[2];
        rgba[i + 3] = 255;
      } else {
        const d = sdRoundRect(px, py, size / 2, size / 2, size / 2 - half, size / 2 - half, CORNER_R * s);
        blend(rgba, i, BG, coverage(d));
      }

      // 2. 白色卡片填充
      const dCard = sdRoundRect(px, py, card.cx, card.cy, card.hw, card.hh, card.r);
      blend(rgba, i, CARD, coverage(dCard));

      // 3. 卡片描边（骑在填充边界上）
      blend(rgba, i, INK, coverage(Math.abs(dCard) - (STROKE * s) / 2));

      // 4. 三条书写线（圆头）
      for (const [x1, y1, x2, y2] of LINES) {
        const d = sdSegment(px, py, x1 * s, y1 * s, x2 * s, y2 * s);
        blend(rgba, i, INK, coverage(d - (STROKE * s) / 2));
      }
    }
  }
  return rgba;
}

function generate(name, size, maskable) {
  const png = encodePNG(size, size, renderIcon(size, maskable));
  const out = join(PUBLIC_DIR, name);
  writeFileSync(out, png);
  console.log(`✓ ${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

generate('icon-192.png', 192, false);
generate('icon-512.png', 512, false);
generate('icon-maskable-192.png', 192, true);
generate('icon-maskable-512.png', 512, true);
generate('apple-touch-icon.png', 180, true);
