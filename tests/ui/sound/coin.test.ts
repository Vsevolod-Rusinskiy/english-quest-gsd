import { describe, it, expect, afterEach, vi } from "vitest";

// UX-COIN-01: synthesized coin-clink on ruble award. jsdom has NO
// AudioContext at all, so the "absent constructor" path is exercised by
// every test in this file unless we stub one in — matching the real-browser
// "unavailable/blocked" degrade-silently requirement (T-krq-01).
//
// coin.ts keeps a module-scoped lazily-created AudioContext singleton by
// design (verified by the "reuses across calls" test below) — that means
// each test must get a FRESH module instance so one test's stubbed
// AudioContext can't leak its already-constructed `ctx` into the next.
// vi.resetModules() + a dynamic re-import per test achieves that isolation.
describe("playCoinSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function freshPlayCoinSound(): Promise<() => void> {
    vi.resetModules();
    const mod = await import("../../../src/ui/sound/coin");
    return mod.playCoinSound;
  }

  it("never throws when window.AudioContext is absent (jsdom default)", async () => {
    const playCoinSound = await freshPlayCoinSound();
    expect(() => playCoinSound()).not.toThrow();
  });

  it("never throws when constructing AudioContext throws (autoplay-blocked / SecurityError)", async () => {
    class ThrowingAudioContext {
      constructor() {
        throw new DOMException("blocked by autoplay policy", "SecurityError");
      }
    }
    vi.stubGlobal("AudioContext", ThrowingAudioContext);
    const playCoinSound = await freshPlayCoinSound();

    expect(() => playCoinSound()).not.toThrow();
  });

  it("never throws when a working stub's node methods throw mid-graph", async () => {
    class PartlyBrokenAudioContext {
      state = "running";
      destination = {};
      createOscillator() {
        throw new Error("node graph error");
      }
      createGain() {
        return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
      }
    }
    vi.stubGlobal("AudioContext", PartlyBrokenAudioContext);
    const playCoinSound = await freshPlayCoinSound();

    expect(() => playCoinSound()).not.toThrow();
  });

  it("wires oscillator + gain nodes, connects them, and calls start/stop when a working stub is supplied", async () => {
    const oscInstances: Array<{
      type: string;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const gainInstances: Array<{
      gain: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        linearRampToValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    class WorkingAudioContext {
      state = "running";
      destination = {};
      currentTime = 0;
      createOscillator() {
        const osc = {
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscInstances.push(osc);
        return osc;
      }
      createGain() {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
        gainInstances.push(gain);
        return gain;
      }
    }
    vi.stubGlobal("AudioContext", WorkingAudioContext);
    const playCoinSound = await freshPlayCoinSound();

    expect(() => playCoinSound()).not.toThrow();

    // Two short notes -> two oscillators, each through its own gain node.
    expect(oscInstances.length).toBeGreaterThanOrEqual(2);
    expect(gainInstances.length).toBeGreaterThanOrEqual(2);
    for (const osc of oscInstances) {
      expect(osc.connect).toHaveBeenCalled();
      expect(osc.start).toHaveBeenCalled();
      expect(osc.stop).toHaveBeenCalled();
    }
    for (const gain of gainInstances) {
      expect(gain.connect).toHaveBeenCalled();
    }
  });

  it("lazily creates ONE AudioContext and reuses it across calls (not re-created every call)", async () => {
    let constructCount = 0;
    class CountingAudioContext {
      state = "running";
      destination = {};
      currentTime = 0;
      constructor() {
        constructCount++;
      }
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal("AudioContext", CountingAudioContext);
    const playCoinSound = await freshPlayCoinSound();

    playCoinSound();
    playCoinSound();

    expect(constructCount).toBe(1);
  });
});
