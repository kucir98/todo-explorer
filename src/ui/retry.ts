// Panel przywrócony z layoutu może wysłać getState, zanim worker zarejestruje handler – wiadomość wtedy przepada.
// Ponawiamy, dopóki nie przyjdzie odpowiedź (albo nie skończą się próby). Zwraca funkcję anulującą.
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
