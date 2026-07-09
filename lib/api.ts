import type { CodeGradeResult, CodeQuestionSummary, CodeRunResult } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${API_BASE_URL}. Is it running?`);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
      }
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function fetchQuestions(): Promise<CodeQuestionSummary[]> {
  return request<CodeQuestionSummary[]>("/api/code/questions");
}

export function runCode(input: {
  language: string;
  sourceCode: string;
  stdin: string;
}): Promise<CodeRunResult> {
  return request<CodeRunResult>("/api/code/run", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function gradeCode(input: {
  questionId: string;
  language: string;
  sourceCode: string;
}): Promise<CodeGradeResult> {
  return request<CodeGradeResult>("/api/code/grade", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
