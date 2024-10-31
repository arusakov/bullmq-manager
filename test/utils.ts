import { Redis } from 'ioredis'

export const createRedis = () => {
  return new Redis({
    lazyConnect: true,
    maxRetriesPerRequest: null,
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT) || undefined,
  })
}