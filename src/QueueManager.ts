import { Queue, FlowProducer } from 'bullmq'
import type { QueueOptions, RedisConnection, DefaultJobOptions } from 'bullmq'

export type Queues<QN extends string> = Record<QN, QueueOptions | boolean | undefined | null>
export type NameToQueue<JN extends string, QN extends string> = Record<JN, QN>
export type DefaultJob<JN extends string> = {
  name: JN
  data: unknown
  opts?: DefaultJobOptions
}

export type FlowJob<JN extends string> = DefaultJob<JN> & {
  children?: Array<FlowJob<JN>>
}

export type Options = {
  /**
   * 
   * @param queue - instance of Queue for additional setup (event handling) 
   * @returns {void}
   */
  setupQueue?: (queue: Queue) => void
}

export class QueueManager<
  JNs extends string,
  QNs extends string,
  J extends DefaultJob<JNs>,
> {
  protected queues = {} as Record<QNs, Queue>
  protected isClosed = false

  constructor(
    queues: Queues<QNs>,
    queueOptions: QueueOptions,
    protected nameToQueue: NameToQueue<JNs, QNs>,
    protected options: Options = {},
    Connection?: typeof RedisConnection,
  ) {
    const qIterator = Object.entries<QueueOptions | boolean | undefined | null>(queues)

    for (const [qName, qOptions] of qIterator) {
      if (qOptions) {
        const queue = new Queue(
          qName,
          {
            ...queueOptions,
            ...(qOptions === true ? undefined : qOptions)
          },
          Connection
        )
        if (options.setupQueue) {
          options.setupQueue(queue)
        }
        this.queues[qName as QNs] = queue
      }
    }
  }

  /**
   * 
   */
  async waitUntilReady() {
    await Promise.all(
      Object.values<Queue>(this.queues).map((q) => q.waitUntilReady())
    )
  }

  async close() {
    this.isClosed = true
    await Promise.all(
      Object.values<Queue>(this.queues).map((q) => q.close())
    )
  }

  getQueue(name: QNs) {
    return this.queues[name]
  }

  addJob(job: J) {
    if (!this.isClosed) {
      const queueName = this.getQueueNameByJobName(job.name)
      return this.queues[queueName].add(job.name, job.data, job.opts)
    }
  }

  addJobs(jobs: J[]) {
    if (!this.isClosed) {

      const jobsPerQueue = {} as Record<QNs, J[] | undefined>

      for (const j of jobs) {
        const queueName = this.getQueueNameByJobName(j.name)
        let jobs = jobsPerQueue[queueName]
        if (!jobs) {
          jobsPerQueue[queueName] = jobs = []
        }
        jobs.push(j)
      }
      return Promise.all(
        Object.entries<J[] | undefined>(jobsPerQueue)
          .map(([queueName, jobs]) => this.queues[queueName as QNs].addBulk(jobs as J[]))
      )
    }
  }

  getQueueNameByJobName(name: JNs) {
    return this.nameToQueue[name]
  }
}
