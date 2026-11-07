"use client";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Explain photosynthesis",
  "Why is the sky blue?",
  "What are fractions?",
  "How do volcanoes erupt?",
];

export default function Chat() {
  const [grade, setGrade] = useState("8");
  const [mode, setMode] = useState("explain");
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text }, { body: { grade, mode } });
    setInput("");
  };

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <div className="logo">🎓</div>
          <div>
            <h1>Study Buddy</h1>
            <p>Your friendly AI tutor</p>
          </div>
        </div>
        <div className="controls">
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
              <option key={g} value={g}>Class {g}</option>
            ))}
          </select>
          <div className="pills">
            <button className={`pill ${mode === "explain" ? "active" : ""}`} onClick={() => setMode("explain")}>
              Explain
            </button>
            <button className={`pill ${mode === "socratic" ? "active" : ""}`} onClick={() => setMode("socratic")}>
              Guide me
            </button>
          </div>
        </div>
      </div>

      <div className="chat">
        {messages.length === 0 && (
          <div className="welcome">
            <div className="big">👋</div>
            <h2>What do you want to learn today?</h2>
            <p>Pick your class, choose Explain or Guide me, and ask anything.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`row ${m.role === "user" ? "user" : "bot"}`}>
            <div className="bubble">
              {m.parts.map((p, i) =>
                p.type === "text" ? <ReactMarkdown key={i}>{p.text}</ReactMarkdown> : null
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="row bot">
            <div className="bubble">
              <span className="typing"><span /><span /><span /></span>
            </div>
          </div>
        )}

        {error && <div className="error">Oops, something went wrong: {error.message}</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask anything..."
        />
        <button className="btn quiz" disabled={busy || messages.length === 0}
          onClick={() => send("Quiz me with 3 questions on what we just discussed.")}>
          Quiz me
        </button>
        <button className="btn send" disabled={busy || !input.trim()} onClick={() => send(input)}>
          Send
        </button>
      </div>
      <div className="footer">Built with Next.js, Vercel AI SDK and Groq</div>
    </div>
  );
}