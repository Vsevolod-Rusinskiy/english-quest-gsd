import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../../src/core/lesson/lessonSchema";
import { renderTheoryScreen } from "../../../src/ui/screens/TheoryScreen";

const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);

function splitSentencesForTest(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
  if (!matches) return [text.trim()].filter((s) => s.length > 0);
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

describe("TheoryScreen", () => {
  it("initial view renders the authored two-section split (Present Simple / Present Continuous) with each part's content and both buttons", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });

    const parts = lesson.theory.parts ?? [];
    expect(parts.length).toBeGreaterThan(0);

    const sections = Array.from(el.querySelectorAll(".theory-part"));
    expect(sections).toHaveLength(parts.length);

    const titles = Array.from(el.querySelectorAll(".theory-part-title")).map((h) => h.textContent);
    for (const part of parts) {
      expect(titles).toContain(part.titleRu);
      for (const sentence of splitSentencesForTest(part.textRu)) {
        expect(el.textContent).toContain(sentence);
      }
      expect(el.textContent).toContain(part.exampleRu);
    }

    const buttonTexts = Array.from(el.querySelectorAll("button")).map((b) => b.textContent);
    expect(buttonTexts).toContain("Понятно");
    expect(buttonTexts).toContain("Не понятно");
  });

  it("falls back to the flat rule/explanation layout when the lesson has no parts", () => {
    const onUnderstoodChoice = vi.fn();
    const { parts: _omit, ...theoryWithoutParts } = lesson.theory;
    const el = renderTheoryScreen({ theory: theoryWithoutParts, onUnderstoodChoice });

    for (const sentence of splitSentencesForTest(lesson.theory.rule)) {
      expect(el.textContent).toContain(sentence);
    }
    expect(el.textContent).toContain(lesson.theory.explanationLevels[0].exampleRu);
    expect(el.querySelectorAll(".theory-part")).toHaveLength(0);
  });

  it("renders a multi-sentence explanation as more than one <p>, with the full text recoverable from textContent", () => {
    const onUnderstoodChoice = vi.fn();
    const multiSentence = {
      textRu: "Первое предложение. Второе предложение! Третье предложение?",
      exampleRu: "I love pizza.",
    };
    const el = renderTheoryScreen({
      theory: lesson.theory,
      onUnderstoodChoice,
      currentExplanation: multiSentence,
    });

    const paragraphs = Array.from(el.querySelectorAll("p"));
    // theory.rule paragraph(s) + explanation sentence paragraphs + example paragraph
    const explanationParagraphs = paragraphs.filter(
      (p) => p.textContent && multiSentence.textRu.includes(p.textContent.trim()),
    );
    expect(explanationParagraphs.length).toBeGreaterThan(1);

    for (const sentence of splitSentencesForTest(multiSentence.textRu)) {
      expect(el.textContent).toContain(sentence);
    }
  });

  it("renders a single-sentence explanation as exactly one explanation <p>", () => {
    const onUnderstoodChoice = vi.fn();
    const singleSentence = {
      textRu: "Одно простое предложение без границ.",
      exampleRu: "I eat.",
    };
    const el = renderTheoryScreen({
      theory: lesson.theory,
      onUnderstoodChoice,
      currentExplanation: singleSentence,
    });

    const paragraphs = Array.from(el.querySelectorAll("p"));
    const explanationParagraphs = paragraphs.filter(
      (p) => p.textContent && p.textContent.trim() === singleSentence.textRu.trim(),
    );
    expect(explanationParagraphs.length).toBe(1);
  });

  it("clicking Понятно calls onUnderstoodChoice(true)", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });
    const understoodButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Понятно",
    );

    understoodButton?.click();

    expect(onUnderstoodChoice).toHaveBeenCalledWith(true);
  });

  it("clicking Не понятно calls onUnderstoodChoice(false)", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });
    const notUnderstoodButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Не понятно",
    );

    notUnderstoodButton?.click();

    expect(onUnderstoodChoice).toHaveBeenCalledWith(false);
  });

  it("both theory toggle buttons carry a shared .theory-toggle className, distinct from the CTA-only .accent marker", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });

    const toggles = Array.from(el.querySelectorAll(".theory-toggle"));
    expect(toggles).toHaveLength(2);

    for (const toggle of toggles) {
      expect(toggle.classList.contains("accent")).toBe(false);
    }
  });
});
