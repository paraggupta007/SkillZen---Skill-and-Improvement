# Candidate feedback on interview questions

## Goal

Allow a user to rate the usefulness of each interview question and optionally leave a comment. This is the candidate's opinion of the question, not the AI's evaluation of their answer; it does not affect scores.

## Implementation

- `apps/api/src/modules/question-feedback/`: owner and question/interview relationship checks, storage contract, service and authenticated routes.
- `apps/api/src/db/schema.ts` and migration `0006_peaceful_shinobi_shaw.sql`: one editable feedback record per interview question with cascading deletion.
- `apps/web/src/components/question-feedback.tsx`, `pages/interview.tsx`, `pages/report.tsx`: optional feedback during an interview and from a report, including reports that are still generating. Users can edit and delete their feedback.
- `apps/api/tests/question-feedback.test.ts`, `apps/web/tests/question-feedback.test.tsx` and `report-feedback.test.tsx`: isolated database and mocked UI coverage.

Ratings are 1–5; comments are optional and limited to 1,000 characters. Feedback is stored in the application database until deleted or its question is removed. It is not sent to the AI, used for scoring, or included in the PDF. The API exposes it only to the owning user; database administrators still have database access. There is no administrator dashboard, notification, aggregation or feedback mechanism for mock-test options. Users should avoid sensitive information in comments.

## Run and verify

Pull the branch, run `npm install`, `npm run db:migrate`, and `npm run dev`. Open an interview and use **Rate this question**, then save, edit and delete feedback. Complete an interview and use **Feedback on the questions** on its report to revisit feedback. Run `npm run lint`, `npm run type-check`, `npm test` and `npm run build`. Migration 0006 has been tested with PGlite but not yet confirmed on Neon. The live browser and deployed workflow remain unverified.
