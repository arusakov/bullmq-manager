import { RedisConnection, Worker, WorkerOptions, Processor, Job } from 'bullmq'
import type { DefaultJob } from './QueueManager'

export type Workers<QN extends string> = Record<QN, WorkerOptions | boolean | undefined | null>

export type WorkerManagerOptions = {
  /**
   * 
   * @param worker - instance of Worker for additional setup (event handling) 
   * @returns {void}
   */
  setupWorker?: (worker: Worker) => void
}

export class WorkerManager<
  JNs extends string,
  QNs extends string,
  J extends DefaultJob<JNs>,
> {
  protected workers = {} as Record<QNs, Worker>
  protected isClosed = false

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
        if (options.setupWorker) {
          options.setupWorker(worker)
        }
        this.workers[wName as QNs] = worker
      }
    }
  }

  run() {
    for (const w of Object.values<Worker>(this.workers)) {
      w.run()
    }
  }

  async waitUntilReady() {
    await Promise.all(
      Object.values<Worker>(this.workers).map((q) => q.waitUntilReady())
    )
  }

  async close() {
    if (this.isClosed) {
      throw new Error('WorkerManager is already closed')
    }
    this.isClosed = true
    await Promise.all(
      Object.values<Worker>(this.workers).map((w) => w.close())
    )
  }

  getWorker(name: QNs) {
    return this.workers[name]
  }
}
