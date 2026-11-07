import { chunkText } from "@/lib/rag";
import { askJSON } from "@/lib/llm";

export const maxDuration = 60;

type Topic = { name: string; importance: number; subtopics: string[]; pastQuestions: string[] };

export async function POST(req: Request) {
  try {
    const { materials, papers } = await req.json();
    const chunks = chunkText(String(materials ?? ""));
    if (!chunks.length) return Response.json({ error: "No study material found" }, { status: 400 });
    const ctx = chunks.map((c) => `[${c.id}] ${c.text}`).join("\n").slice(0, 14000);
    const pq = String(papers ?? "").slice(0, 5000) || "(none uploaded)";

    const data = await askJSON<{ topics: Topic[] }>(
      "You are an expert curriculum analyst helping students revise.",
      `STUDY MATERIAL (numbered chunks):
${ctx}

PAST EXAM QUESTIONS:
${pq}

Task: organize the material into 4-8 main topics, each with 2-5 subtopics. Map each past exam question to the topic it belongs to (short version of the question, empty list if none). importance is 1-5: higher when many past questions cover the topic or it is central to the syllabus.
Return exactly: {"topics":[{"name":"","importance":3,"subtopics":[""],"pastQuestions":[""]}]}`
    );

    const topics = (data.topics ?? []).slice(0, 8).map((t) => ({
      name: String(t.name),
      importance: Math.min(5, Math.max(1, Number(t.importance) || 3)),
      subtopics: Array.isArray(t.subtopics) ? t.subtopics.map(String) : [],
      pastQuestions: Array.isArray(t.pastQuestions) ? t.pastQuestions.map(String) : [],
    }));
    if (!topics.length) throw new Error("Could not build a topic map");
    return Response.json({ topics });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}