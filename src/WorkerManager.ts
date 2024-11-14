import { RedisConnection, Worker, WorkerOptions, Processor, Job, WorkerListener } from 'bullmq'
import type { DefaultJob, ConnectionStatus } from './QueueManager'

export type Workers<QN extends string> = Record<QN, WorkerOptions | boolean | undefined | null>


export type WorkerManagerOptions = {}

export class WorkerManager<
  JNs extends string,
  QNs extends string,
  J extends DefaultJob<JNs>,
> {
  protected workers = {} as Record<QNs, Worker>
  protected connectionStatus: ConnectionStatus = 'disconnected'

  constructor(
    workers: Workers<QNs>,
    processor: (job: Job) => Promise<unknown>,
    workerOptions: WorkerOptions,
    protected options: WorkerManagerOptions,
    Connection?: typeof RedisConnection,
  ) {
    const wIterator = Object.entries<Partial<WorkerOptions> | boolean | undefined | null>(workers)

    for (const [wName, wOptions] of wIterator) {
      if (wOptions) {
        const worker = new Worker(
          wName,
          processor,
          {
            ...workerOptions,
            ...(wOptions === true ? undefined : wOptions),
          },
          Connection
        )

        this.workers[wName as QNs] = worker
      }
    }
  }

  on<U extends keyof WorkerListener<any, any, string>>(event: U, listener: WorkerListener<any, any, string>[U]) {
    for (const wName of Object.keys(this.workers) as QNs[]) {
      const worker = this.getWorker(wName)
      worker.on(event, listener)
    }
  }

  once<U extends keyof WorkerListener<any, any, string>>(event: U, listener: WorkerListener<any, any, string>[U]) {
    for (const wName of Object.keys(this.workers) as QNs[]) {
      const worker = this.getWorker(wName)
      worker.once(event, listener)
    }
  }

  run() {
    if (this.connectionStatus !== 'connected') {
      this.connectionStatus = 'connected'
    }
    for (const w of Object.values<Worker>(this.workers)) {
      w.run()
    }
  }

  async waitUntilReady() {
    if (this.connectionStatus !== 'connected') {
      this.connectionStatus = 'connected'
    }

    await Promise.all(
      Object.values<Worker>(this.workers).map((q) => q.waitUntilReady())
    )
  }

  async close() {
    this.checkConnectionStatus()
    this.connectionStatus = 'closed'

    await Promise.all(
      Object.values<Worker>(this.workers).map((w) => w.close())
    )
  }

  getWorker(name: QNs) {
    return this.workers[name]
  }

  private checkConnectionStatus() {
    if (this.connectionStatus === 'disconnected') {
      throw new Error('WorkerManager is disconnected')
    } else if (this.connectionStatus === 'closed') {
      throw new Error('WorkerManager is closed')
    }
  }
}
