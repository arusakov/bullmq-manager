import { describe, it, before, after } from 'node:test'

import { createRedis } from '../utils'

describe('XXX', () => {
  const connection = createRedis()
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
