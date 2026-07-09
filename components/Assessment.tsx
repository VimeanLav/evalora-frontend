"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CodeEditor from "./CodeEditor";
import { fetchQuestions, gradeCode, runCode } from "@/lib/api";
import type { CodeGradeResult, CodeQuestionSummary, CodeRunResult } from "@/lib/types";

const CHALLENGE_DURATION_SECONDS = 45 * 60;

type Terminal = {
  kind: "idle" | "success" | "error" | "info";
  status: string;
  body: string;
};

const IDLE_TERMINAL: Terminal = {
  kind: "idle",
  status: "Ready",
  body: "Run your code to see output, or Submit to grade it against the hidden test cases.",
};

function difficultyRank(d: string): number {
  return d === "easy" ? 0 : d === "medium" ? 1 : 2;
}

export default function Assessment() {
  const [questions, setQuestions] = useState<CodeQuestionSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [codeById, setCodeById] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, CodeGradeResult>>({});
  const [terminal, setTerminal] = useState<Terminal>(IDLE_TERMINAL);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"coding" | "results">("coding");
  const [secondsLeft, setSecondsLeft] = useState(CHALLENGE_DURATION_SECONDS);

  const loadQuestions = useCallback(async () => {
    setLoadError(null);
    setQuestions(null);
    try {
      const data = await fetchQuestions();
      const ordered = [...data].sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty));
      setQuestions(ordered);
      setCodeById(Object.fromEntries(ordered.map((q) => [q.id, q.starterCode])));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load questions.");
    }
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  // Countdown timer -> when it hits zero, lock the assessment and show results.
  useEffect(() => {
    if (!questions || view === "results") return;
    if (secondsLeft <= 0) {
      setView("results");
      return;
    }
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [questions, view, secondsLeft]);

  const current = questions?.[index];
  const total = questions?.length ?? 0;
  const answeredCount = Object.keys(results).length;
  const allAnswered = total > 0 && answeredCount === total;

  const setCurrentCode = useCallback(
    (value: string) => {
      if (!current) return;
      setCodeById((prev) => ({ ...prev, [current.id]: value }));
    },
    [current],
  );

  const goToQuestion = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setTerminal(IDLE_TERMINAL);
  }, []);

  const handleRun = useCallback(async () => {
    if (!current) return;
    setRunning(true);
    setTerminal({ kind: "info", status: "Running…", body: "Executing with the sample input." });
    try {
      const result: CodeRunResult = await runCode({
        language: "javascript",
        sourceCode: codeById[current.id] ?? "",
        stdin: current.examples[0]?.input ?? current.sampleInput,
      });
      const output = result.stdout || result.stderr || result.compileOutput || "(no output)";
      setTerminal({
        kind: result.status === "Accepted" ? "success" : "error",
        status: result.status,
        body: output,
      });
    } catch (error) {
      setTerminal({
        kind: "error",
        status: "Run failed",
        body: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRunning(false);
    }
  }, [current, codeById]);

  const handleSubmit = useCallback(async () => {
    if (!current) return;
    setSubmitting(true);
    setTerminal({ kind: "info", status: "Submitting…", body: "Grading against hidden test cases." });
    try {
      const result = await gradeCode({
        questionId: current.id,
        language: "javascript",
        sourceCode: codeById[current.id] ?? "",
      });
      setResults((prev) => ({ ...prev, [current.id]: result }));
      setTerminal({
        kind: result.passed ? "success" : "error",
        status: result.passed ? "Correct ✓" : `${result.status}`,
        body: `Passed ${result.passedTestCases}/${result.totalTestCases} test cases · score ${result.score}%`,
      });

      // Auto-advance: move to the next question, or show results once every question is answered.
      const answeredNow = { ...results, [current.id]: result };
      if (questions && Object.keys(answeredNow).length === questions.length) {
        window.setTimeout(() => setView("results"), 600);
      } else if (questions && index < questions.length - 1) {
        window.setTimeout(() => goToQuestion(index + 1), 500);
      }
    } catch (error) {
      setTerminal({
        kind: "error",
        status: "Submit failed",
        body: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [current, codeById, results, questions, index, goToQuestion]);

  const resetCurrent = useCallback(() => {
    if (!current) return;
    setCodeById((prev) => ({ ...prev, [current.id]: current.starterCode }));
  }, [current]);

  if (loadError) {
    return (
      <main className="centered">
        <div className="card error-card">
          <h2>Could not load the assessment</h2>
          <p className="muted">{loadError}</p>
          <button className="btn primary" onClick={() => void loadQuestions()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!questions || !current) {
    return (
      <main className="centered">
        <div className="muted">Loading assessment…</div>
      </main>
    );
  }

  if (view === "results") {
    return (
      <ResultsView
        questions={questions}
        results={results}
        onReview={(i) => {
          setView("coding");
          goToQuestion(i);
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="shell">
        <QuestionNav
          questions={questions}
          results={results}
          activeIndex={index}
          onSelect={goToQuestion}
        />

        <main className="content">
          <header className="topbar">
            <div>
              <div className="small muted">Coding Assessment</div>
              <h1>
                {index + 1}. {current.title}
              </h1>
            </div>
            <div className="topbar-right">
              <span className={`chip diff-${current.difficulty}`}>{current.difficulty}</span>
              <Timer secondsLeft={secondsLeft} />
              <span className="chip">
                {answeredCount}/{total} answered
              </span>
            </div>
          </header>

          <div className="layout">
            <section className="prompt">
              <h3 className="section-heading">Introduction</h3>
              <p className="description">
                This is a short test of your coding skills. Here is how the coding interface works:
              </p>
              <ul className="intro-list">
                <li>Read the Problem Statement below and write your solution in the editor on the right.</li>
                <li>Your program reads its input from standard input and prints the answer.</li>
                <li>Click <strong>Run</strong> to try your code against the sample input.</li>
                <li>Click <strong>Submit</strong> to check your output against every test case and move on.</li>
              </ul>

              <h3 className="section-heading">Problem Statement</h3>
              <p className="description">{current.description}</p>

              <h3 className="section-heading">Test Cases</h3>
              <div className="test-table-wrap">
                <table className="test-table">
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Expected Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.examples.map((example, i) => (
                      <tr key={i}>
                        <td>
                          <pre>{example.input}</pre>
                        </td>
                        <td>
                          <pre>{example.expectedOutput.replace(/\n+$/, "")}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="editor-pane">
              <div className="editor-toolbar">
                <div className="small muted">javascript</div>
                <div className="btn-row">
                  <button className="btn ghost" onClick={resetCurrent} disabled={running || submitting}>
                    Reset
                  </button>
                  <button className="btn ghost" onClick={handleRun} disabled={running || submitting}>
                    {running ? "Running…" : "Run"}
                  </button>
                  <button className="btn primary" onClick={handleSubmit} disabled={running || submitting}>
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </div>

              <CodeEditor value={codeById[current.id] ?? ""} onChange={setCurrentCode} />

              <Terminal terminal={terminal} />
            </section>
          </div>

          <footer className="footer">
            <div className="progress">
              <div className="small muted">Progress</div>
              <div className="bar">
                <span style={{ width: `${(answeredCount / total) * 100}%` }} />
              </div>
            </div>
            <div className="btn-row">
              <button
                className="btn ghost"
                onClick={() => goToQuestion(Math.max(0, index - 1))}
                disabled={index === 0}
              >
                Previous
              </button>
              <button
                className="btn ghost"
                onClick={() => goToQuestion(Math.min(total - 1, index + 1))}
                disabled={index === total - 1}
              >
                Next
              </button>
              <button className="btn primary" onClick={() => setView("results")} disabled={answeredCount === 0}>
                {allAnswered ? "View Results" : "Finish & View Results"}
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Timer({ secondsLeft }: { secondsLeft: number }) {
  const mm = String(Math.floor(Math.max(0, secondsLeft) / 60)).padStart(2, "0");
  const ss = String(Math.max(0, secondsLeft) % 60).padStart(2, "0");
  const danger = secondsLeft <= 60;
  return (
    <span className={`chip ${danger ? "chip-danger" : ""}`}>
      {mm}:{ss}
    </span>
  );
}

function Terminal({ terminal }: { terminal: Terminal }) {
  return (
    <div className="terminal">
      <div className="terminal-head">
        <div className="dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className={`terminal-status status-${terminal.kind}`}>{terminal.status}</span>
      </div>
      <pre className={`terminal-body body-${terminal.kind}`}>{terminal.body}</pre>
    </div>
  );
}

function QuestionNav({
  questions,
  results,
  activeIndex,
  onSelect,
}: {
  questions: CodeQuestionSummary[];
  results: Record<string, CodeGradeResult>;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h2>Evalora</h2>
        <p className="muted small">Coding Assessment · {questions.length} challenges</p>
      </div>
      <nav className="nav">
        {questions.map((q, i) => {
          const result = results[q.id];
          const state = result ? (result.passed ? "pass" : "fail") : "pending";
          return (
            <button
              key={q.id}
              className={`nav-item ${i === activeIndex ? "active" : ""}`}
              onClick={() => onSelect(i)}
            >
              <span className={`status-icon ${state}`}>
                {state === "pass" ? "✓" : state === "fail" ? "✕" : i + 1}
              </span>
              <span className="nav-title">{q.title}</span>
              <span className={`mini-chip diff-${q.difficulty}`}>{q.difficulty[0].toUpperCase()}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function ResultsView({
  questions,
  results,
  onReview,
}: {
  questions: CodeQuestionSummary[];
  results: Record<string, CodeGradeResult>;
  onReview: (index: number) => void;
}) {
  const summary = useMemo(() => {
    const graded = questions.map((q) => results[q.id]).filter(Boolean) as CodeGradeResult[];
    const correct = graded.filter((r) => r.passed).length;
    const avg = graded.length ? Math.round(graded.reduce((s, r) => s + r.score, 0) / graded.length) : 0;
    return { correct, attempted: graded.length, avg, total: questions.length };
  }, [questions, results]);

  return (
    <main className="page results">
      <div className="results-card">
        <header className="results-header">
          <div>
            <h1>Submission Result</h1>
            <p className="muted">Each challenge graded against its hidden test cases.</p>
          </div>
          <div className="score-tiles">
            <div className="tile">
              <strong>
                {summary.correct}/{summary.total}
              </strong>
              <span className="muted small">Correct</span>
            </div>
            <div className="tile">
              <strong>{summary.avg}%</strong>
              <span className="muted small">Avg score</span>
            </div>
            <div className="tile">
              <strong>{summary.attempted}</strong>
              <span className="muted small">Attempted</span>
            </div>
          </div>
        </header>

        <div className="result-list">
          {questions.map((q, i) => {
            const r = results[q.id];
            const state = !r ? "skipped" : r.passed ? "pass" : "fail";
            return (
              <div key={q.id} className={`result-row ${state}`}>
                <span className={`status-icon ${state === "pass" ? "pass" : state === "fail" ? "fail" : "pending"}`}>
                  {state === "pass" ? "✓" : state === "fail" ? "✕" : "–"}
                </span>
                <div className="result-main">
                  <div className="result-title">
                    {i + 1}. {q.title} <span className={`mini-chip diff-${q.difficulty}`}>{q.difficulty}</span>
                  </div>
                  <div className="small muted">
                    {r
                      ? `${r.passed ? "Correct" : r.status} · passed ${r.passedTestCases}/${r.totalTestCases} · score ${r.score}%`
                      : "Not attempted"}
                  </div>
                  {r ? (
                    <div className="test-dots">
                      {r.testResults.map((t, ti) => (
                        <span key={ti} className={`dot ${t.passed ? "ok" : "bad"}`} title={t.status} />
                      ))}
                    </div>
                  ) : null}
                </div>
                <button className="btn ghost small-btn" onClick={() => onReview(i)}>
                  Review
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
