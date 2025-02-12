import { RedisConnection, Worker, WorkerOptions, Job, WorkerListener } from 'bullmq'
import type { DefaultJob, ConnectionStatus } from './QueueManager'

export type WorkerConfig = Partial<WorkerOptions> | boolean | undefined | null
export type Workers<QN extends string> = Record<QN, WorkerConfig>
export type WorkerManagerOptions = {}

const listenerSymbol = Symbol('listenerSymbol')

type AddWorkerParameter<T extends any[]> = [worker: Worker<any, any, string>, ...T]
type WorkerEventName = keyof WorkerListener<any, any, string>
type ListenerParametersWithWorker<U extends WorkerEventName> = AddWorkerParameter<Parameters<WorkerListener<any, any, string>[U]>>

type WorkerFunctionWithSymbol<U extends WorkerEventName> = {
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
  protected workers = {} as Record<QNs, Worker<any, any, JNs>>
  protected connectionStatus: ConnectionStatus = 'disconnected'

  constructor(
    workersConfig: Workers<QNs>,
    processor: (job: Job<any, any, JNs>) => Promise<unknown>,
    workerOptions: WorkerOptions,
    protected options: WorkerManagerOptions,
    Connection?: typeof RedisConnection,
  ) {
    const configIterator = Object.entries<WorkerConfig>(workersConfig)

    for (const [name, workerConfig] of configIterator) {
      if (workerConfig) {
        const worker = new Worker(
          name,
          processor,
          {
            ...workerOptions,
            ...(workerConfig === true ? undefined : workerConfig),
          },
          Connection
        )

        this.workers[name as QNs] = worker
      }
    }
  }

  on<U extends WorkerEventName>(event: U, listener: WorkerFunctionWithSymbol<U>) {
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

  off<U extends WorkerEventName>(event: U, listener: WorkerFunctionWithSymbol<U>) {
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


  once<U extends WorkerEventName>(event: U, listener: WorkerFunctionWithSymbol<U>) {
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
    } else {
      console.log(`${this.constructor.name} is already running`)
      return
    }
    for (const w of Object.values<Worker<any, any, JNs>>(this.workers)) {
      w.run()
    }
  }

  async waitUntilReady() {
    if (this.connectionStatus !== 'connected') {
      this.connectionStatus = 'connected'
    } else {
      console.log(`${this.constructor.name} is already running`)
      return
    }

    await Promise.all(
      Object.values<Worker<any, any, JNs>>(this.workers).map((q) => q.waitUntilReady())
    )
  }

  async close() {
    this.checkConnectionStatus()
    this.connectionStatus = 'closed'

    await Promise.all(
      Object.values<Worker<any, any, JNs>>(this.workers).map((w) => w.close())
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
