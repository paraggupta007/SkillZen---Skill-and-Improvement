// Isolated PDF text extractor; invoked with restricted memory and a deadline by the API.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
try {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 4 * 1024 * 1024) throw new Error("Too large");
    chunks.push(chunk);
  }
  const data = new Uint8Array(Buffer.concat(chunks));
  const task = getDocument({
    data,
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    enableXfa: false,
    stopAtErrors: true,
  });
  const document = await task.promise;
  try {
    if (document.numPages > 10) throw new Error("Too many pages");
    let text = "";
    for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
      const page = await document.getPage(pageNo);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
        if (text.length > 20000) throw new Error("Too much text");
      }
      text += "\n";
      page.cleanup();
    }
    if (!text.trim()) throw new Error("No text");
    process.stdout.write(JSON.stringify({ text: text.trim() }));
  } finally {
    await document.destroy();
  }
} catch {
  process.exitCode = 1;
}
