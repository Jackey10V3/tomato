import 'dotenv/config'

export const PORT = Number(process.env.PORT || 3000)
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tomato'
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
export const TZ_OFFSET_MINUTES = Number(process.env.TZ_OFFSET_MINUTES || 480)

export function ok<T>(data: T) {
  return { code: 0, message: 'ok', data }
}
export function err(code: number, message: string) {
  return { code, message, data: null }
}
