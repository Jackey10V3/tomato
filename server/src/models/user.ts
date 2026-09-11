import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const userSchema = new Schema({
  account: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  nickname: { type: String, default: '番茄同学' },
  avatar: { type: String },
  settings: {
    focusMinutes: { type: Number, default: 25 },
    shortBreakMinutes: { type: Number, default: 5 },
    longBreakMinutes: { type: Number, default: 15 },
    roundsPerCycle: { type: Number, default: 4 },
    autoStartNext: { type: Boolean, default: true },
    whiteNoise: { type: String, default: 'off' },
  },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
})

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId }
export const User = mongoose.model('User', userSchema)
