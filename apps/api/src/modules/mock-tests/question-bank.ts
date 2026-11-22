// Small, curated practice bank; this is not an adaptive or comprehensive assessment.
export interface PracticeQuestion {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}
export const questionBank: Record<"javascript" | "web", PracticeQuestion[]> = {
  javascript: [
    {
      prompt:
        "Which declaration creates a block-scoped variable that can be reassigned?",
      options: ["let", "const", "var", "static"],
      correct: 0,
      explanation:
        "let is block-scoped and allows reassignment; const does not.",
    },
    {
      prompt: "What does Array.prototype.map return?",
      options: [
        "The original array, always",
        "A new array of transformed values",
        "A single boolean",
        "A sorted array",
      ],
      correct: 1,
      explanation:
        "map creates a new array using the callback result for each element.",
    },
    {
      prompt: "Which operator compares both value and type without coercion?",
      options: ["==", "=", "===", "+="],
      correct: 2,
      explanation:
        "Strict equality (===) does not coerce operands before comparison.",
    },
    {
      prompt: "What does an async function return?",
      options: ["Always a string", "A Promise", "An iterator only", "Nothing"],
      correct: 1,
      explanation:
        "An async function returns a Promise that settles with its result or error.",
    },
    {
      prompt: "Which method converts a JSON string into a JavaScript value?",
      options: ["JSON.stringify", "JSON.parse", "Object.keys", "String.json"],
      correct: 1,
      explanation:
        "JSON.parse reads JSON text; JSON.stringify produces JSON text.",
    },
  ],
  web: [
    {
      prompt: "Which HTTP method is typically used to retrieve a resource?",
      options: ["GET", "DELETE", "PATCH", "POST"],
      correct: 0,
      explanation: "GET requests a representation of a resource.",
    },
    {
      prompt: "Which HTML element provides a label for a form control?",
      options: ["section", "label", "div", "span"],
      correct: 1,
      explanation: "A label associates descriptive text with a form control.",
    },
    {
      prompt: "What does an HTTP 404 response generally indicate?",
      options: ["Success", "Resource not found", "Server error", "Redirect"],
      correct: 1,
      explanation: "404 indicates the requested resource was not found.",
    },
    {
      prompt: "What is the main purpose of CSS?",
      options: [
        "Query a database",
        "Style the presentation of a document",
        "Encrypt network traffic",
        "Store cookies",
      ],
      correct: 1,
      explanation:
        "CSS controls document presentation, including layout and visual styling.",
    },
    {
      prompt: "Which attribute gives meaningful alternative text for an image?",
      options: ["href", "alt", "target", "lang"],
      correct: 1,
      explanation:
        "The alt attribute provides a text alternative for images when appropriate.",
    },
  ],
};
