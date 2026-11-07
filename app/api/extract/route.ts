import { extractText, getDocumentProxy } from "unpdf";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    let out = "";
    for (const f of files) {
      if (f.name.toLowerCase().endsWith(".pdf")) {
        const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()));
        const { text } = await extractText(pdf, { mergePages: true });
        out += "\n\n" + text;
      } else {
        out += "\n\n" + (await f.text());
      }
    }
    return Response.json({ text: out.trim() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not read file" }, { status: 500 });
  }
}