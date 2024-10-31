import { describe, it, before, after } from 'node:test'

import Redis from 'ioredis'

import { WorkerManager } from '../../src'

describe('XXX', () => {
  const connection = new Redis({
    lazyConnect: true,
    maxRetriesPerRequest: null
  })
  // let queueManager: WorkerManager<string, any, any>

  before(async () => {
    await connection.connect()
  })

  after(async () => {
    // await queueManager.close()
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
