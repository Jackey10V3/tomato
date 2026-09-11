/** 任务视图便捷封装：按清单读取 + 今日汇总 + 标签 */
import { computed } from 'vue'
import { useTaskStore } from '@/store/modules/task'
import type { ListKey } from '@/types/task'

export function useTask() {
  const store = useTaskStore()

  /** 各清单（不含已完成） */
  const lists = computed(() => store.lists)
  /** 每个清单的活跃数量 */
  const activeCount = computed<Record<string, number>>(() => {
    const c: Record<string, number> = {}
    store.tasks.forEach(t => {
      if (t.deleted || t.completed) return
      c[t.listId] = (c[t.listId] || 0) + 1
    })
    return c
  })

  const listTasks = (key: ListKey) => store.listTasks(key)
  const tags = computed(() => store.tags)

  return { store, lists, activeCount, listTasks, tags }
}
