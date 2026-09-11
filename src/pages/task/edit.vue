<script setup lang="ts">
/**
 * 任务新建 / 详情编辑（清单归属、截止日、优先级、标签、预计番茄、子任务、重复）
 */
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useTaskStore } from '@/store/modules/task'
import { useChrome } from '@/composables/usePageChrome'
import { useSettingsStore } from '@/store/modules/settings'
import { themeStyle } from '@/utils/theme'
import { PRIORITY_META, PRIORITY_OPTIONS } from '@/utils/constant'
import type { ListKey, Priority, RepeatType } from '@/types/task'

const store = useTaskStore()
const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const style = computed(() => themeStyle(settings.s.theme))

const isNew = ref(true)
const id = ref('')
const listId = ref<ListKey>('today')
const form = reactive({
  title: '',
  notes: '',
  dueDate: '',
  priority: 2 as Priority,
  tags: [] as string[],
  estimate: 1,
  repeat: 'none' as RepeatType,
})
const tagInput = ref('')
const subInput = ref('')
const subtasks = ref<{ id: string; title: string; done: boolean }[]>([])

const targetList = computed(() => store.lists.find(l => l.id === listId.value))

onLoad(query => {
  const createList = (query?.list as ListKey | undefined) || 'today'
  if (query?.id) {
    const t = store.byId(query.id)
    if (!t) {
      uni.showToast({ title: '任务不存在', icon: 'none' })
      setTimeout(goBack, 600)
      return
    }
    isNew.value = false
    id.value = t._id
    listId.value = t.listId
    form.title = t.title
    form.notes = t.notes
    form.dueDate = t.dueDate || ''
    form.priority = t.priority
    form.tags = [...t.tags]
    form.estimate = t.estimate || 1
    form.repeat = t.repeat
    subtasks.value = t.subtasks.map(s => ({ ...s }))
  } else {
    // 从清单列表新建；已完成归档不可直接写入
    listId.value = createList === 'done' ? 'today' : createList
  }
})

function pickList(l: { id: string; builtin: boolean }) {
  if (!isNew.value && l.builtin && l.id === 'done') return
  listId.value = l.id as ListKey
}
function pickPriority(p: Priority) {
  form.priority = p
}
function addTag() {
  const t = tagInput.value.trim().replace(/^#/, '')
  if (!t) return
  if (!form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ''
}
function removeTag(i: number) {
  form.tags.splice(i, 1)
}
function addSub() {
  const t = subInput.value.trim()
  if (!t) return
  subtasks.value.push({ id: 's' + Date.now() + Math.random().toString(36).slice(2, 6), title: t, done: false })
  subInput.value = ''
}
function onDueChange(e: { detail: { value: string } }) {
  form.dueDate = e.detail.value
}

function save() {
  const title = form.title.trim()
  if (!title) {
    uni.showToast({ title: '请填写任务名称', icon: 'none' })
    return
  }
  const payload = {
    title,
    notes: form.notes,
    listId: listId.value,
    dueDate: form.dueDate || undefined,
    priority: form.priority,
    tags: form.tags,
    estimate: form.estimate,
    repeat: form.repeat,
    subtasks: subtasks.value,
  }
  if (isNew.value) store.addToList(listId.value, payload)
  else store.update(id.value, payload)
  uni.showToast({ title: isNew.value ? '已创建' : '已保存', icon: 'success' })
  setTimeout(goBack, 400)
}
function removeTask() {
  uni.showModal({
    title: '删除任务',
    content: '删除后不可恢复',
    confirmColor: '#e53935',
    success: r => {
      if (r.confirm) {
        store.remove(id.value)
        uni.showToast({ title: '已删除', icon: 'none' })
        setTimeout(goBack, 400)
      }
    },
  })
}
function toggleSub(s: { id: string; done: boolean }) {
  s.done = !s.done
}
function removeSub(idx: number) {
  subtasks.value.splice(idx, 1)
}
</script>

<template>
  <view class="screen" :style="[style, { paddingTop: statusBarH + 'px' }]">
    <view class="t-header">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">{{ isNew ? '新建任务' : '任务详情' }}</text>
      <view class="t-right">
        <text class="save" @click="save">保存</text>
      </view>
    </view>

    <scroll-view scroll-y class="body">
      <view class="card title-card">
        <input v-model="form.title" class="title-input" placeholder="要做什么？" :placeholder-style="'color:#c9c2bc'" />
        <textarea v-model="form.notes" class="notes" placeholder="备注（可选）" :maxlength="500" />
      </view>

      <view class="card">
        <text class="sec-label">放入清单</text>
        <scroll-view scroll-x class="chips" :show-scrollbar="false">
          <view
            v-for="l in store.lists.filter(x => x.id !== 'done')"
            :key="l.id"
            class="chip-item"
            :class="{ on: listId === l.id }"
            @click="pickList(l)"
          >
            <text>{{ l.icon }} {{ l.name }}</text>
          </view>
        </scroll-view>

        <view class="divider" />

        <text class="sec-label">优先级</text>
        <view class="prios">
          <view
            v-for="p in PRIORITY_OPTIONS"
            :key="p"
            class="prio"
            :class="{ on: form.priority === p }"
            @click="pickPriority(p)"
          >
            <text v-if="p">{{ PRIORITY_META[p].label }}</text>
            <text v-else>无</text>
          </view>
        </view>

        <view class="divider" />

        <text class="sec-label">截止 / 计划日</text>
        <picker mode="date" :value="form.dueDate" @change="onDueChange">
          <view class="due-row">
            <text :class="{ placeholder: !form.dueDate }">{{ form.dueDate || '选择日期' }}</text>
            <text class="chev">›</text>
          </view>
        </picker>

        <view class="divider" />

        <text class="sec-label">标签</text>
        <view class="tag-box">
          <view v-for="(tag, i) in form.tags" :key="tag" class="tag">
            <text>#{{ tag }}</text>
            <text class="tag-x" @click="removeTag(i)">×</text>
          </view>
          <input v-model="tagInput" class="tag-input" placeholder="输入后回车添加" confirm-type="done" @confirm="addTag" />
        </view>

        <view class="divider" />

        <text class="sec-label">重复</text>
        <view class="prios">
          <view class="prio" :class="{ on: form.repeat === 'none' }" @click="form.repeat = 'none'">不重复</view>
          <view class="prio" :class="{ on: form.repeat === 'daily' }" @click="form.repeat = 'daily'">每天</view>
          <view class="prio" :class="{ on: form.repeat === 'weekly' }" @click="form.repeat = 'weekly'">每周</view>
        </view>

        <view class="divider" />

        <view class="row-between">
          <text class="sec-label no-margin">预计番茄数</text>
          <view class="stepper">
            <view class="step" @click="form.estimate = Math.max(1, form.estimate - 1)">−</view>
            <text class="num">{{ form.estimate }} 🍅</text>
            <view class="step" @click="form.estimate++">＋</view>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="sec-label">子任务（拆分步骤）</text>
        <view v-for="(s, i) in subtasks" :key="s.id" class="sub-row">
          <view class="sub-check" :class="{ done: s.done }" @click="toggleSub(s)">{{ s.done ? '✓' : '' }}</view>
          <text class="sub-title" :class="{ done: s.done }">{{ s.title }}</text>
          <text class="sub-x" @click="removeSub(i)">✕</text>
        </view>
        <view class="sub-add">
          <input v-model="subInput" placeholder="添加子任务…" confirm-type="done" @confirm="addSub" />
          <text class="sub-btn" @click="addSub">添加</text>
        </view>
      </view>

      <view v-if="!isNew" class="danger-zone" @click="removeTask">删除此任务</view>
      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.save { color: var(--p-primary, #e53935); font-size: 30rpx; font-weight: 600; }
.body { height: calc(100vh - 110rpx); }
.title-card { padding-top: 20rpx; }
.title-input {
  font-size: 36rpx;
  font-weight: 700;
  padding: 8rpx 0;
}
.notes {
  width: 100%;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--p-sub, #777);
  min-height: 120rpx;
}
.sec-label {
  display: block;
  font-size: 24rpx;
  color: var(--p-sub, #999);
  margin-bottom: 16rpx;
  &.no-margin { margin-bottom: 0; }
}
.divider { height: 2rpx; background: #f5f1ed; margin: 26rpx 0; }
.chips { white-space: nowrap; }
.chip-item {
  display: inline-flex;
  padding: 10rpx 24rpx;
  margin-right: 14rpx;
  border-radius: 999rpx;
  background: #f6f3f0;
  font-size: 24rpx;
  &.on { background: var(--p-primary, #e53935); color: #fff; }
}
.prios { display: flex; gap: 16rpx; }
.prio {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 16rpx;
  background: #f6f3f0;
  font-size: 26rpx;
  color: var(--p-text, #333);
  &.on { background: var(--p-primary, #e53935); color: #fff; }
}
.due-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f6f3f0;
  border-radius: 16rpx;
  padding: 18rpx 22rpx;
  .placeholder { color: #c9c2bc; }
  .chev { color: #c9c2bc; font-size: 32rpx; }
}
.tag-box { display: flex; flex-wrap: wrap; gap: 12rpx; align-items: center; }
.tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background: #fdecea;
  color: var(--p-primary, #e53935);
  border-radius: 12rpx;
  padding: 6rpx 14rpx;
  font-size: 22rpx;
  .tag-x { font-size: 26rpx; }
}
.tag-input { flex: 1; min-width: 220rpx; font-size: 24rpx; padding: 8rpx 0; }
.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stepper { display: flex; align-items: center; gap: 22rpx; }
.step {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #f6f3f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
}
.num { font-size: 28rpx; font-weight: 700; min-width: 120rpx; text-align: center; }
.sub-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
  .sub-check {
    width: 38rpx;
    height: 38rpx;
    border-radius: 50%;
    border: 3rpx solid #d8d2cc;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20rpx;
    &.done { background: var(--p-primary, #e53935); border-color: var(--p-primary, #e53935); }
  }
  .sub-title { flex: 1; font-size: 28rpx; &.done { text-decoration: line-through; color: #c9c2bc; } }
  .sub-x { color: #c9c2bc; }
}
.sub-add {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
  input { flex: 1; font-size: 26rpx; color: var(--p-sub, #999); }
  .sub-btn { color: var(--p-primary, #e53935); font-size: 26rpx; }
}
.danger-zone {
  margin: 20rpx 24rpx;
  text-align: center;
  color: #e53935;
  background: #fff;
  border-radius: var(--p-radius, 24rpx);
  padding: 26rpx;
  font-size: 28rpx;
}
.bottom-space { height: 120rpx; }
</style>
