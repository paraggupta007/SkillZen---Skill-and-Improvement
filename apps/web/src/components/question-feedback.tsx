// Optional user opinion on a question, not the AI's evaluation of an answer.
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../services/api";
import { ErrorState, Loading } from "./ui";

type Feedback = {
  questionId: string;
  rating: number;
  comment: string;
  updatedAt: string;
};
type Result = { feedback: Feedback | null };
/** Load and manage a question's feedback only when its disclosure is opened. */
export function QuestionFeedback({
  interviewId,
  questionId,
  summary = "Rate this question",
}: {
  interviewId: string;
  questionId: string;
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const client = useQueryClient();
  const key = ["question-feedback", interviewId, questionId];
  const path = `/interviews/${interviewId}/questions/${questionId}/feedback`;
  const saved = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<Result>(path),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (saved.data) {
      setRating(saved.data.feedback?.rating ?? null);
      setComment(saved.data.feedback?.comment ?? "");
    }
  }, [saved.data]);
  const save = useMutation({
    mutationFn: () =>
      apiRequest<Result>(path, {
        method: "PUT",
        body: JSON.stringify({ rating, comment }),
      }),
    onSuccess: (result) => {
      client.setQueryData(key, result);
      remove.reset();
    },
  });
  const remove = useMutation({
    mutationFn: () => apiRequest(path, { method: "DELETE" }),
    onSuccess: () => {
      client.setQueryData(key, { feedback: null });
      save.reset();
    },
  });
  const busy = save.isPending || remove.isPending;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (rating !== null) save.mutate();
  }
  return (
    <details
      className="question-feedback"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {open && (
        <div className="question-feedback-body">
          <p>
            Your optional rating and comment are saved in your account. You can
            edit or delete them. They are not sent to the AI, used in your
            score, or automatically sent to the developer. Avoid sensitive
            information.
          </p>
          {saved.isLoading ? (
            <Loading label="Loading question feedback..." />
          ) : saved.isError ? (
            <ErrorState
              message={saved.error.message}
              retry={() => void saved.refetch()}
            />
          ) : (
            <form onSubmit={submit}>
              <fieldset className="question-rating" disabled={busy}>
                <legend>
                  How useful was this question? <span>(required)</span>
                </legend>
                <div>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name={`rating-${questionId}`}
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                      />{" "}
                      {value}
                    </label>
                  ))}
                </div>
                <small>1 = not useful · 5 = very useful</small>
              </fieldset>
              <label className="field-label">
                Comment (optional)
                <textarea
                  value={comment}
                  maxLength={1000}
                  rows={3}
                  disabled={busy}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="What worked or could be improved?"
                />
              </label>
              <div className="question-feedback-actions">
                <button
                  className="button button-dark button-small"
                  type="submit"
                  disabled={rating === null || busy}
                >
                  {save.isPending ? "Saving..." : "Save feedback"}
                </button>
                {saved.data?.feedback && (
                  <button
                    className="voice-button"
                    type="button"
                    disabled={busy}
                    onClick={() => remove.mutate()}
                  >
                    {remove.isPending ? "Deleting..." : "Delete feedback"}
                  </button>
                )}
              </div>
              {save.isSuccess && <p role="status">Question feedback saved.</p>}
              {remove.isSuccess && (
                <p role="status">Question feedback deleted.</p>
              )}
              {save.isError && <ErrorState message={save.error.message} />}
              {remove.isError && <ErrorState message={remove.error.message} />}
            </form>
          )}
        </div>
      )}
    </details>
  );
}
