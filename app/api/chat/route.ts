import { streamText, convertToModelMessages } from "ai";
import { groq } from "@ai-sdk/groq";
import { chunkText, retrieve, type Chunk } from "@/lib/rag";
import { MODEL } from "@/lib/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, materials, weak = [] } = await req.json();
    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    const question = (lastUser?.parts ?? [])
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join(" ");

    const all = chunkText(String(materials ?? ""));
    let hits: Chunk[] = retrieve(question, all, 4);

    // Broad question (e.g. "what is this chapter about"): add chunks spread across the document
    if (hits.length < 2 && all.length > 0) {
      const step = Math.max(1, Math.floor(all.length / 4));
      const spread = [0, 1, 2, 3].map((i) => all[Math.min(i * step, all.length - 1)]);
      const seen = new Set(hits.map((h) => h.id));
      for (const c of spread) {
        if (c && !seen.has(c.id)) {
          hits.push(c);
          seen.add(c.id);
        }
      }
      hits = hits.slice(0, 5);
    }

    const excerpts = hits.length
      ? hits.map((h) => `[Chunk ${h.id}] ${h.text}`).join("\n\n")
      : "(no material uploaded)";

    const result = streamText({
      model: groq(MODEL),
      system: `You are GapFinder's study assistant. Answer ONLY using the excerpts below from the student's uploaded materials. Cite the chunks you used like [Chunk 3]. If asked what the material or chapter is about, summarize the main ideas from the excerpts. If a specific answer is not in the excerpts, say you could not find it in the uploaded materials and do not guess.
Keep answers short and clear.${weak.length ? ` The student is weak in: ${weak.join(", ")}. If relevant, point out the link and suggest what to study next.` : ""}

EXCERPTS:
${excerpts}`,
      messages: await convertToModelMessages(messages),
    });
    return result.toUIMessageStreamResponse({
      onError: (e) => (e instanceof Error ? e.message : String(e)),
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}