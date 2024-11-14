import { describe, it, before, after, afterEach } from 'node:test'
import { equal, fail, strictEqual } from 'assert'
import { QueueOptions, Job } from 'bullmq'

import { QueueManager, DefaultJob, Queues, NameToQueue, Options } from '../../src/QueueManager'

import { createRedis } from '../utils'

describe('Queue manager', () => {
  type JobNames = 'Job1' | 'Job2'
  type QueueNames = 'Queue1' | 'Queue2'

  const connection = createRedis()

  let isListenerCalled = false
  const listenerOn = (job: Job) => {
    isListenerCalled = true
    console.log(`Job.id=${job.id} is waiting`)
  }

  let queueManager: QueueManager<JobNames, QueueNames, DefaultJob<JobNames>>
  const newJob: DefaultJob<JobNames> = { name: 'Job1', data: {} }

  before(async () => {

    await connection.connect()
    const queues: Queues<QueueNames> = {
      Queue1: {
        connection: connection,
        defaultJobOptions: {
          attempts: 5
        },
      },
      Queue2: true,
    };

    const queueOptions: QueueOptions = {
      connection: connection,
      streams: {
        events: {
          maxLen: 0
        }
      },
      defaultJobOptions: {
        attempts: 0
      }
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
    await queueManager.getQueue('Queue1').drain()
    await queueManager.getQueue('Queue2').drain()
  })

  after(async () => {

    await connection.quit()
  })

  it('Setup options', () => {
    const queue = queueManager.getQueue('Queue1')
    equal(queue.defaultJobOptions.attempts, 5)

    const queue2 = queueManager.getQueue('Queue2')
    equal(queue2.defaultJobOptions.attempts, 0)
  })

  it('Add job in queue', async () => {

    const job = await queueManager.addJob(newJob)
    const queue1Jobs = await queueManager.getQueue('Queue1').getWaiting()

    if (job) {
      equal(job.queueName, 'Queue1')
      equal(job.name, 'Job1')
      equal(queue1Jobs.length, 1)

    }
  })

  it('Add jobs in queue', async () => {
    const newJobs: DefaultJob<JobNames>[] = [{ name: 'Job1', data: {} }, { name: 'Job1', data: {} }, { name: 'Job2', data: {} }]

    queueManager.addJobs(newJobs)

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

  it('listener on', async () => {

    queueManager.on('waiting', listenerOn)

    await queueManager.addJob(newJob)
    await new Promise(resolve => setTimeout(resolve, 100))

    const listenersArray = queueManager.getQueue('Queue1').listeners('waiting')
    equal(listenersArray.length, 1)
    equal(isListenerCalled, true)
  })

  it('listener once', async () => {
    let callCount = 0

    queueManager.once('paused', () => {
      callCount++;
      console.log(`Queue paused`)
    })

    await queueManager.getQueue('Queue1').pause()
    await queueManager.getQueue('Queue1').pause()

    equal(callCount, 1)

  })

  it('close', async () => {
    await queueManager.close()

    try {
      await queueManager.addJob(newJob)
      fail("Expected an error, but none was thrown")
    } catch (error) {
      if (error instanceof Error) {
        strictEqual(error.message, 'QueueManager is closed');
      } else {
        fail("Caught an error, but it was not of type Error");
      }
    }
  })
})
