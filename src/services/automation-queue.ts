type Job = () => Promise<void>;

export class AsyncProcessingQueue {
  private queue: Job[] = [];
  private running = 0;

  constructor(private concurrencyLimit: number) {}

  setConcurrency(limit: number) {
    this.concurrencyLimit = Math.max(1, limit);
    this.pump();
  }

  enqueue(job: Job) {
    this.queue.push(job);
    this.pump();
  }

  private pump() {
    while (this.running < this.concurrencyLimit && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        return;
      }
      this.running += 1;
      void job()
        .catch(() => undefined)
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }
}
