// Backend Studio Pro obsługuje wywołania Model API po kolei, a równoległe tworzenie jednostek kończyło się błędem 500 –
// dlatego wszystkie wywołania idą przez jedną kolejkę.
export class Queue {
    private tail: Promise<unknown> = Promise.resolve();

    run<T>(job: () => Promise<T>): Promise<T> {
        const result = this.tail.then(job);
        this.tail = result.catch(() => undefined);
        return result;
    }
}
