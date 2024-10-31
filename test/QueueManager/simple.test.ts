import { describe, it, before, after } from 'node:test'

import { QueueManager, type DefaultJob } from '../../src/QueueManager'

import { createRedis } from '../utils'


describe('XXX', () => {
  const connection = createRedis()
  let queueManager: QueueManager<string, string, DefaultJob<string>>

  before(async () => {
    await connection.connect()
    queueManager = new QueueManager(
      {
        default: true,
      },
      {
        connection,
      },
      {}
    )
    await queueManager.waitUntilReady()
  })

  after(async () => {
    await queueManager.close()
    await connection.quit()
  })

  it('test', () => {
  //   queueManager = new WorkerManager({
  //     'xxx': true,      
  //   },
  //   async () => {},
  //   {
  //     connection,
  //   },
  //   {
  //     setupWorker: (w) => {}
  //   })

  //   queueManager.run()
  })
})
