import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const roomMessageSchema = new Schema({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nickname: { type: String, default: '' },
  kind: { type: String, enum: ['danmaku', 'emoji', 'system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date(), expires: 3600 }, // TTL 自动清理
})

roomMessageSchema.index({ roomId: 1, createdAt: 1 })

export type RoomMessageDoc = InferSchemaType<typeof roomMessageSchema> & {
  _id: mongoose.Types.ObjectId
}
export const RoomMessage = mongoose.model('RoomMessage', roomMessageSchema)
