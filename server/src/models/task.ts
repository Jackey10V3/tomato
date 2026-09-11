import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const taskSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, required: true },
  title: { type: String, required: true },
  notes: { type: String, default: '' },
  tags: { type: [String], default: [] },
  priority: { type: Number, default: 0, min: 0, max: 3 },
  sortOrder: { type: Number, default: 0 },
  planDate: { type: String },
  estimatePomodoros: { type: Number, default: 0 },
  donePomodoros: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
})

// 一个用户下 clientId 唯一 → 离线创建幂等（LWW 靠 updatedAt 比较）
taskSchema.index({ userId: 1, clientId: 1 }, { unique: true })
taskSchema.index({ userId: 1, updatedAt: 1 })

export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: mongoose.Types.ObjectId }
export const Task = mongoose.model('Task', taskSchema)
