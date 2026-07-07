import { describe, it, expect, afterEach, vi } from "vitest";
import { playCoinSound } from "../../../src/ui/sound/coin";

// UX-COIN-01: synthesized coin-clink on ruble award. jsdom has NO
// AudioContext at all, so the "absent constructor" path is exercised by
// every test in this file unless we stub one in — matching the real-browser
// "unavailable/blocked" degrade-silently requirement (T-krq-01).
describe("playCoinSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never throws when window.AudioContext is absent (jsdom default)", () => {
    expect(() => playCoinSound()).not.toThrow();
  });

  it("never throws when constructing AudioContext throws (autoplay-blocked / SecurityError)", () => {
    class ThrowingAudioContext {
      constructor() {
        throw new DOMException("blocked by autoplay policy", "SecurityError");
      }
    }
    vi.stubGlobal("AudioContext", ThrowingAudioContext);

    expect(() => playCoinSound()).not.toThrow();
  });

  it("never throws when a working stub's node methods throw mid-graph", () => {
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

    expect(() => playCoinSound()).not.toThrow();
  });

  it("wires oscillator + gain nodes, connects them, and calls start/stop when a working stub is supplied", () => {
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

  it("lazily creates ONE AudioContext and reuses it across calls (not re-created every call)", () => {
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

    playCoinSound();
    playCoinSound();

    expect(constructCount).toBe(1);
  });
});
