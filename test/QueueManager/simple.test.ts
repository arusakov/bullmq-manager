import { describe, it, before, after } from 'node:test'
import { equal } from 'assert'
import { QueueOptions } from 'bullmq'
import { QueueManager, DefaultJob, Queues, NameToQueue } from '../../src/QueueManager'

import { createRedis } from '../utils'

describe('Queue manager', () => {
  type JobNames = 'Job1' | 'Job2'
  type QueueNames = 'Queue1' | 'Queue2'

  const connection = createRedis()
  let queueManager: QueueManager<JobNames, QueueNames, DefaultJob<JobNames>>

  before(async () => {
    await connection.connect()
    const queues: Queues<QueueNames> = {
      Queue1: true,
      Queue2: true,
    }

    const queueOptions: QueueOptions = {
      connection: connection,
    }

    const nameToQueue: NameToQueue<JobNames, QueueNames> = {
      Job1: 'Queue1',
      Job2: 'Queue2',
    }

    queueManager = new QueueManager<JobNames, QueueNames, DefaultJob<JobNames>>(
      queues,
      queueOptions,
      nameToQueue
    )
    await queueManager.waitUntilReady()
  })

  after(async () => {
    await queueManager.close()
    await connection.quit()
  })

  it('Add job in queue', async () => {
    const newJob: DefaultJob<JobNames> = { name: 'Job1', data: {} }

    const job = await queueManager.addJob(newJob)

    equal(job.queueName, 'Queue1')
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
