// Practice tests: setup, history, taking a test and reviewing explanations.
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../services/api";
import { ErrorState, Eyebrow, formatDate, Loading } from "../components/ui";

type Summary = {
  id: string;
  topic: string;
  total: number;
  score: number | null;
  createdAt: string;
  completedAt: string | null;
};
type Test = Summary & {
  questions: {
    prompt: string;
    options: string[];
    selected?: number | null;
    correct?: number;
    explanation?: string;
  }[];
};
const topicName = (topic: string) =>
  topic === "javascript" ? "JavaScript basics" : "Web fundamentals";
/** Select a topic and open past attempts. */
export function MockTestsPage() {
  const [topic, setTopic] = useState("javascript");
  const [count, setCount] = useState(5);
  const navigate = useNavigate();
  const client = useQueryClient();
  const history = useQuery({
    queryKey: ["mock-tests"],
    queryFn: () => apiRequest<Summary[]>("/mock-tests"),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest<Test>("/mock-tests", {
        method: "POST",
        body: JSON.stringify({ topic, count }),
      }),
    onSuccess: (test) => {
      void client.invalidateQueries({ queryKey: ["mock-tests"] });
      navigate(`/app/mock-tests/${test.id}`);
    },
  });
  return (
    <div className="page narrow-page">
      <div className="setup-header">
        <Eyebrow>BUILD YOUR SKILLS</Eyebrow>
        <h1>
          Mock tests<span className="heading-dot">.</span>
        </h1>
        <p>
          Short multiple-choice practice with explanations. Questions come from
          a small fixed bank, not AI.
        </p>
      </div>
      <form
        className="form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="form-section-heading">
          <span>01</span>
          <div>
            <h2>Set up a test</h2>
            <p>
              Choose a topic and length. Repeated attempts can include the same
              questions.
            </p>
          </div>
        </div>
        <label className="field-label">
          Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="javascript">JavaScript basics</option>
            <option value="web">Web fundamentals</option>
          </select>
        </label>
        <label className="field-label">
          Number of questions
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            <option value={3}>3 questions</option>
            <option value={5}>5 questions</option>
          </select>
        </label>
        {create.isError && <ErrorState message={create.error.message} />}
        <button
          className="button button-dark button-small"
          disabled={create.isPending}
        >
          {create.isPending ? "Creating..." : "Start test"}
        </button>
      </form>
      <section className="form-panel resume-section">
        <div className="form-section-heading">
          <span>02</span>
          <div>
            <h2>Your attempts</h2>
            <p>Open a test to continue or review its result.</p>
          </div>
        </div>
        {history.isLoading && <Loading />}
        {history.isError && (
          <ErrorState
            message={history.error.message}
            retry={() => void history.refetch()}
          />
        )}
        {history.data?.length === 0 && <p>No attempts yet.</p>}
        {history.data?.map((test) => (
          <p key={test.id}>
            <Link className="text-link" to={`/app/mock-tests/${test.id}`}>
              {topicName(test.topic)} —{" "}
              {test.completedAt
                ? `${test.score}/${test.total} correct`
                : "In progress"}
            </Link>{" "}
            · {formatDate(test.createdAt)}
          </p>
        ))}
      </section>
    </div>
  );
}
/** The route key resets unsaved answers when navigating between attempts. */
export function MockTestPage() {
  const { id = "" } = useParams();
  return <Attempt key={id} id={id} />;
}
function Attempt({ id }: { id: string }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const navigate = useNavigate();
  const client = useQueryClient();
  const test = useQuery({
    queryKey: ["mock-test", id],
    queryFn: () => apiRequest<Test>(`/mock-tests/${id}`),
  });
  const submit = useMutation({
    mutationFn: () =>
      apiRequest<Test>(`/mock-tests/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: test.data!.questions.map((_, i) => answers[i] ?? null),
        }),
      }),
    onSuccess: (data) => {
      client.setQueryData(["mock-test", id], data);
      void client.invalidateQueries({ queryKey: ["mock-tests"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => apiRequest(`/mock-tests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      client.removeQueries({ queryKey: ["mock-test", id] });
      void client.invalidateQueries({ queryKey: ["mock-tests"] });
      navigate("/app/mock-tests");
    },
  });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate();
  }
  if (test.isLoading) return <Loading />;
  if (test.isError || !test.data)
    return (
      <ErrorState
        message={test.error?.message ?? "Test not found"}
        retry={() => void test.refetch()}
      />
    );
  const data = test.data;
  return (
    <div className="page narrow-page">
      <Link className="back-link" to="/app/mock-tests">
        ← Back to mock tests
      </Link>
      <div className="setup-header">
        <Eyebrow>PRACTICE, THEN REFLECT</Eyebrow>
        <h1>
          {topicName(data.topic)}
          <span className="heading-dot">.</span>
        </h1>
        <p>
          {data.completedAt
            ? `Your score: ${data.score} of ${data.total} correct. Review the explanations below.`
            : "Choose an answer for each question, or leave it blank. Answers are only saved when you submit; leaving this page discards your selections."}
        </p>
      </div>
      <form onSubmit={onSubmit}>
        {data.questions.map((q, i) => (
          <fieldset
            className="form-panel mock-question"
            key={i}
            disabled={!!data.completedAt || submit.isPending}
          >
            <legend>Question {i + 1}</legend>
            <h2>{q.prompt}</h2>
            {q.options.map((option, n) => (
              <label className="mock-option" key={n}>
                <input
                  type="radio"
                  name={`question-${i}`}
                  checked={
                    data.completedAt ? q.selected === n : answers[i] === n
                  }
                  onChange={() =>
                    setAnswers((previous) => ({ ...previous, [i]: n }))
                  }
                />{" "}
                {option}
              </label>
            ))}
            {data.completedAt && (
              <div className="mock-explanation">
                <strong>
                  {q.selected === q.correct
                    ? "Correct"
                    : q.selected === null
                      ? "Unanswered"
                      : "Not quite"}
                </strong>
                <p>Correct answer: {q.options[q.correct!]}</p>
                <p>{q.explanation}</p>
              </div>
            )}
          </fieldset>
        ))}
        {submit.isError && (
          <ErrorState
            message={submit.error.message}
            retry={() => void test.refetch()}
          />
        )}
        {!data.completedAt && (
          <button className="button button-dark" disabled={submit.isPending}>
            {submit.isPending ? "Submitting..." : "Submit test"}
          </button>
        )}
      </form>
      <div className="mock-delete">
        {remove.isError && <ErrorState message={remove.error.message} />}
        <button
          type="button"
          className="text-link"
          disabled={remove.isPending || submit.isPending}
          onClick={() => {
            if (window.confirm("Delete this test and its result?"))
              remove.mutate();
          }}
        >
          Delete this attempt
        </button>
      </div>
    </div>
  );
}
