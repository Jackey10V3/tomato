/**
 * 白噪音 / 背景音播放适配。
 * 安卓：innerAudioContext 退后台会被系统暂停 → 需原生前台服务承载 + AudioFocus（TODO M4）；
 * 鸿蒙：白噪音在播即「有音场景」，可申请 AUDIO_PLAYBACK 长时任务后台续播（TODO M6）。
 * 未接入原生播放器前，前台使用 innerAudioContext 兜底（App/H5 均可用）。
 */

export type NoiseType = 'rain' | 'forest' | 'library' | 'off'

export const NOISE_OPTIONS: { type: NoiseType; label: string; emoji: string }[] = [
  { type: 'rain', label: '雨声', emoji: '🌧️' },
  { type: 'forest', label: '森林', emoji: '🌲' },
  { type: 'library', label: '图书馆', emoji: '📚' },
  { type: 'off', label: '关闭', emoji: '🔇' },
]

/** 音频源：需自行补充 src/static/audio/ 下的资源文件 */
const SRC_MAP: Record<Exclude<NoiseType, 'off'>, string> = {
  rain: '/static/audio/rain.mp3',
  forest: '/static/audio/forest.mp3',
  library: '/static/audio/library.mp3',
}

let ctx: UniApp.InnerAudioContext | null = null

function ensureCtx(): UniApp.InnerAudioContext | null {
  if (ctx) return ctx
  try {
    ctx = uni.createInnerAudioContext()
    ctx.loop = true
    return ctx
  } catch {
    return null
  }
}

export const audio = {
  /** 请求音频焦点 / 进入后台播放会话（原生层负责，此处为占位） */
  requestFocus() {
    // #ifdef APP-PLUS
    // TODO(M4)：原生前台服务内 requestAudioFocus(AUDIOFOCUS_GAIN)
    // #endif
    // #ifdef APP-HARMONY
    // TODO(M6)：配合 AUDIO_PLAYBACK 长时任务
    // #endif
  },
  abandonFocus() {
    // #ifdef APP-PLUS
    // TODO(M4)：abandonAudioFocus
    // #endif
  },
  play(type: NoiseType) {
    if (type === 'off') {
      this.stop()
      return
    }
    const a = ensureCtx()
    if (!a) return
    a.src = SRC_MAP[type]
    a.play()
  },
  stop() {
    ctx?.stop()
  },
}
