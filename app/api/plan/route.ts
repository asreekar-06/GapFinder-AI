import { askJSON } from "@/lib/llm";

export const maxDuration = 60;

type Gap = { topic: string; score: number; level: "Weak" | "Medium" | "Strong"; importance: number };

export async function POST(req: Request) {
  try {
    const { gaps, hoursPerDay, days } = (await req.json()) as { gaps: Gap[]; hoursPerDay: number; days: number };
    const weight = { Weak: 3, Medium: 2, Strong: 0.5 };
    const ranked = gaps
      .map((g) => ({ ...g, priority: Math.round(g.importance * weight[g.level] * 10) / 10 }))
      .sort((a, b) => b.priority - a.priority);
    const perDay = Math.round(Number(hoursPerDay) * 60);
    const list = ranked
      .map((g) => `- ${g.topic}: ${g.level} (${g.score}% correct), importance ${g.importance}/5, priority ${g.priority}`)
      .join("\n");

    const data = await askJSON<{ plan: unknown; tips: string[] }>(
      "You are a study coach who builds realistic, prioritized revision plans.",
      `Topics ranked by priority (highest first):
${list}

Create a ${days}-day revision plan with ${perDay} minutes per day. Give the most time to the highest priority topics; Strong topics get only a short review. Each day has items with: topic (exact name from the list), minutes (integer; each day's minutes must add up to ${perDay}), activity (specific and short, e.g. "re-read section, then solve 5 practice questions"). Also give 3 short study tips.
Return exactly: {"plan":[{"day":1,"items":[{"topic":"","minutes":30,"activity":""}]}],"tips":[""]}`
    );
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}