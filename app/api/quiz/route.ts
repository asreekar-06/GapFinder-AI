import { chunkText, retrieve } from "@/lib/rag";
import { askJSON } from "@/lib/llm";

export const maxDuration = 60;

type Topic = { name: string; importance: number; subtopics: string[] };
type RawQ = { topic: string; question: string; options: string[]; answerIndex: number; explanation: string; chunkId: number };

export async function POST(req: Request) {
  try {
    const { materials, topics, previous = [] } = (await req.json()) as {
      materials: string;
      topics: Topic[];
      previous: string[];
    };
    const chunks = chunkText(String(materials ?? ""));
    const chosen = [...topics].sort((a, b) => b.importance - a.importance).slice(0, 6);

    const ctx = chosen
      .map((t) => {
        const hits = retrieve(`${t.name} ${t.subtopics.join(" ")}`, chunks, 2);
        return `### TOPIC: ${t.name}\n` + hits.map((h) => `[Chunk ${h.id}] ${h.text}`).join("\n");
      })
      .join("\n\n");

    const avoid = previous.length ? `\nDo NOT repeat these earlier questions:\n- ${previous.slice(0, 20).join("\n- ")}` : "";

    const data = await askJSON<{ questions: RawQ[] }>(
      "You write fair, clear diagnostic quiz questions for students, grounded strictly in the given excerpts.",
      `${ctx}

For each topic, write exactly 2 multiple-choice questions based ONLY on that topic's excerpts. Skip a topic that has no excerpts. Each has 4 options and one correct answer (answerIndex 0-3). explanation: 1-2 sentences on why the correct answer is right and the common mistake. chunkId: the chunk number the question comes from. "topic" must match the topic name exactly.${avoid}
Return exactly: {"questions":[{"topic":"","question":"","options":["","","",""],"answerIndex":0,"explanation":"","chunkId":1}]}`
    );

    const names = new Set(chosen.map((t) => t.name));
    const questions = (data.questions ?? [])
      .filter((q) => names.has(q.topic) && Array.isArray(q.options) && q.options.length === 4)
      .map((q) => {
        const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        const chunk = chunks.find((c) => c.id === Number(q.chunkId));
        return {
          topic: q.topic,
          question: String(q.question),
          options: order.map((i) => String(q.options[i])),
          answerIndex: order.indexOf(Number(q.answerIndex)),
          explanation: String(q.explanation ?? ""),
          source: chunk ? { chunkId: chunk.id, excerpt: chunk.text.slice(0, 260) } : null,
        };
      });
    if (!questions.length) throw new Error("Could not generate questions. Try again.");
    return Response.json({ questions });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}