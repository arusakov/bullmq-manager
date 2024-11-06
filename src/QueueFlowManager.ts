import { FlowProducer, JobNode, QueueOptions, RedisConnection } from 'bullmq'

import type { DefaultJob, NameToQueue, Options, Queues } from './QueueManager'

import { QueueManager } from './QueueManager'

export type FlowJob<JN extends string, QNs extends string> = DefaultJob<JN> & {
  queueName: QNs
  children?: Array<FlowJob<JN, QNs>>
}

export class QueueFlowManager<
  JNs extends string,
  QNs extends string,
  J extends DefaultJob<JNs>,
> extends QueueManager<JNs, QNs, J> {

  protected flowProducer: FlowProducer

  constructor(
    queues: Queues<QNs>,
    queueOptions: QueueOptions,
    protected nameToQueue: NameToQueue<JNs, QNs>,
    options?: Options,
    Connection?: typeof RedisConnection,
  ) {
    super(queues, queueOptions, nameToQueue, options, Connection)

    this.flowProducer = new FlowProducer(queueOptions, Connection)
  }

  addFlow(jobTree: FlowJob<JNs, QNs>): Promise<JobNode> {
    return this.flowProducer.add(jobTree)
  }

  addBulkFlow(jobTrees: FlowJob<JNs, QNs>[]): Promise<JobNode[]> {
    return Promise.all(
      jobTrees.map(jobTree => this.flowProducer.add(jobTree))
    )
  }

  async waitUntilReady() {
    await Promise.all([
      super.waitUntilReady(),
      this.flowProducer.waitUntilReady(),
    ])
  }

  async close() {
    await Promise.all([
      super.close(),
      this.flowProducer.close(),
    ])
  }
}