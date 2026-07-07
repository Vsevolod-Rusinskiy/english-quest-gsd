// Synthesized coin-clink sound on ruble award (UX-COIN-01). NOT an external
// audio asset — synthesized via the Web Audio API so the project stays
// asset-free / no-backend (see CONTEXT.md #1). Degrades silently: if
// AudioContext is unavailable (jsdom, older browsers) or blocked by the
// autoplay policy / any node-graph error, playCoinSound() is a no-op and
// NEVER throws (T-krq-01) — a lesson must never break because a sound
// effect couldn't play.
//
// A single AudioContext is created lazily on first successful call and
// reused across subsequent calls (module-scoped), rather than constructing
// a fresh context per call.
let ctx: AudioContext | null = null;

function resolveAudioContextCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function playNote(
  audioCtx: AudioContext,
  frequency: number,
  startOffsetSeconds: number,
  durationSeconds: number,
): void {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startOffsetSeconds);

  const startTime = audioCtx.currentTime + startOffsetSeconds;
  const endTime = startTime + durationSeconds;

  // Gentle attack/decay envelope (no hard on/off) to avoid audible clicks.
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(startTime);
  oscillator.stop(endTime);
}

/**
 * Plays a short, non-annoying two-note "cling" (bell-like, high notes) when
 * rubles are awarded. Fire-and-forget, synchronous, never throws.
 */
export function playCoinSound(): void {
  try {
    if (!ctx) {
      const AudioContextCtor = resolveAudioContextCtor();
      if (!AudioContextCtor) return;
      ctx = new AudioContextCtor();
    }

    if (ctx.state === "suspended") {
      // Best-effort resume; ignore rejection (still inside the outer try).
      ctx.resume().catch(() => {});
    }

    // Two short high, bell-like notes: B5 (~988 Hz) then E6 (~1319 Hz), the
    // second starting ~70ms after the first, each ~100ms long.
    playNote(ctx, 988, 0, 0.1);
    playNote(ctx, 1319, 0.07, 0.12);
  } catch {
    // Silent no-op — AudioContext unavailable, autoplay-blocked, or any
    // node-graph error must never break the lesson flow.
  }
}
