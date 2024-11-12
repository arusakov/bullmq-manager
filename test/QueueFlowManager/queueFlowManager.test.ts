import { describe, it, before, after, afterEach, only } from 'node:test'
import { equal, fail, strictEqual, deepStrictEqual } from 'assert'
import { FlowProducer, QueueOptions, RedisConnection, Queue } from 'bullmq'
import type { FlowJobReal } from '../../src/QueueFlowManager'
import { QueueFlowManager } from '../../src/QueueFlowManager'
import type { DefaultJob, NameToQueue, Options, Queues, FlowJob } from '../../src/QueueManager'


import { createRedis } from '../utils'

describe('Queue manager', () => {
    type JobNames = 'Job1' | 'Job2'
    type QueueNames = 'Queue1' | 'Queue2'

    const connection = createRedis()
    connection.on('connect', () => console.log('Connection connect'))
    connection.on('close', () => console.log('Connection closed'))

    let flowQueueManager: QueueFlowManager<JobNames, QueueNames, DefaultJob<JobNames>>
    const childrenJob: FlowJob<JobNames> = { name: 'Job2', data: {} }
    const newJob: FlowJob<JobNames> = { name: 'Job1', data: {}, children: [childrenJob] }
    const newJobs: FlowJob<JobNames>[] = [newJob, newJob]

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
        }

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

        const options: Options = {}

        flowQueueManager = new QueueFlowManager<JobNames, QueueNames, DefaultJob<JobNames>>(
            queues,
            queueOptions,
            nameToQueue,
            options
        )

        await flowQueueManager.waitUntilReady()
    })

    afterEach(async () => {
        await flowQueueManager.getQueue('Queue1').drain()
        await flowQueueManager.getQueue('Queue2').drain()
    })

    after(async () => {
        try {
            await flowQueueManager.close()
        }
        catch (err) { }
        await connection.quit()
    })

    it('Setup options', () => {
        const queue = flowQueueManager.getQueue('Queue1')
        equal(queue.defaultJobOptions.attempts, 5)
    })

    it('Add flow job in queue', async () => {

        await flowQueueManager.addFlowJob(newJob)
        const queue1 = flowQueueManager.getQueue('Queue1')
        const queue2 = flowQueueManager.getQueue('Queue2')

        equal(await queue1.count(), 1)
        deepStrictEqual((await queue1.getJobs()).map(job => job.name), ['Job1'])
        equal(await queue2.count(), 1)
        deepStrictEqual((await queue2.getJobs()).map(job => job.name), ['Job2'])
    })





})
