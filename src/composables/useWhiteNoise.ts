/** 白噪音混音（基于 WebAudio 程序合成引擎，无需素材文件） */
import { reactive } from 'vue'
import { NOISES, type NoiseDef, type NoiseKey } from '@/types/app'
import { noiseEngine } from '@/utils/audioEngine'

export function useWhiteNoise() {
  const state = reactive<{ active: NoiseKey[]; supported: boolean }>({
    active: [],
    supported: false,
  })

  try {
    state.supported = noiseEngine.isSupported()
  } catch {
    state.supported = false
  }

  function defOf(key: NoiseKey): NoiseDef | undefined {
    return NOISES.find(n => n.key === key)
  }

  /** 点击一个音源：开启/关闭；非混音音源开启时会先关闭其他全部 */
  function toggle(key: NoiseKey) {
    const def = defOf(key)
    if (!def) return
    const on = noiseEngine.toggle(key, def.mixable)
    if (on) {
      state.active = state.active.filter(k => k !== key)
      state.active.push(key)
    } else {
      state.active = state.active.filter(k => k !== key)
    }
    if (!def.mixable && on) {
      // 独占开启后，active 仅保留该项
      state.active = [key]
    }
  }

  function stopAll() {
    noiseEngine.stopAll()
    state.active = []
  }

  function isOn(key: NoiseKey): boolean {
    return state.active.includes(key)
  }

  return { state, options: NOISES, toggle, stopAll, isOn }
}
