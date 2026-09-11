/**
 * 自习室（设计方案 3/6）：房间 / 成员 presence / 弹幕。
 */

import { useRoomStore } from '@/store/modules/room'
import { useUserStore } from '@/store/modules/user'
import type { Room, RoomMember } from '@/types/room'
import type { Phase } from '@/types/pomodoro'

export function useRoom() {
  const store = useRoomStore()
  const userStore = useUserStore()

  function join(room: Room) {
    store.join(room._id)
  }
  function leave() {
    store.leave()
  }

  function send(content: string) {
    store.sendDanmaku(content)
  }

  /** 把番茄钟阶段映射为自习室 presence 状态并广播 */
  function syncPresenceFromPhase(phase: Phase, remainSec: number) {
    if (!store.currentRoomId) return
    const state: RoomMember['state'] =
      phase === 'focus' ? 'focus' : phase === 'shortBreak' || phase === 'longBreak' ? 'break' : 'idle'
    store.setMyState(state, Math.max(0, Math.round(remainSec / 1000)))
  }

  return {
    store,
    userStore,
    join,
    leave,
    send,
    syncPresenceFromPhase,
  }
}
