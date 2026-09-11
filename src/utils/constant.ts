/** 全局常量：优先级元信息 / 标签色板 / 激励语 / 清单默认图标 */

import type { Priority } from '@/types/task'

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  0: { label: '', color: '#c0c4cc' },
  1: { label: '低', color: '#909399' },
  2: { label: '中', color: '#f9a825' },
  3: { label: '高', color: '#e53935' },
}

export const PRIORITY_OPTIONS: Priority[] = [0, 1, 2, 3]

/** 标签展示色（按哈希取色也可，这里给常用标签定色） */
export const TAG_COLORS: Record<string, string> = {
  学习: '#1e88e5',
  工作: '#5e35b1',
  阅读: '#00897b',
  英语: '#f4511e',
  考研: '#c2185b',
  健身: '#43a047',
  生活: '#f9a825',
  写作: '#6d4c41',
}

/** 随机取标签颜色 */
export function tagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag]
  const palette = ['#1e88e5', '#5e35b1', '#00897b', '#f4511e', '#c2185b', '#43a047', '#6d4c41']
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

/** 专注中滚动展示的激励语（每次进入专注都换一条，不会连着重复） */
export const MOTIVATIONS = [
  '专注于当下，这一小段时间只属于你 🍅',
  '种下一颗番茄，收获一份专注',
  '不要想太多，先做完这一段',
  '坚持就是胜利，你正在变得更好',
  '把手机放远一点，把目标拉近一点',
  '此刻的克制，是给未来的自己最好的礼物',
  '慢慢来，比较快',
  '一次只做一件事，做到极致',
  '别让短视频偷走你的时间',
  '你能做到的，比想象中更多',
  '开始行动，焦虑就会退场',
  '把简单的事重复做，就是不简单',
  '今天多专注一点，明天就轻松一点',
  '专注是一种可以练习的能力',
  '让未来的你，感谢现在的自己',
  '把注意力当成最贵的资源',
  '别追求完美，先追求完成',
  '每一点进步都算数 🌱',
  '心静下来，效率自然上来',
  '少刷十分钟，多读两页书',
  '别人在玩的时候，你在变强',
  '完成比开始更需要勇气',
  '专注的人，时间会给他复利',
  '把大目标拆成今天这一小步',
  '不要等状态好，先坐下来开始',
  '安静地努力，悄悄地变好',
  '你专注的样子，很酷 😎',
  '此刻不打扰自己，就是最好的自律',
  '再坚持一下，就到了',
  '种树最好的时间是十年前，其次是现在',
  '番茄成熟需要时间，成长也一样',
  '把今天的事做好，明天自有答案',
]

export const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

/** 待办卡片渐变（仿番茄ToDo 水彩缤纷卡片） */
export const CARD_GRADIENTS: { from: string; to: string }[] = [
  { from: '#7fb5d9', to: '#a8d4ee' },
  { from: '#8fd0b1', to: '#bfe8d2' },
  { from: '#b2a0dd', to: '#d8cbf2' },
  { from: '#f0a9b8', to: '#f9cbd5' },
  { from: '#f0b47f', to: '#f9d3ab' },
  { from: '#8fbfd6', to: '#c2e2f0' },
  { from: '#e2ae96', to: '#f2d3c2' },
  { from: '#a8bfc0', to: '#cfe1e2' },
]
export function cardGradient(i: number): string {
  const p = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
  return `linear-gradient(135deg, ${p.from}, ${p.to})`
}
