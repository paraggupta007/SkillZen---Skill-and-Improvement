// Resume upload, privacy-aware storage and validated AI coaching.
import { z } from "zod";
import type { JsonGenerator } from "../../ai/json-generator.js";
import { AppError } from "../../core/errors.js";
import type { ResumePrompt } from "../../domain/prompts/resume-prompt.js";
import type { IResumeTextExtractor } from "./pdf-extractor.js";
import type { IResumeRepository, Resume } from "./resume-repository.js";
const list = z.array(z.string().trim().min(1).max(300)).max(12);
const analysisSchema = z.object({
  skills: list,
  strengths: list,
  gaps: list,
  suggestions: list,
  summary: z.string().trim().min(1).max(2000),
  matchScore: z.number().int().min(0).max(100).nullable(),
});
function metadata(resume: Resume) {
  return {
    id: resume.id,
    fileName: resume.fileName,
    parsedSkills: resume.parsedSkills,
    matchScore: resume.atsScore,
    createdAt: resume.createdAt,
  };
}
/** Coordinate resume extraction and analysis using injected interfaces. */
export class ResumeService {
  /** Inject scoped persistence, extractor and validated AI generation. */
  constructor(
    private readonly repository: IResumeRepository,
    private readonly extractor: IResumeTextExtractor,
    private readonly generator: Pick<JsonGenerator, "generate">,
    private readonly prompt: ResumePrompt,
  ) {}
  /** Extract and store text after validating the PDF signature. */
  async upload(userId: string, file: Buffer) {
    if (file.length < 100 || !file.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new AppError(
        400,
        "INVALID_PDF",
        "Please upload a valid text-based PDF.",
      );
    const text = await this.extractor.extract(file);
    const result = await this.repository.create(userId, {
      fileName: "resume.pdf",
      rawText: text,
    });
    return metadata(result);
  }
  /** List metadata only, never raw resume contents. */
  async list(userId: string) {
    return (await this.repository.list(userId)).map(metadata);
  }
  /** Delete owned resume text. */
  async delete(userId: string, id: string) {
    if (!(await this.repository.delete(userId, id)))
      throw new AppError(404, "NOT_FOUND", "Resume not found");
  }
  /** Return bounded, validated resume and optional job description insights. */
  async analyze(userId: string, id: string, jobDescription: string) {
    const resume = await this.repository.get(userId, id);
    if (!resume) throw new AppError(404, "NOT_FOUND", "Resume not found");
    const analysis = await this.generator.generate(
      this.prompt.build(resume.rawText, jobDescription),
      analysisSchema,
    );
    if (!jobDescription.trim()) analysis.matchScore = null;
    await this.repository.updateAnalysis(
      userId,
      id,
      analysis.skills,
      analysis.matchScore,
    );
    return analysis;
  }
}
