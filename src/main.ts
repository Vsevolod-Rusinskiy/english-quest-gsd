// Boot entrypoint — wired fully in Task 5.
// A minimal typed stub exists here so `tsc --noEmit` passes during Wave 0 (Task 1);
// the e2e skeleton test imports mountApp() and is expected to fail at RUNTIME (RED)
// until Task 5 implements the real boot sequence.

export async function mountApp(_root: HTMLElement): Promise<void> {
  throw new Error("mountApp not yet implemented (wired in Task 5)");
}

const appRoot = document.querySelector<HTMLElement>("#app");
if (appRoot) {
  void mountApp(appRoot);
}
