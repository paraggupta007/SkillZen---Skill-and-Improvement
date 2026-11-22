// Resource-bounded subprocess adapter for untrusted resume PDFs.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AppError } from "../../core/errors.js";
/** Extract text from an in-memory PDF. */
export interface IResumeTextExtractor {
  extract(pdf: Buffer): Promise<string>;
}
/** Limit extraction concurrency and terminate malformed or expensive PDFs. */
export class PdfResumeTextExtractor implements IResumeTextExtractor {
  private active = 0;
  /** Parse at most ten pages in a memory-limited child process. */
  async extract(pdf: Buffer): Promise<string> {
    if (this.active >= 2)
      throw new AppError(
        503,
        "EXTRACTOR_BUSY",
        "Resume processing is busy. Please try again.",
      );
    this.active++;
    try {
      return await new Promise<string>((resolve, reject) => {
        const script = fileURLToPath(
          new URL("../../../scripts/extract-resume-pdf.mjs", import.meta.url),
        );
        const child = spawn(
          process.execPath,
          ["--max-old-space-size=128", script],
          {
            stdio: ["pipe", "pipe", "ignore"],
            env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
          },
        );
        let output = "";
        let settled = false;
        const finish = (text?: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (text) resolve(text);
          else
            reject(
              new AppError(
                400,
                "INVALID_PDF",
                "Could not extract text. Use a text-based PDF of at most 10 pages.",
              ),
            );
        };
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          finish();
        }, 15000);
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          output += chunk;
          if (output.length > 100000) {
            child.kill("SIGKILL");
            finish();
          }
        });
        child.on("error", () => finish());
        child.stdin.on("error", () => undefined);
        child.on("close", (code) => {
          if (code !== 0) return finish();
          try {
            const data: unknown = JSON.parse(output);
            if (
              typeof data === "object" &&
              data !== null &&
              "text" in data &&
              typeof data.text === "string" &&
              data.text.length <= 20000
            )
              return finish(data.text);
          } catch {
            /* Reject malformed child output. */
          }
          finish();
        });
        child.stdin.end(pdf);
      });
    } finally {
      this.active--;
    }
  }
}
