import { FlowProducer, QueueOptions, RedisConnection } from 'bullmq'

import type { DefaultJob, NameToQueue, Options, Queues } from './QueueManager'

import { QueueManager } from './QueueManager'

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

  async waitUntilReady() {
    await Promise.all([
      super.waitUntilReady(),
      this.flowProducer.close(),
    ])
  }

  async close() {
    await Promise.all([
      super.close(),
      this.flowProducer.close(),
    ])
  }
}