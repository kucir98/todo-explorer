// The Studio Pro backend handles Model API calls one at a time, and parallel unit creation failed with HTTP 500,
// so every call goes through a single queue.
export class Queue {
    private tail: Promise<unknown> = Promise.resolve();

    run<T>(job: () => Promise<T>): Promise<T> {
        const result = this.tail.then(job);
        this.tail = result.catch(() => undefined);
        return result;
    }
}
