import { describe, it, before, after, afterEach } from 'node:test'
import { equal, throws } from 'assert'
import { QueueOptions } from 'bullmq'
import { QueueManager, DefaultJob, Queues, NameToQueue } from '../../src/QueueManager'

import { createRedis } from '../utils'
import { WorkerManager } from '../../src/WorkerManager'

describe('Queue manager', () => {
  type JobNames = 'Job1' | 'Job2'
  type QueueNames = 'Queue1' | 'Queue2'

  const connection = createRedis()
  connection.on('connect', () => console.log('Connection connect'))
  connection.on('close', () => console.log('Connection closed'))

  let queueManager: QueueManager<JobNames, QueueNames, DefaultJob<JobNames>>
  const newJob: DefaultJob<JobNames> = { name: 'Job1', data: {} }

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
      nameToQueue,

    )
    await queueManager.waitUntilReady()
  })

  afterEach(async () => {
    queueManager.getQueue('Queue1').drain()
    queueManager.getQueue('Queue2').drain()
  })

  after(async () => {

    await queueManager.close()
    await connection.quit()
  })

  it('Add job in queue', async () => {

    const job = await queueManager.addJob(newJob)

    if (job) {
      equal(job.queueName, 'Queue1')
      equal(job.name, 'Job1')
    }
  })

  it('Add jobs in queue', async () => {
    const newJobs: DefaultJob<JobNames>[] = [{ name: 'Job1', data: {} }, { name: 'Job1', data: {} }, { name: 'Job2', data: {} }]

    const queue1Jobs = await queueManager.getQueue('Queue1').getWaiting()
    const queue2Jobs = await queueManager.getQueue('Queue2').getWaiting()

    equal(queue1Jobs.length, 2)
    equal(queue2Jobs.length, 1)
  })

  it('should return the correct queue name for a given job name', () => {
    const queueName = queueManager.getQueueNameByJobName('Job1')
    equal(queueName, 'Queue1')

    const queueName2 = queueManager.getQueueNameByJobName('Job2')
    equal(queueName2, 'Queue2')
  })

  it('should return the correct queue for a given queue name', () => {
    const queue1 = queueManager.getQueue('Queue1')
    equal(queue1.name, 'Queue1')

    const queue2 = queueManager.getQueue('Queue2')
    equal(queue2.name, 'Queue2')
  })

  it('close', async () => {
    await queueManager.close()
    await queueManager.addJob(newJob)

    const queue1 = queueManager.getQueue('Queue1')
    const jobCount = await queue1.count()

    equal(jobCount, 0)
  })
})
