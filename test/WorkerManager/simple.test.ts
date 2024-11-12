import { describe, it, before, after, afterEach, beforeEach } from 'node:test'
import { equal, throws } from 'assert'
import { WorkerOptions, Job, QueueOptions, Worker } from 'bullmq'
import { WorkerManager, WorkerManagerOptions, Workers } from '../../src/WorkerManager'
import { DefaultJob, NameToQueue, Queues, QueueManager } from '../../src/QueueManager'

import { createRedis } from '../utils'

describe('Worker manager', () => {
    type JobNames = 'Job1' | 'Job2'
    type QueueNames = 'Queue1' | 'Queue2'

    const connection = createRedis()
    let workerManager: WorkerManager<JobNames, QueueNames, DefaultJob<JobNames>>
    let queueManager: QueueManager<JobNames, QueueNames, DefaultJob<JobNames>>
    const newJob: DefaultJob<JobNames> = { name: 'Job1', data: {} }

    before(async () => {
        await connection.connect()
        const workers: Workers<QueueNames> = {
            Queue1: {
                connection: connection,
                concurrency: 5
            },
            Queue2: true,
        }

        const processor = async (job: Job) => { console.log(`Processing ${job.name}`) }

        const workerOptions: WorkerOptions = {
            connection: connection,
            removeOnComplete: {
                count: 0
            },
            removeOnFail: {
                count: 0
            },
            concurrency: 1
        }

        const options: WorkerManagerOptions = {}

        workerManager = new WorkerManager<JobNames, QueueNames, DefaultJob<JobNames>>(
            workers,
            processor,
            workerOptions,
            options
        )
        await workerManager.waitUntilReady()

        const queues: Queues<QueueNames> = {
            Queue1: true,
            Queue2: true,
        }

        const queueOptions: QueueOptions = {
            connection: connection,
            streams: {
                events: {
                    maxLen: 0
                }
            }
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

        try {
            await workerManager.close()
            await queueManager.close()
        } catch { }

        await connection.quit()
    })

    afterEach(async () => {
        await queueManager.getQueue('Queue1').drain()
        await queueManager.getQueue('Queue2').drain()
    })

    it('setup options', () => {
        const worker = workerManager.getWorker('Queue1')
        equal(worker.opts.concurrency, 5)

        const worker2 = workerManager.getWorker('Queue2')
        equal(worker2.opts.concurrency, 1)
    })

    it('get workers', () => {
        equal(workerManager.getWorker('Queue1').name, 'Queue1')
        equal(workerManager.getWorker('Queue2').name, 'Queue2')
    })

    it('run all workers', async () => {

        const isRunning1 = workerManager.getWorker('Queue1').isRunning() === true
        equal(isRunning1, true)

        const isRunning2 = workerManager.getWorker('Queue2').isRunning() === true
        equal(isRunning2, true)
    })

    it('close all workers', async () => {
        await workerManager.close()

        const isClosed1 = workerManager.getWorker('Queue1').isRunning() === false
        equal(isClosed1, true)

        const isClosed2 = workerManager.getWorker('Queue2').isRunning() === false
        equal(isClosed2, true)
    })
})
