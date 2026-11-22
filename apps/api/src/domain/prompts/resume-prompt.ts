// Centralized prompt for resume and job-description coaching.
import type { PromptBuilder } from "./prompt-builder.js";
/** Build bounded resume-analysis requests with explicit untrusted data boundaries. */
export class ResumePrompt {
  /** Inject the common prompt builder. */
  constructor(private readonly prompts: PromptBuilder) {}
  /** Compare qualifications with a job description without treating either as instructions. */
  build(resume: string, jobDescription: string) {
    return this.prompts.build({
      task: "Analyze a resume for interview preparation",
      rubric:
        "Give constructive, evidence-based career coaching. Do not infer protected traits. The match score is only an approximate text match, not an ATS prediction or hiring decision. If there is no job description, return null for matchScore and do not invent job requirements.",
      outputDescription:
        "JSON object with skills, strengths, gaps, suggestions as arrays of concise strings, summary as a string, and matchScore as an integer 0 to 100 or null.",
      context: { resume, jobDescription },
    });
  }
}
