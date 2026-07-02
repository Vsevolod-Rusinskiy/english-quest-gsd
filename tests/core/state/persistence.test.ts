import { describe, it, expect, vi, beforeEach } from "vitest";
import { load, save, PROGRESS_KEY } from "../../../src/core/state/persistence";
import { initialState } from "../../../src/core/state/initialState";
import { StateStore } from "../../../src/core/state/store";
import type { ProgressState } from "../../../src/core/state/progressSchema";

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a ProgressState identically via save then load", () => {
    const state = initialState();
    state.currentPosition = { theoryUnderstood: true, currentExerciseIndex: 3, reviewPassIndex: 0 };
    save(state);
    const loaded = load();
    expect(loaded).toEqual(state);
  });

  it("returns initialState() when no key is stored", () => {
    const loaded = load();
    expect(loaded).toEqual(initialState());
  });

  it("returns initialState() (no throw) on corrupt/non-JSON stored value", () => {
    localStorage.setItem(PROGRESS_KEY, "{not valid json");
    expect(() => load()).not.toThrow();
    expect(load()).toEqual(initialState());
  });

  it("returns initialState() on valid JSON with the wrong shape", () => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ foo: "bar" }));
    expect(load()).toEqual(initialState());
  });

  it("returns initialState() when schemaVersion does not match", () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ schemaVersion: 999, data: initialState() }),
    );
    expect(load()).toEqual(initialState());
  });

  it("stores the blob under english-quest-progress-v1 as {schemaVersion, data}", () => {
    save(initialState());
    const raw = localStorage.getItem(PROGRESS_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.data).toBeTruthy();
  });

  it("reload: a ProgressState carrying currentPosition survives save then fresh load (PERSIST-02, D-04)", () => {
    const state: ProgressState = {
      ...initialState(),
      currentPosition: { theoryUnderstood: true, currentExerciseIndex: 5, reviewPassIndex: 0 },
    };
    save(state);
    const freshlyLoaded = load();
    expect(freshlyLoaded.currentPosition).toEqual({
      theoryUnderstood: true,
      currentExerciseIndex: 5,
      reviewPassIndex: 0,
    });
  });

  describe("StateStore", () => {
    it("dispatch triggers exactly one save() (localStorage.setItem call) per dispatch", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      const store = new StateStore(initialState());
      setItemSpy.mockClear();

      store.dispatch({ type: "theory_step", understood: true });
      expect(setItemSpy).toHaveBeenCalledTimes(1);

      store.dispatch({ type: "advance_position" });
      expect(setItemSpy).toHaveBeenCalledTimes(2);

      setItemSpy.mockRestore();
    });

    it("subscribe() notifies listeners after dispatch", () => {
      const store = new StateStore(initialState());
      const listener = vi.fn();
      store.subscribe(listener);

      store.dispatch({ type: "theory_step", understood: true });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(store.getState());
    });
  });
});
