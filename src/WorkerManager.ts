import { RedisConnection, Worker, WorkerOptions, Job, WorkerListener } from 'bullmq'
import type { DefaultJob, ConnectionStatus } from './QueueManager'

export type Workers<QN extends string> = Record<QN, WorkerOptions | boolean | undefined | null>
export type WorkerManagerOptions = {}

const listenerSymbol = Symbol('listenerSymbol')

export type EventName = keyof WorkerListener<any, any, string>
type AddWorkerParameter<T extends any[]> = [worker: Worker<any, any, string>, ...T]
export type ListenerParametersWithWorker<U extends EventName> = AddWorkerParameter<Parameters<WorkerListener<any, any, string>[U]>>

type FunctionWithSymbol<U extends EventName> = {
  (...args: ListenerParametersWithWorker<U>): void
  [listenerSymbol]?: {
    event: U
    listeners: Function[]
  }
}

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

  on<U extends EventName>(event: U, listener: FunctionWithSymbol<U>) {
    if (!listener[listenerSymbol]) {
      listener[listenerSymbol] = {
        event,
        listeners: [],
      }
    }

    for (const worker of Object.values(this.workers) as Worker[]) {
      const wrappedListener: WorkerListener<any, any, string>[U] = ((...args: Parameters<WorkerListener<any, any, string>[U]>) => {
        listener(worker, ...args)
      }) as WorkerListener<any, any, string>[U]

      listener[listenerSymbol].listeners.push(wrappedListener)
      worker.on(event, wrappedListener)
    }
  }

  off<U extends EventName>(event: U, listener: FunctionWithSymbol<U>) {
    if (!listener[listenerSymbol]) {
      throw new Error('Listener not found')
    }

    const { listeners } = listener[listenerSymbol]

    for (const [index, worker] of (Object.values(this.workers) as Worker[]).entries()) {
      const wrappedListener = listeners[index]
      if (wrappedListener) {
        worker.off(event, wrappedListener as WorkerListener<any, any, string>[U])
      }
    }
    listener[listenerSymbol].listeners = []
  }


  once<U extends EventName>(event: U, listener: FunctionWithSymbol<U>) {
    for (const worker of Object.values(this.workers) as Worker[]) {
      const wrappedListener: WorkerListener<any, any, string>[U] = ((...args: Parameters<WorkerListener<any, any, string>[U]>) => {
        listener(worker, ...args);
      }) as WorkerListener<any, any, string>[U];

      worker.once(event, wrappedListener)
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
