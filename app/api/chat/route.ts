import { streamText, convertToModelMessages } from "ai";
import { groq } from "@ai-sdk/groq";

export async function POST(req: Request) {
  try {
    const { messages, grade, mode } = await req.json();

    const result = streamText({
         model: groq("openai/gpt-oss-20b"),
      system: `You are a friendly, patient tutor for a class ${grade} student.
Explain simply, with short examples suited to that age.
${
  mode === "socratic"
    ? "Do NOT give the answer directly. Ask one guiding question at a time to help the student reach it."
    : "Give a clear explanation, then ask if they want an example or a quiz."
}
Only discuss educational topics. If asked about anything unsafe or off-topic, politely steer back to studying.
Keep answers short and encouraging.`,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("STREAM ERROR:", error);
        return error instanceof Error ? error.message : String(error);
      },
    });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    return new Response(String(err), { status: 500 });
  }
}