/** 应用设置（本地持久化）与主题定义 */

import type { TimerMode, SessionKind } from './focus'

/** 主题键 */
export type ThemeKey = 'tomato' | 'sunset' | 'ocean' | 'forest' | 'grape' | 'ink'

export interface ThemeDef {
  key: ThemeKey
  name: string
  /** 主色 */
  primary: string
  /** 沉浸背景渐变（深） */
  gradientDeep: string
  /** 沉浸背景渐变（浅） */
  gradientLight: string
  /** 页面浅色背景 */
  bg: string
  /** 卡片背景 */
  card: string
  /** 主文字 */
  text: string
  /** 次要文字 */
  subText: string
  radius: string
}

export const THEMES: Record<ThemeKey, ThemeDef> = {
  tomato: {
    key: 'tomato', name: '番茄红',
    primary: '#e53935', gradientDeep: '#c62828', gradientLight: '#ef5350',
    bg: '#faf6f3', card: '#ffffff', text: '#2b2220', subText: '#9e958f', radius: '24rpx',
  },
  sunset: {
    key: 'sunset', name: '落日橙',
    primary: '#f4511e', gradientDeep: '#bf360c', gradientLight: '#ff7043',
    bg: '#fbf5f0', card: '#ffffff', text: '#33241c', subText: '#b09a8d', radius: '24rpx',
  },
  ocean: {
    key: 'ocean', name: '深海蓝',
    primary: '#1e88e5', gradientDeep: '#0d47a1', gradientLight: '#42a5f5',
    bg: '#f2f7fc', card: '#ffffff', text: '#1c2833', subText: '#8fa3b0', radius: '24rpx',
  },
  forest: {
    key: 'forest', name: '森林绿',
    primary: '#43a047', gradientDeep: '#1b5e20', gradientLight: '#66bb6a',
    bg: '#f2f8f2', card: '#ffffff', text: '#1e2a1f', subText: '#8fa88f', radius: '24rpx',
  },
  grape: {
    key: 'grape', name: '葡萄紫',
    primary: '#8e24aa', gradientDeep: '#4a148c', gradientLight: '#ab47bc',
    bg: '#f8f3fb', card: '#ffffff', text: '#2a1f33', subText: '#a28fb0', radius: '24rpx',
  },
  ink: {
    key: 'ink', name: '暗夜墨',
    primary: '#5c6bc0', gradientDeep: '#1a237e', gradientLight: '#7986cb',
    bg: '#f3f4f9', card: '#ffffff', text: '#23263b', subText: '#9599b3', radius: '24rpx',
  },
}

/** 白噪音音源 */
export type NoiseKey = 'rain' | 'rainThunder' | 'forest' | 'cafe' | 'library' | 'piano' | 'meditation' | 'off'

export interface NoiseDef {
  key: NoiseKey
  label: string
  emoji: string
  /** 是否可与其他音源混音叠加（雨声/钢琴…） */
  mixable: boolean
  /** 0-1 基础音量 */
  gain: number
}

export const NOISES: NoiseDef[] = [
  { key: 'rain', label: '雨声', emoji: '🌧️', mixable: true, gain: 0.5 },
  { key: 'rainThunder', label: '雷雨', emoji: '⛈️', mixable: false, gain: 0.45 },
  { key: 'forest', label: '森林', emoji: '🌲', mixable: true, gain: 0.5 },
  { key: 'cafe', label: '咖啡馆', emoji: '☕', mixable: true, gain: 0.35 },
  { key: 'library', label: '图书馆', emoji: '📚', mixable: true, gain: 0.4 },
  { key: 'piano', label: '钢琴', emoji: '🎹', mixable: true, gain: 0.3 },
  { key: 'meditation', label: '冥想', emoji: '🧘', mixable: true, gain: 0.4 },
]

/** 提示音风格（WebAudio 合成，无需素材文件） */
export type SoundKey = 'none' | 'tick' | 'chime' | 'piano' | 'soft'

export interface SoundDef {
  key: SoundKey
  label: string
}

export const SOUNDS: SoundDef[] = [
  { key: 'none', label: '静音（振动提醒）' },
  { key: 'tick', label: '机械滴答' },
  { key: 'chime', label: '清脆风铃' },
  { key: 'piano', label: '钢琴音' },
  { key: 'soft', label: '柔和双音' },
]

export interface SoundPrefs {
  start: SoundKey
  end: SoundKey
  giveup: SoundKey
  warn: SoundKey
}

/** 学霸模式白名单（内置建议 + 用户自定义） */
export interface WhitelistItem {
  name: string
  pkg: string
}

export const PRESET_WHITELIST: WhitelistItem[] = [
  { name: '浏览器', pkg: 'com.android.browser' },
  { name: '音乐', pkg: 'com.netease.cloudmusic' },
  { name: '词典', pkg: 'com.youdao.dict' },
]

export const PRESET_BLOCKED: WhitelistItem[] = [
  { name: '微信', pkg: 'com.tencent.mm' },
  { name: '抖音', pkg: 'com.ss.android.ugc.aweme' },
  { name: '快手', pkg: 'com.smile.gifmaker' },
  { name: '哔哩哔哩', pkg: 'tv.danmaku.bili' },
  { name: '微博', pkg: 'com.sina.weibo' },
]

/** 背景海报（待办与专注页背景） */
export type PosterKey = 'classic' | 'sunset' | 'ocean' | 'forest' | 'night'

export interface PosterDef {
  key: PosterKey
  label: string
  from: string
  to: string
}

export const POSTERS: PosterDef[] = [
  { key: 'classic', label: '樱粉', from: '#f7c1cf', to: '#fdeef2' },
  { key: 'sunset', label: '暖阳', from: '#f7c39a', to: '#fdeee0' },
  { key: 'ocean', label: '海风', from: '#a8cdf0', to: '#eaf4fd' },
  { key: 'forest', label: '森野', from: '#b6ddc4', to: '#eef8f1' },
  { key: 'night', label: '夜蓝', from: '#3b4a6b', to: '#c9d6ea' },
]

export interface AppSettings {
  theme: ThemeKey
  /** 个性化：头像 emoji 与昵称 */
  avatar: string
  nickname: string
  /** 考研倒计时：名称 / 目标日期 / 目标时间 */
  examName: string
  examDate: string
  examTime: string
  /** 深色模式 */
  dark: boolean
  /** 待办与专注页背景海报 */
  poster: PosterKey
  /** 提示音 / 白噪音音量 0-1 */
  volume: number
  defaultMode: TimerMode
  /** 专注计时核心设置 */
  timer: {
    focusMin: number
    shortMin: number
    longMin: number
    roundsPerCycle: number
    autoStartNext: boolean
  }
  /** 强力专注模式 */
  focusGuard: {
    /** 学霸模式（离席检测→警告→作废） */
    studyHard: boolean
    /** 严格模式（计时中禁止手动停止/放弃） */
    strict: boolean
    /** 累计警告次数达到后判定放弃 */
    warnLimit: number
    /** 单次离席超过该秒数直接判定放弃 */
    leaveGraceSec: number
    /** 专注白名单（学霸模式下仍可使用） */
    whitelist: WhitelistItem[]
  }
  sounds: SoundPrefs
  /** 午夜模式：凌晨开始的新计时归属前一天 */
  midnightAttach: boolean
  /** 振动反馈开关 */
  vibrate: boolean
  /** 定时器tick震动？预留 */
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'tomato',
  avatar: '🍅',
  nickname: '番茄同学',
  examName: '考研',
  examDate: '2026-12-26',
  examTime: '08:30',
  dark: false,
  poster: 'classic',
  volume: 0.85,
  defaultMode: 'countdown',
  timer: { focusMin: 25, shortMin: 5, longMin: 15, roundsPerCycle: 4, autoStartNext: true },
  focusGuard: {
    studyHard: false,
    strict: false,
    warnLimit: 3,
    leaveGraceSec: 60,
    whitelist: [],
  },
  sounds: { start: 'soft', end: 'chime', giveup: 'tick', warn: 'tick' },
  midnightAttach: false,
  vibrate: true,
}
