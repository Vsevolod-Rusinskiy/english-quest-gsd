// D-06 fail-loudly error screen. createElement/textContent ONLY — never innerHTML
// (security Anti-Pattern, T-01-03). Copy per 01-UI-SPEC.md Copywriting Contract.
export function renderFatalError(root: HTMLElement, message: string): void {
  root.textContent = "";

  const container = document.createElement("div");
  container.className = "fatal-error";

  const heading = document.createElement("h1");
  heading.textContent = "Не удалось загрузить урок.";

  const body = document.createElement("p");
  body.textContent = message;

  const footer = document.createElement("p");
  footer.textContent = "Обновите страницу или обратитесь к разработчику.";

  container.appendChild(heading);
  container.appendChild(body);
  container.appendChild(footer);
  root.appendChild(container);
}
