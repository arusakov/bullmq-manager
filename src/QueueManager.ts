import { Queue, type QueueOptions, type RedisConnection, } from 'bullmq'

export type Queues<QN extends string> = Record<QN, QueueOptions>
export type NameToQueue<JN extends string, QN extends string> = Record<JN, QN>

export class QueueManager<
  JNs extends string,
  QNs extends string,
> {

  protected queues: Record<QNs, Queue>

  constructor(
    queues: Queues<QNs>,
    protected nameToQueue: NameToQueue<JNs, QNs>,
    connection: typeof RedisConnection,
  ) {
    this.queues = {} as Record<QNs, Queue>

    for (const [name, options] of Object.entries<QueueOptions>(queues)) {
      this.queues[name as QNs] = new Queue(name, options, connection)
    }
  }
}