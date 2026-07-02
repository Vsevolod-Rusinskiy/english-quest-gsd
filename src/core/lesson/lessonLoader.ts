// fetch + Zod safeParse + fail-loudly loader (D-06).
import * as z from "zod";
import { LessonSchema, type Lesson } from "./lessonSchema";
import { renderFatalError } from "../../ui/components/FatalError";

export async function loadLesson(
  root: HTMLElement,
  url: string = "/Lesson-1A.json",
): Promise<Lesson> {
  let rawJson: unknown;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fetch ${url} failed with status ${response.status}`);
    }
    rawJson = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    renderFatalError(root, `Не удалось загрузить файл урока: ${message}`);
    throw new Error("Lesson validation failed at boot");
  }

  const result = LessonSchema.safeParse(rawJson);
  if (!result.success) {
    const readable = z.prettifyError(result.error);
    renderFatalError(root, readable);
    throw new Error("Lesson validation failed at boot"); // fail loudly, D-06
  }

  return result.data;
}
