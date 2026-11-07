import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";

export const MODEL = "openai/gpt-oss-20b";
const MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];

function extractJSON(text: string): string | null {
  const cleaned = text.replace(/```json|```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

export async function askJSON<T>(system: string, prompt: string): Promise<T> {
  let lastErr = "";
  for (const m of MODELS) {
    try {
      const res = await generateText({
        model: groq(m),
        system: system + "\nReturn ONLY valid JSON. No markdown fences, no commentary.",
        prompt,
        maxOutputTokens: 8000,
        providerOptions: { groq: { reasoningEffort: "low" } },
      });
      const json = extractJSON(res.text);
      if (!json) {
        lastErr = `no JSON from ${m} (finish: ${res.finishReason})`;
        console.error("ASKJSON:", lastErr, "| text:", res.text.slice(0, 300));
        continue;
      }
      return JSON.parse(json) as T;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.error("ASKJSON error with", m, ":", lastErr);
    }
  }
  throw new Error("The AI did not return valid JSON (" + lastErr + "). Click again to retry.");
}