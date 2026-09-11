<script setup lang="ts">
const props = defineProps<{ options: string[]; modelValue: string[]; max?: number }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>()

function toggle(tag: string) {
  const next = [...props.modelValue]
  const i = next.indexOf(tag)
  if (i >= 0) next.splice(i, 1)
  else {
    if (props.max && next.length >= props.max) return
    next.push(tag)
  }
  emit('update:modelValue', next)
}
</script>

<template>
  <view class="tags">
    <view
      v-for="tag in options"
      :key="tag"
      class="tag"
      :class="{ on: modelValue.includes(tag) }"
      @click="toggle(tag)"
    >
      #{{ tag }}
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tags { display: flex; flex-wrap: wrap; gap: 16rpx; }
.tag {
  padding: 8rpx 22rpx;
  border-radius: 999rpx;
  background: #f2f3f5;
  color: $tomato-info;
  font-size: 24rpx;
  &.on {
    background: $tomato-primary;
    color: #fff;
  }
}
</style>
