import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const roomSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 30 },
  cover: { type: String },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  maxMembers: { type: Number, default: 50 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: () => new Date() },
})

export type RoomDoc = InferSchemaType<typeof roomSchema> & { _id: mongoose.Types.ObjectId }
export const Room = mongoose.model('Room', roomSchema)
