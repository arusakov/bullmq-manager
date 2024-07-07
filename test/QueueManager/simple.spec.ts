import Redis from 'ioredis'
import { QueueManager } from '../../src'

describe('XXX', () => {
  const connection = new Redis({ lazyConnect: true })
  let queueManager: QueueManager<string, any, any>

  before(async () => {
    await connection.connect()
  })

  after(async () => {
    await connection.quit()
  })

  it('one queue', async () => {
    queueManager = new QueueManager({ 'q': true }, { connection }, { 'name': 'q' })
    queueManager.waitUntilReady
  })
})
