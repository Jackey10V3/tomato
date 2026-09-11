/**
 * WebAudio 音频引擎：全部程序合成，无需任何音频素材文件即可发声。
 * - 提示音：开始 / 完成 / 放弃 / 警告（按用户设置的声音风格）
 * - 白噪音：雨声 / 雷雨 / 森林 / 咖啡馆 / 图书馆 / 冥想垫 / 钢琴氛围，支持多轨混音叠加
 * 兼容：H5 与 App(webview) 有 AudioContext；不支持的运行环境自动降级为静音 + 振动提示。
 */

export type { NoiseKey, SoundKey } from '@/types/app'
import type { SoundKey } from '@/types/app'

// ---------------------------------------------------------------- ctx
type AC = {
  currentTime: number
  destination: AudioNode
  createBufferSource(): AudioBufferSourceNode
  createBuffer(num: number, len: number, sr: number): AudioBuffer
  createGain(): GainNode
  createFilter(): BiquadFilterNode
  createOscillator(): OscillatorNode
  createStereoPanner?(): AudioNode
  resume(): Promise<void>
  state: string
}
declare global {
  interface Window {
    webkitAudioContext?: new () => AC
  }
}
let ctx: AC | null = null
let noiseMaster: GainNode | null = null
/** 全局音量（设置页可调） */
let VOLUME = 0.85

export function setAudioVolume(v: number) {
  VOLUME = Math.min(1, Math.max(0, v))
  if (noiseMaster) noiseMaster.gain.value = VOLUME
}
export function getAudioVolume() {
  return VOLUME
}

function ensureCtx(): AC | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = (window as unknown as { AudioContext?: new () => AC; webkitAudioContext?: new () => AC })
    const cls = Ctor.AudioContext || Ctor.webkitAudioContext
    if (!cls) return null
    try {
      ctx = new cls()
      noiseMaster = ctx.createGain()
      noiseMaster.gain.value = VOLUME
      noiseMaster.connect(ctx.destination)
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// ---------------------------------------------------------------- effects
function tone(c: AC, freq: number, start: number, dur: number, type: OscillatorType, gainPeak: number) {
  const osc = c.createOscillator()
  const g = c.createGain()
  const peak = gainPeak * VOLUME
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(peak, start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

/**
 * 风格化提示音。
 *
 * 播放策略（这是"手机上没声音"的关键）：
 *  1. 有 WebAudio 的环境（H5、安卓 App 的 webview）→ 程序合成，零延迟、无需素材；
 *  2. 没有 WebAudio 的环境（鸿蒙原生运行时等）→ 用 innerAudioContext 播放
 *     /static/audio 下预先生成的同款提示音素材兜底。
 *     原实现只判断"没有 WebAudio 就静音"，于是在鸿蒙上完全没声音。
 */
const EFFECT_SRC: Record<Exclude<SoundKey, 'none'>, string> = {
  tick: '/static/audio/eff-tick.wav',
  chime: '/static/audio/eff-chime.wav',
  piano: '/static/audio/eff-piano.wav',
  soft: '/static/audio/eff-soft.wav',
}

/** 每个音效复用一个 innerAudioContext，避免每次播放都新建实例 */
const innerPool = new Map<string, UniApp.InnerAudioContext>()

function playViaInner(kind: Exclude<SoundKey, 'none'>): boolean {
  try {
    if (typeof uni?.createInnerAudioContext !== 'function') return false
    const src = EFFECT_SRC[kind]
    let a = innerPool.get(src)
    if (!a) {
      a = uni.createInnerAudioContext()
      a.src = src
      a.volume = 1
      innerPool.set(src, a)
    }
    a.stop()
    a.play()
    return true
  } catch {
    return false
  }
}

/** 有 WebAudio 时用合成音（音色更细腻，且能区分 start/end/warn 的节奏） */
function playSynth(kind: 'tick' | 'chime' | 'piano' | 'soft', c: AC, pattern: 'start' | 'end' | 'warn') {
  const t = c.currentTime + 0.02
  const gap = kind === 'piano' ? 0.12 : 0.09
  const n = pattern === 'start' ? 1 : pattern === 'warn' ? 3 : 2
  for (let i = 0; i < n; i++) {
    const at = t + i * gap
    if (kind === 'tick') {
      tone(c, 1500 - i * 120, at, 0.06, 'square', 0.18)
    } else if (kind === 'chime') {
      tone(c, 1567.98, at, 0.9, 'sine', 0.34)
      tone(c, 2093, at, 0.5, 'sine', 0.14)
    } else if (kind === 'piano') {
      const base = 523.25
      ;[0, 4, 7].forEach(half => tone(c, base * Math.pow(2, half / 12), at, 1.2, 'triangle', 0.3))
    } else if (kind === 'soft') {
      tone(c, 660, at, 0.5, 'sine', 0.3)
      tone(c, 880, at + 0.03, 0.5, 'sine', 0.2)
    }
  }
}

export function playEffect(kind: 'tick' | 'chime' | 'piano' | 'soft' | 'none', pattern: 'start' | 'end' | 'warn' = 'start') {
  if (kind === 'none') return
  const c = ensureCtx()
  if (c) {
    playSynth(kind, c, pattern)
    return
  }
  // 原生兜底：素材本身已含节奏，警告再补一次更醒目
  const ok = playViaInner(kind)
  if (ok && pattern === 'warn') setTimeout(() => playViaInner(kind), 320)
}

/** 首次交互解锁音频（浏览器要求用户手势后才能出声） */
export function unlockAudio() {
  ensureCtx()
}
if (typeof document !== 'undefined') {
  const once = () => {
    ensureCtx()
    document.removeEventListener('pointerdown', once)
    document.removeEventListener('touchstart', once)
    document.removeEventListener('keydown', once)
  }
  document.addEventListener('pointerdown', once, { once: true })
  document.addEventListener('touchstart', once, { once: true })
  document.addEventListener('keydown', once, { once: true })
}

/** 一键测试所有提示音（外观页使用） */
export function testAllSounds() {
  const seq: ('chime' | 'piano' | 'soft' | 'tick')[] = ['chime', 'piano', 'soft', 'tick']
  seq.forEach((k, i) => setTimeout(() => playEffect(k, i === 3 ? 'warn' : 'start'), i * 900))
}

// ---------------------------------------------------------------- white noise tracks
type StopFn = () => void
const running = new Map<string, StopFn>()

/** 生成持续 n 秒的白/粉噪声 buffer（循环播放用 n=2） */
function noiseBuffer(c: AC, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const sr = 44100
  const len = sr * 2
  const buf = c.createBuffer(1, len, sr)
  const data = buf.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (type === 'white') {
      data[i] = w
    } else if (type === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      const b2 = 0.57 * last + w * 0.0525809
      last = b2
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 3.5
    } else {
      b0 = 0.98 * b0 + w * 0.02
      data[i] = b0 * 8
    }
  }
  return buf
}

function loopNoise(c: AC, color: 'white' | 'pink' | 'brown', out: AudioNode): AudioBufferSourceNode {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, color)
  src.loop = true
  src.connect(out)
  return src
}

function nodeFrom(c: AC, key: string): { start: () => void; stop: () => void } {
  const mk = () => c.createGain()
  const out = mk()

  // ---- 不同音源的节点图（简化但自然的合成） ----
  const starters: (() => AudioScheduledSourceNode | null)[] = []
  const filters: BiquadFilterNode[] = []
  const gains: GainNode[] = []

  const push = (color: 'white' | 'pink' | 'brown', filterType: BiquadFilterType, freq: number, gainV: number) => {
    const f = c.createFilter()
    f.type = filterType
    f.frequency.value = freq
    const g = mk()
    g.gain.value = gainV
    const src = loopNoise(c, color, f)
    f.connect(g)
    g.connect(out)
    filters.push(f)
    gains.push(g)
    return src
  }

  // LFO 让"雨/风"有呼吸感
  const breathe = (target: GainNode, rate: number, depth: number) => {
    const lfo = c.createOscillator()
    lfo.frequency.value = rate
    const lg = c.createGain()
    lg.gain.value = depth
    lfo.connect(lg)
    lg.connect(target.gain)
    return lfo
  }

  let bg: AudioScheduledSourceNode | null = null
  const timers: ReturnType<typeof setTimeout>[] = []

  if (key === 'rain') {
    bg = push('white', 'lowpass', 2800, 0.16)
    breathe(gains[0], 0.4, 0.02)
  } else if (key === 'rainThunder') {
    bg = push('white', 'lowpass', 1800, 0.12)
    const rumble = () => {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(70, c.currentTime)
      o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 1.6)
      const g = mk()
      g.gain.setValueAtTime(0.0001, c.currentTime)
      g.gain.linearRampToValueAtTime(0.5, c.currentTime + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.2)
      o.connect(g)
      g.connect(out)
      o.start()
      o.stop(c.currentTime + 2.3)
    }
    const loop = () => {
      timers.push(setTimeout(loop, 5000 + Math.random() * 6000))
      rumble()
    }
    timers.push(setTimeout(loop, 3000))
  } else if (key === 'forest') {
    bg = push('pink', 'bandpass', 1100, 0.18)
    const chirp = () => {
      const o = c.createOscillator()
      o.type = 'sine'
      const f0 = 2400 + Math.random() * 1800
      o.frequency.setValueAtTime(f0, c.currentTime)
      o.frequency.exponentialRampToValueAtTime(f0 * 1.35, c.currentTime + 0.08)
      const g = mk()
      g.gain.setValueAtTime(0.0001, c.currentTime)
      g.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.16)
      o.connect(g)
      g.connect(out)
      o.start()
      o.stop(c.currentTime + 0.2)
    }
    const loop = () => {
      timers.push(setTimeout(loop, 2500 + Math.random() * 5000))
      if (Math.random() > 0.4) chirp()
    }
    timers.push(setTimeout(loop, 1500))
  } else if (key === 'cafe') {
    bg = push('brown', 'lowpass', 950, 0.35)
    breathe(gains[0], 0.12, 0.06)
  } else if (key === 'library') {
    bg = push('pink', 'lowpass', 1500, 0.12)
    const page = () => {
      const g = mk()
      g.gain.setValueAtTime(0.0001, c.currentTime)
      g.gain.linearRampToValueAtTime(0.03, c.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08)
      const src = c.createBufferSource()
      src.buffer = noiseBuffer(c, 'white')
      src.connect(g)
      g.connect(out)
      src.start()
      src.stop(c.currentTime + 0.12)
    }
    const loop = () => {
      timers.push(setTimeout(loop, 6000 + Math.random() * 9000))
      page()
    }
    timers.push(setTimeout(loop, 5000))
  } else if (key === 'meditation') {
    bg = push('brown', 'lowpass', 500, 0.3)
    breathe(gains[0], 0.08, 0.08)
  } else if (key === 'piano') {
    // 慢速氛围和弦（A 大调琶音循环），替代真实钢琴采样的占位方案
    const chord = [220, 277.18, 329.63, 440]
    const playChord = () => {
      chord.forEach((f, i) => {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const g = mk()
        const at = c.currentTime + i * 0.12
        g.gain.setValueAtTime(0.0001, at)
        g.gain.linearRampToValueAtTime(0.05, at + 0.35)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 2.6)
        o.connect(g)
        g.connect(out)
        o.start(at)
        o.stop(at + 2.8)
      })
    }
    playChord()
    const loop = () => {
      timers.push(setTimeout(loop, 7000))
      playChord()
    }
    timers.push(setTimeout(loop, 7000))
    bg = null
  }

  return {
    start: () => {
      if (bg) bg.start()
      starters.forEach(s => s())
    },
    stop: () => {
      timers.forEach(t => clearTimeout(t))
      filters.forEach(f => f.disconnect())
      gains.forEach(g => g.disconnect())
      if (bg) {
        try {
          bg.stop()
        } catch {
          /* already stopped */
        }
      }
      out.disconnect()
    },
  }
}

/** 白噪音多轨控制：mixable 音源可叠加，独占音源（雷雨）会清空其他 */
export const noiseEngine = {
  isSupported(): boolean {
    return ensureCtx() !== null
  },
  activeKeys(): string[] {
    return [...running.keys()]
  },
  toggle(key: string, mixable: boolean, gainOverride?: number): boolean {
    const c = ensureCtx()
    if (!c) return false
    if (running.has(key)) {
      running.get(key)!()
      running.delete(key)
      return false
    }
    if (!mixable) {
      // 独占：先停掉全部
      running.forEach(stop => stop())
      running.clear()
    }
    const node = nodeFrom(c, key)
    if (gainOverride !== undefined && noiseMaster) noiseMaster.gain.value = gainOverride
    node.start()
    running.set(key, () => node.stop())
    return true
  },
  stopAll() {
    running.forEach(stop => stop())
    running.clear()
  },
  volume(v: number) {
    if (noiseMaster) noiseMaster.gain.value = Math.min(1, Math.max(0, v))
  },
}
