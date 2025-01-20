import { FlowProducer, QueueOptions, RedisConnection } from 'bullmq'

import type { DefaultJob, NameToQueue, Options, Queues } from './QueueManager'

import { QueueManager, FlowJob } from './QueueManager'

export type FlowJobReal<JN extends string, JD extends object> = FlowJob<JN, JD> & {
  queueName: string
  children?: Array<FlowJobReal<JN, JD>>
}


export class QueueFlowManager<
  JNs extends string,
  QNs extends string,
  JD extends object,
  J extends DefaultJob<JNs, JD>,
> extends QueueManager<JNs, QNs, JD, J> {

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


  async addFlowJob(job: FlowJob<JNs, JD>) {
    this.checkConnectionStatus()
    const flowJobWithQueueNames = this.resolveQueueNames(job)
    return this.flowProducer.add(flowJobWithQueueNames)
  }

  async addFlowJobs(jobs: FlowJob<JNs, JD>[]) {
    this.checkConnectionStatus()
    const flowJobsWithQueueNames = jobs.map(job => this.resolveQueueNames(job))
    return this.flowProducer.addBulk(flowJobsWithQueueNames)
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

  private resolveQueueNames(job: FlowJob<JNs, JD>): FlowJobReal<JNs, JD> {
    const queueName = this.getQueueNameByJobName(job.name)
    const resolvedJob: FlowJobReal<JNs, JD> = {
      ...job,
      queueName,
      children: job.children?.map(child => this.resolveQueueNames(child))
    }
    return resolvedJob
  }

}