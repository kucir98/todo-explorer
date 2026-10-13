// A pane restored from the layout may send getState before the worker registers its handler, and the message is lost.
// Resend until an answer arrives (or tries run out). Returns a cancel function.
export function requestUntilAnswered(send: () => void, answered: () => boolean, intervalMs: number, maxTries: number): () => void {
    let tries = 1;
    send();
    const timer = setInterval(() => {
        if (answered() || tries >= maxTries) return clearInterval(timer);
        tries++;
        send();
    }, intervalMs);
    return () => clearInterval(timer);
}
