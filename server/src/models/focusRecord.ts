import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const focusRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  taskTitle: { type: String, default: '' },
  kind: { type: String, enum: ['focus', 'break'], required: true },
  phaseRound: { type: Number, default: 0 },
  plannedSec: { type: Number, default: 0 },
  actualSec: { type: Number, required: true },
  completed: { type: Boolean, required: true },
  abandonedReason: { type: String, enum: ['manual_stop', 'give_up', 'app_killed'], default: null },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  createdAt: { type: Date, default: () => new Date() },
})

focusRecordSchema.index({ userId: 1, startedAt: -1 })

export type FocusRecordDoc = InferSchemaType<typeof focusRecordSchema> & {
  _id: mongoose.Types.ObjectId
}
export const FocusRecord = mongoose.model('FocusRecord', focusRecordSchema)
