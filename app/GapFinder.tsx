"use client";
import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

type Topic = { name: string; importance: number; subtopics: string[]; pastQuestions: string[] };
type Q = {
  topic: string; question: string; options: string[]; answerIndex: number; explanation: string;
  source: { chunkId: number; excerpt: string } | null;
};
type Level = "Weak" | "Medium" | "Strong";
type Attempt = { date: string; overall: number; scores: Record<string, number> };
type Gap = { topic: string; score: number; level: Level; importance: number };
type Plan = { plan: { day: number; items: { topic: string; minutes: number; activity: string }[] }[]; tips: string[] };
type Tab = "upload" | "topics" | "quiz" | "gaps" | "progress" | "assistant";

const levelOf = (s: number): Level => (s < 50 ? "Weak" : s < 80 ? "Medium" : "Strong");

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

function Assistant({ materials, weak }: { materials: string; weak: string[] }) {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const send = () => {
    if (!input.trim() || busy) return;
    sendMessage({ text: input }, { body: { materials, weak } });
    setInput("");
  };
  return (
    <div className="card">
      <h3>Study assistant</h3>
      <p className="muted">Answers only from your uploaded materials, with chunk citations.</p>
      <div className="assist">
        {messages.map((m) => (
          <div key={m.id} className={`row ${m.role === "user" ? "user" : "bot"}`}>
            <div className="bubble">
              {m.parts.map((p, i) => (p.type === "text" ? <ReactMarkdown key={i}>{p.text}</ReactMarkdown> : null))}
            </div>
          </div>
        ))}
        {error && <div className="error">{error.message}</div>}
      </div>
      <div className="composer">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about your material..." />
        <button className="btn send" disabled={busy || !input.trim()} onClick={send}>Ask</button>
      </div>
    </div>
  );
}

export default function GapFinder() {
  const [tab, setTab] = useState<Tab>("upload");
  const [materials, setMaterials] = useState("");
  const [papers, setPapers] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quiz, setQuiz] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [hours, setHours] = useState(2);
  const [days, setDays] = useState(5);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gapfinder");
      if (raw) {
        const d = JSON.parse(raw);
        setMaterials(d.materials || ""); setPapers(d.papers || ""); setTopics(d.topics || []);
        setHistory(d.history || []); setName(d.name || ""); setPlan(d.plan || null);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("gapfinder", JSON.stringify({ materials, papers, topics, history, name, plan }));
    } catch {}
  }, [ready, materials, papers, topics, history, name, plan]);

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const gaps: Gap[] = latest
    ? Object.entries(latest.scores).map(([topic, score]) => ({
        topic, score, level: levelOf(score), importance: topics.find((t) => t.name === topic)?.importance ?? 3,
      }))
    : [];
  const weak = gaps.filter((g) => g.level !== "Strong").map((g) => g.topic);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setLoading(label);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return undefined;
    } finally {
      setLoading("");
    }
  }

  async function upload(files: FileList | null, set: (t: string) => void) {
    if (!files || !files.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    await run("Reading files...", async () => {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read files");
      set(data.text);
    });
  }

  async function buildMap() {
    const d = await run("Building topic map...", () => post<{ topics: Topic[] }>("/api/topics", { materials, papers }));
    if (d) { setTopics(d.topics); setTab("topics"); }
  }

  async function makeQuiz() {
    const d = await run("Generating diagnostic quiz...", () =>
      post<{ questions: Q[] }>("/api/quiz", { materials, topics, previous: quiz.map((q) => q.question) })
    );
    if (d) { setQuiz(d.questions); setAnswers({}); setSubmitted(false); setTab("quiz"); }
  }

  async function refreshPlan(g: Gap[]) {
    const d = await run("Updating revision plan...", () => post<Plan>("/api/plan", { gaps: g, hoursPerDay: hours, days }));
    if (d) setPlan(d);
  }

  async function submitQuiz() {
    const byTopic: Record<string, { right: number; total: number }> = {};
    quiz.forEach((q, i) => {
      byTopic[q.topic] ??= { right: 0, total: 0 };
      byTopic[q.topic].total++;
      if (answers[i] === q.answerIndex) byTopic[q.topic].right++;
    });
    const scores: Record<string, number> = {};
    Object.entries(byTopic).forEach(([t, v]) => (scores[t] = Math.round((v.right / v.total) * 100)));
    const overall = Math.round((quiz.filter((q, i) => answers[i] === q.answerIndex).length / quiz.length) * 100);
    setSubmitted(true);
    setHistory((h) => [...h, { date: new Date().toLocaleString(), overall, scores }]);
    setTab("gaps");
    await refreshPlan(
      Object.entries(scores).map(([topic, score]) => ({
        topic, score, level: levelOf(score), importance: topics.find((t) => t.name === topic)?.importance ?? 3,
      }))
    );
  }

  const tabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: "upload", label: "1 Upload", enabled: true },
    { id: "topics", label: "2 Topic map", enabled: topics.length > 0 },
    { id: "quiz", label: "3 Quiz", enabled: quiz.length > 0 },
    { id: "gaps", label: "4 Gaps & plan", enabled: history.length > 0 },
    { id: "progress", label: "5 Progress", enabled: history.length > 0 },
    { id: "assistant", label: "6 Assistant", enabled: materials.trim().length > 0 },
  ];

  return (
    <div className="gf">
      <div className="header">
        <div className="brand">
          <div className="logo">🎯</div>
          <div>
            <h1>GapFinder AI</h1>
            <p>Find what you don&apos;t know. Fix it faster.</p>
          </div>
        </div>
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} disabled={!t.enabled} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="info">⏳ {loading}</div>}
      {error && <div className="error">⚠️ {error}</div>}

      {tab === "upload" && (
        <div className="card">
          <h3>Upload study materials</h3>
          <p className="muted">Syllabus, notes or textbook chapters (PDF or text, under 4 MB). Or paste text.</p>
          <input type="file" multiple accept=".pdf,.txt,.md" onChange={(e) => upload(e.target.files, setMaterials)} />
          <textarea rows={6} value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="...or paste your notes here" />
          <p className="muted">{materials.length.toLocaleString()} characters loaded</p>
          <h3>Previous question papers (optional)</h3>
          <input type="file" multiple accept=".pdf,.txt,.md" onChange={(e) => upload(e.target.files, setPapers)} />
          <textarea rows={4} value={papers} onChange={(e) => setPapers(e.target.value)} placeholder="...or paste past exam questions here" />
          <button className="btn send big" disabled={!materials.trim() || !!loading} onClick={buildMap}>Build topic map →</button>
        </div>
      )}

      {tab === "topics" && (
        <div className="card">
          <h3>Topic map</h3>
          {topics.map((t) => (
            <div key={t.name} className="topic">
              <div className="topic-head">
                <b>{t.name}</b>
                <span className="muted">Importance {"●".repeat(t.importance)}{"○".repeat(5 - t.importance)}</span>
              </div>
              <div className="chips">{t.subtopics.map((s) => <span key={s} className="tag">{s}</span>)}</div>
              {t.pastQuestions.length > 0 && (
                <ul className="pq">{t.pastQuestions.map((q, i) => <li key={i}>📝 {q}</li>)}</ul>
              )}
            </div>
          ))}
          <button className="btn send big" disabled={!!loading} onClick={makeQuiz}>Start diagnostic quiz →</button>
        </div>
      )}

      {tab === "quiz" && quiz.length > 0 && (
        <div className="card">
          <h3>Diagnostic quiz ({quiz.length} questions)</h3>
          {quiz.map((q, i) => (
            <div key={i} className="qcard">
              <p><b>{i + 1}. {q.question}</b> <span className="tag">{q.topic}</span></p>
              {q.options.map((o, j) => {
                const picked = answers[i] === j;
                const cls = submitted ? (j === q.answerIndex ? "opt correct" : picked ? "opt wrong" : "opt") : picked ? "opt selected" : "opt";
                return (
                  <button key={j} className={cls} disabled={submitted} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}>
                    {String.fromCharCode(65 + j)}. {o}
                  </button>
                );
              })}
              {submitted && (
                <div className="explain">
                  {answers[i] === q.answerIndex ? "✅ Correct. " : `❌ You chose ${String.fromCharCode(65 + answers[i])}; the answer is ${String.fromCharCode(65 + q.answerIndex)}. `}
                  {q.explanation}
                  {q.source && <div className="cite">📎 Source [Chunk {q.source.chunkId}]: “{q.source.excerpt}…”</div>}
                </div>
              )}
            </div>
          ))}
          {!submitted && (
            <button className="btn send big" disabled={Object.keys(answers).length < quiz.length || !!loading} onClick={submitQuiz}>
              Submit & find my gaps →
            </button>
          )}
        </div>
      )}

      {tab === "gaps" && latest && (
        <div className="card">
          <h3>{name ? `${name}, here are your knowledge gaps` : "Your knowledge gaps"}</h3>
          <p className="muted">Overall score: <b>{latest.overall}%</b></p>
          {gaps.map((g) => (
            <div key={g.topic} className="gap">
              <div className="topic-head"><b>{g.topic}</b><span className={`badge ${g.level}`}>{g.level} · {g.score}%</span></div>
              <div className="bar"><div className={`fill ${g.level}`} style={{ width: `${g.score}%` }} /></div>
            </div>
          ))}
          {submitted && quiz.some((q, i) => answers[i] !== q.answerIndex) && (
            <div className="why">
              <b>Why you&apos;re struggling:</b>
              <ul>{quiz.map((q, i) => answers[i] !== q.answerIndex ? <li key={i}><b>{q.topic}:</b> {q.explanation}</li> : null)}</ul>
            </div>
          )}
          <h3>Revision plan</h3>
          <div className="controls">
            <label>Hours per day <input type="number" min={1} max={8} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} /></label>
            <label>Days <input type="number" min={1} max={14} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} /></label>
            <button className="btn quiz" disabled={!!loading} onClick={() => refreshPlan(gaps)}>Update plan</button>
          </div>
          {plan?.plan?.map((d) => (
            <div key={d.day} className="day">
              <b>Day {d.day}</b>
              {d.items.map((it, i) => <div key={i} className="item">⏱ {it.minutes} min · <b>{it.topic}</b>: {it.activity}</div>)}
            </div>
          ))}
          {plan?.tips && <ul className="tips">{plan.tips.map((t, i) => <li key={i}>💡 {t}</li>)}</ul>}
          <button className="btn send big" disabled={!!loading} onClick={makeQuiz}>Retest with new questions →</button>
        </div>
      )}

      {tab === "progress" && (
        <div className="card">
          <h3>Progress</h3>
          {prev && latest && (
            <p className={latest.overall >= prev.overall ? "up" : "down"}>
              {latest.overall >= prev.overall ? "📈" : "📉"} Overall: {prev.overall}% → {latest.overall}% ({latest.overall - prev.overall >= 0 ? "+" : ""}{latest.overall - prev.overall})
            </p>
          )}
          {history.map((h, i) => (
            <div key={i} className="gap">
              <div className="topic-head"><b>Attempt {i + 1}</b><span className="muted">{h.date} · {h.overall}%</span></div>
              <div className="bar"><div className={`fill ${levelOf(h.overall)}`} style={{ width: `${h.overall}%` }} /></div>
            </div>
          ))}
          {prev && latest && Object.entries(latest.scores).map(([t, s]) => (
            prev.scores[t] !== undefined ? (
              <div key={t} className="item">{t}: {prev.scores[t]}% → <b>{s}%</b></div>
            ) : null
          ))}
          <button className="btn quiz big" onClick={() => { setHistory([]); setPlan(null); }}>Reset progress</button>
        </div>
      )}

      {tab === "assistant" && <Assistant materials={materials} weak={weak} />}
      <div className="footer">Built with Next.js, Vercel AI SDK and Groq</div>
    </div>
  );
}