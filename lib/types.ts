export type CodeDifficulty = "easy" | "medium" | "hard";

export type CodeExecutionStatus =
  | "Accepted"
  | "Wrong Answer"
  | "Compilation Error"
  | "Runtime Error"
  | "Time Limit Exceeded"
  | "Judge0 Unavailable";

export interface CodeExample {
  input: string;
  expectedOutput: string;
}

export interface CodeQuestionSummary {
  id: string;
  title: string;
  description: string;
  difficulty: CodeDifficulty;
  starterCode: string;
  language: string;
  sampleInput: string;
  sampleOutput: string;
  examples: CodeExample[];
}

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  compileOutput: string;
  status: CodeExecutionStatus;
  executionTime: number;
}

export interface CodeTestCaseResult {
  stdin: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  status: CodeExecutionStatus;
  executionTime: number;
}

export interface CodeGradeResult {
  questionId: string;
  passed: boolean;
  score: number;
  totalTestCases: number;
  passedTestCases: number;
  status: CodeExecutionStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  testResults: CodeTestCaseResult[];
}
