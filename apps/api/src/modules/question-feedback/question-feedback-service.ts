import { AppError } from "../../core/errors.js";
export interface Feedback {
  questionId: string;
  rating: number;
  comment: string;
  updatedAt: Date;
}
export interface IQuestionFeedbackRepository {
  questionOwned(
    userId: string,
    interviewId: string,
    questionId: string,
  ): Promise<boolean>;
  get(questionId: string): Promise<Feedback | undefined>;
  save(questionId: string, rating: number, comment: string): Promise<Feedback>;
  delete(questionId: string): Promise<void>;
}
/** Separate candidate ratings from answer evaluation and AI prompts. */
export class QuestionFeedbackService {
  constructor(private readonly repository: IQuestionFeedbackRepository) {}
  private async authorize(
    userId: string,
    interviewId: string,
    questionId: string,
  ) {
    if (!(await this.repository.questionOwned(userId, interviewId, questionId)))
      throw new AppError(404, "NOT_FOUND", "Question not found");
  }
  async get(userId: string, interviewId: string, questionId: string) {
    await this.authorize(userId, interviewId, questionId);
    return { feedback: (await this.repository.get(questionId)) ?? null };
  }
  async save(
    userId: string,
    interviewId: string,
    questionId: string,
    rating: number,
    comment: string,
  ) {
    await this.authorize(userId, interviewId, questionId);
    return {
      feedback: await this.repository.save(questionId, rating, comment),
    };
  }
  async delete(userId: string, interviewId: string, questionId: string) {
    await this.authorize(userId, interviewId, questionId);
    await this.repository.delete(questionId);
  }
}
