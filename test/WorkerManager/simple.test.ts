import { describe, it, before, after, afterEach, beforeEach } from 'node:test'
import { equal, throws, rejects } from 'assert'
import { WorkerOptions, Job, QueueOptions, Worker } from 'bullmq'
import { WorkerManager, WorkerManagerOptions, Workers } from '../../src/WorkerManager'
import { DefaultJob, NameToQueue, Queues, QueueManager } from '../../src/QueueManager'

import { createRedis } from '../utils'

describe('Worker manager', () => {
    type JobNames1 = 'Job1'
    type JobNames2 = 'Job2'
    type JobNames = JobNames1 | JobNames2
    type QueueNames = 'Queue1' | 'Queue2'
    let isListenerCalled = false

    type JobDataType = {
        price: number,
    }
    type JobsType = {
        name: JobNames,
        data: JobDataType
    }



    const connection = createRedis()
    let workerManager: WorkerManager<JobNames, QueueNames, JobDataType>
    let queueManager: QueueManager<JobNames, QueueNames, JobDataType, DefaultJob<JobNames, JobDataType>>
    type Jobs = JobsType & Pick<Job, 'id' | 'queueName'>
    const newJob: DefaultJob<JobNames, JobDataType> = { name: 'Job1', data: { price: 100 } }


    const listenerOn = (worker: Worker, job: Job) => {
        isListenerCalled = true
        console.log(`Job=${job.name} active in worker=${worker.name}`)
    }

    before(async () => {
        await connection.connect()
        const workers: Workers<QueueNames> = {
            Queue1: {
                connection: connection,
                concurrency: 5
            },
            Queue2: true,
        }

        const processor = async (job: Jobs) => { console.log(`Processing ${job.name}`) }

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

        workerManager = new WorkerManager<JobNames, QueueNames, JobDataType>(
            workers,
            processor,
            workerOptions,
            options
        )

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

        queueManager = new QueueManager<JobNames, QueueNames, JobDataType, DefaultJob<JobNames, JobDataType>>(
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

    afterEach(async () => {
        await queueManager.getQueue('Queue1').drain()
        await queueManager.getQueue('Queue2').drain()
        isListenerCalled = false
    })

    it('waitUntilReady', async () => {
        await workerManager.waitUntilReady()
        await workerManager.waitUntilReady()
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

        workerManager.run()

        const isRunning1 = workerManager.getWorker('Queue1').isRunning() === true
        equal(isRunning1, true)

        const isRunning2 = workerManager.getWorker('Queue2').isRunning() === true
        equal(isRunning2, true)
    })

    it('listener on', async () => {

        workerManager.on('active', listenerOn)
        await queueManager.addJob(newJob)
        await new Promise(resolve => setTimeout(resolve, 2000))

        const listenersArray = workerManager.getWorker('Queue1').listeners('active')
        equal(listenersArray.length, 1)
        equal(isListenerCalled, true)
    })

    it('listener off error', () => {
        throws(
            () => workerManager.off('active', () => { }),
            Error,
            'Listener not found'
        )
    })

    it('listener off', async () => {

        workerManager.off('active', listenerOn)

        queueManager.addJob(newJob)
        await new Promise(resolve => setTimeout(resolve, 100))

        const listenersArray = queueManager.getQueue('Queue1').listeners('active')
        equal(listenersArray.length, 0)
        equal(isListenerCalled, false)
    })

    it('listener once', async () => {
        let callCount = 0

        workerManager.once('paused', () => {
            callCount++;
            console.log(`Worker paused`)
        })

        await workerManager.getWorker('Queue1').pause()
        await workerManager.getWorker('Queue1').pause()

        equal(callCount, 1)
        await queueManager.getQueue('Queue1').resume()
    })

    it('close all workers', async () => {
        workerManager.on('closed', (worker) => console.log(`worker=${worker.name} closed`))
        await workerManager.close()

        const isClosed1 = workerManager.getWorker('Queue1').isRunning() === false
        equal(isClosed1, true)

        const isClosed2 = workerManager.getWorker('Queue2').isRunning() === false
        equal(isClosed2, true)
    })

    it('close checkConnectionStatus error', () => {
        rejects(
            async () => await workerManager.close(),
            Error,
            'WorkerManager is closed'
        )
    })
})
