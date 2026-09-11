import mongoose from 'mongoose'
import { MONGODB_URI } from './env'

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', false)
  await mongoose.connect(MONGODB_URI)
  console.log('[db] connected:', MONGODB_URI)
}

export function json<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T
}
