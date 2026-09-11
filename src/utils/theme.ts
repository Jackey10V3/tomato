/** 主题 token：全站唯一色板来源（页面里不再写死颜色） */
import { POSTERS, THEMES, type PosterKey, type ThemeKey } from '@/types/app'

export interface ThemeCssVars {
  /** 主色 */
  '--p-primary': string
  /** 深色（渐变深端 / 强调文字） */
  '--p-deep': string
  /** 浅色（渐变浅端） */
  '--p-light': string
  /** 页面背景 */
  '--p-bg': string
  /** 卡片背景 */
  '--p-card': string
  /** 毛玻璃卡片底色（半透明，配合 backdrop-filter 使用） */
  '--p-glass': string
  /** 毛玻璃高光描边色 */
  '--p-glass-line': string
  /** 弹层用：更实一点的玻璃底色，保证文字可读 */
  '--p-glass-strong': string
  /** 主文字 */
  '--p-text': string
  /** 次要文字 */
  '--p-sub': string
  '--p-radius': string
  /** 主色渐变（头部 / 强调卡） */
  '--p-grad': string
  /** 主色浅底（药丸 / 选中态 / 淡按钮） */
  '--p-soft': string
  /** 描边 */
  '--p-border': string
  /** 卡片阴影 */
  '--p-shadow': string
  [key: `--${string}`]: string
}

/* ---------------- 颜色工具 ---------------- */
function clamp(n: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, n))
}
export function hexToRgb(hex: string): [number, number, number] {
  if (typeof hex !== 'string' || !hex) return [229, 57, 53]
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16)
    return Number.isFinite(v) ? v : 0
  }
  return [n(0), n(2), n(4)]
}
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
/** 按比例混合两个颜色（t=0 取 a，t=1 取 b） */
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const c = A.map((v, i) => clamp(Math.round(v + (B[i] - v) * t)))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** 待办卡片渐变：全部由主题主色派生，保证同色系 */
export function themeCardGradient(index: number, primary: string): string {
  const variants: [number, number][] = [
    [0.05, 0.38],
    [0.15, 0.5],
    [0.0, 0.3],
    [0.22, 0.55],
    [0.1, 0.45],
    [0.18, 0.52],
    [0.02, 0.34],
    [0.12, 0.48],
  ]
  const [a, b] = variants[index % variants.length]
  const from = mixHex(primary, '#ffffff', a)
  const to = mixHex(primary, '#ffffff', b)
  return `linear-gradient(135deg, ${from}, ${to})`
}

/* ---------------- HSL 工具（用于派生和谐色板） ---------------- */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}
function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = l - c / 2
  const seg = Math.floor(hh / 60) % 6
  const rgb = ([
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg] as number[]).map(v => clamp(Math.round((v + m) * 255)))
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** 图表色板：以主题主色为基准做色相旋转，整体同一色系 */
export function chartPalette(primary: string): string[] {
  const { h, s, l } = hexToHsl(primary)
  const S = Math.max(0.45, s)
  const L = Math.min(0.62, Math.max(0.42, l))
  return [
    hslToHex(h, S, L),
    hslToHex(h + 32, S, L + 0.08),
    hslToHex(h + 64, S, L),
    hslToHex(h + 196, S, L + 0.05),
    hslToHex(h + 224, S, L),
    hslToHex(h + 256, S * 0.9, L + 0.06),
    hslToHex(h + 300, S * 0.9, L),
    hslToHex(h + 340, S, L + 0.04),
  ]
}

/**
 * 待办专属色板：一组耐看的柔和色（饱和度/亮度统一），
 * 并按「与主题主色最接近」的顺序排列，首色与主题同调，其余依次拉开色相。
 */
export function todoPalette(primary: string): string[] {
  // 精选色相锚点：玫红 / 珊瑚 / 琥珀 / 青绿 / 湖蓝 / 靛蓝 / 紫罗兰 / 粉紫
  const anchors = [352, 20, 42, 96, 158, 204, 232, 288]
  const S = 0.56
  const L = 0.66
  const { h } = hexToHsl(primary)
  // 找出与主题最接近的锚点，从它开始排列（保证首色与主题同调）
  let best = 0
  let bestD = 999
  anchors.forEach((a, i) => {
    const d = Math.min(Math.abs(a - h), 360 - Math.abs(a - h))
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  const ordered = [...anchors.slice(best), ...anchors.slice(0, best)]
  return ordered.map(a => hslToHex(a, S, L))
}

/** 统一的待办配色表：自定义颜色优先，其余按创建顺序取色（首页 / 统计 / 专注页共用） */
export function buildTodoColorMap(
  tasks: { _id: string; color?: string; createdAt: number }[],
  primary: string,
): Map<string, string> {
  const palette = todoPalette(primary)
  const ordered = [...tasks].sort((a, b) => a.createdAt - b.createdAt)
  const map = new Map<string, string>()
  let i = 0
  ordered.forEach(t => {
    if (t.color) {
      map.set(t._id, t.color)
    } else {
      map.set(t._id, palette[i % palette.length])
      i++
    }
  })
  return map
}

/**
 * 由颜色生成卡片渐变（浅→稍深，保留白字可读性）。
 * alpha < 1 时输出半透明渐变，配合 .todo 上的 backdrop-filter 就是"液态玻璃"卡片；
 * 之所以默认 1（不透明）：没有模糊兜底时半透明会看不清字。
 */
export function colorGradient(hex: string, alpha = 1): string {
  const a = mixHex(hex, '#ffffff', 0.06)
  const b = mixHex(hex, '#ffffff', 0.34)
  const from = alpha >= 1 ? a : rgba(a, alpha)
  const to = alpha >= 1 ? b : rgba(b, alpha)
  // 前面叠一层斜向高光 = 玻璃表面的流光。之所以写进渐变而不是 CSS：
  // 待办卡片的 background 是内联样式，CSS 里的 background-image 会被它覆盖。
  return (
    'linear-gradient(135deg, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 46%),' +
    `linear-gradient(135deg, ${from}, ${to})`
  )
}

/** 把 3 位色值补成 6 位、补 # 号、统一小写；非法返回 null */
export function normalizeHex(input: string): string | null {
  let v = String(input || '').trim()
  if (!v) return null
  if (v[0] !== '#') v = '#' + v
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
  }
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null
}

/**
 * 自定义选色色板：14 个色相 × 3 档明度，共 42 色。
 * 明度都压在"白字可读"的区间内，避免用户挑到过浅/过深的颜色导致卡片文字看不清。
 */
export function pickerPalette(): string[] {
  const hues = [0, 16, 32, 45, 80, 120, 152, 176, 196, 214, 236, 262, 292, 324]
  const levels: [number, number][] = [
    [0.62, 0.74],
    [0.58, 0.62],
    [0.5, 0.48],
  ]
  const out: string[] = []
  hues.forEach(h => {
    levels.forEach(([s, l]) => out.push(hslToHex(h, s, l)))
  })
  return out
}

/** 稳定哈希（同一待办每次取到同色） */
export function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/* ---------------- 主题 ---------------- */
export function themeStyle(key: ThemeKey, dark = false): ThemeCssVars {
  // 兼容旧数据里可能存在的未知主题键：回落到默认主题，避免整页白屏
  const t = THEMES[key] || THEMES.tomato
  const primary = t.primary || '#e53935'
  if (!dark) {
    return {
      '--p-primary': primary,
      '--p-deep': t.gradientDeep,
      '--p-light': t.gradientLight,
      '--p-bg': t.bg,
      '--p-card': t.card,
      '--p-glass': 'rgba(255, 255, 255, 0.72)',
      '--p-glass-line': 'rgba(255, 255, 255, 0.75)',
      '--p-glass-strong': 'rgba(255, 255, 255, 0.86)',
      '--p-text': t.text,
      '--p-sub': t.subText,
      '--p-radius': t.radius,
      '--p-grad': `linear-gradient(135deg, ${t.gradientLight}, ${primary})`,
      '--p-soft': rgba(primary, 0.1),
      '--p-border': rgba(t.text, 0.08),
      '--p-shadow': `0 8rpx 24rpx ${rgba(primary, 0.16)}`,
    }
  }
  return {
    '--p-primary': primary,
    '--p-deep': '#0d1014',
    '--p-light': t.gradientDeep,
    '--p-bg': '#14171c',
    '--p-card': '#1e2229',
    '--p-glass': 'rgba(32, 36, 43, 0.72)',
    '--p-glass-line': 'rgba(255, 255, 255, 0.14)',
    '--p-glass-strong': 'rgba(38, 43, 51, 0.88)',
    '--p-text': '#eef1f5',
    '--p-sub': '#98a0ab',
    '--p-radius': t.radius,
    '--p-grad': `linear-gradient(135deg, ${t.gradientDeep}, ${primary})`,
    '--p-soft': rgba(primary, 0.22),
    '--p-border': 'rgba(255, 255, 255, 0.1)',
    '--p-shadow': '0 8rpx 24rpx rgba(0, 0, 0, 0.4)',
  }
}

export const themeOptions = Object.values(THEMES)
export const posterOptions = POSTERS

/** 背景海报渐变 */
export function posterBg(key: PosterKey): string {
  const p = POSTERS.find(x => x.key === key) || POSTERS[0]
  return `linear-gradient(180deg, ${p.from} 0%, ${p.to} 100%)`
}
