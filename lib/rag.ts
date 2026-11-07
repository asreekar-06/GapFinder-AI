export type Chunk = { id: number; text: string };

const STOP = new Set(["the","and","for","are","that","this","with","from","have","has","was","were","what","which","when","where","how","why","its","their","they","them","into","about","than","then","there","these","those","will","would","can","could","not","but","you","your"]);

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));
}

function slice(t: string, size: number): string[] {
  const out: string[] = [];
  let s = t;
  while (s.length > size * 1.5) {
    let cut = s.lastIndexOf(" ", size);
    if (cut < size / 2) cut = size;
    out.push(s.slice(0, cut));
    s = s.slice(cut).trim();
  }
  out.push(s);
  return out;
}

export function chunkText(text: string, size = 900): Chunk[] {
  const pieces = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => slice(p, size));
  const chunks: Chunk[] = [];
  let cur = "";
  for (const p of pieces) {
    if (cur && (cur + " " + p).length > size) {
      chunks.push({ id: chunks.length + 1, text: cur });
      cur = p;
    } else {
      cur = cur ? cur + " " + p : p;
    }
  }
  if (cur) chunks.push({ id: chunks.length + 1, text: cur });
  return chunks;
}

export function retrieve(query: string, chunks: Chunk[], k = 3): Chunk[] {
  const q = new Set(tokens(query));
  const sets = chunks.map((c) => new Set(tokens(c.text)));
  const df = new Map<string, number>();
  sets.forEach((s) => s.forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const N = chunks.length;
  return chunks
    .map((c, i) => {
      let score = 0;
      q.forEach((w) => {
        if (sets[i].has(w)) score += Math.log(1 + N / (df.get(w) ?? 1));
      });
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}