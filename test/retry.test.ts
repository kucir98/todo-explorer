import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { requestUntilAnswered } from "../src/ui/retry";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("resendsUntilAnswered", () => {
    let sent = 0, answered = false;
    requestUntilAnswered(() => sent++, () => answered, 1000, 10);
    expect(sent).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(sent).toBe(3);
    answered = true;
    vi.advanceTimersByTime(5000);
    expect(sent).toBe(3);
});

test("stopsAfterMaxTries", () => {
    let sent = 0;
    requestUntilAnswered(() => sent++, () => false, 1000, 3);
    vi.advanceTimersByTime(10000);
    expect(sent).toBe(3);
});

test("cancelStops", () => {
    let sent = 0;
    const cancel = requestUntilAnswered(() => sent++, () => false, 1000, 10);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(sent).toBe(1);
});
