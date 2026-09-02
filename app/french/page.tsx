"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Level = "beginner" | "intermediate" | "advanced";

type Message =
  | { role: "assistant"; french: string; translation: string }
  | {
      role: "user";
      french: string;
      correction: string | null;
      correctionNote: string | null;
    };

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "beginner", label: "初級（簡単な単語・短い文）" },
  { value: "intermediate", label: "中級（一般的な語彙）" },
  { value: "advanced", label: "上級（自然な言い回し）" },
];

const STORAGE_KEY = "french_practice_source_text";

export default function FrenchPracticePage() {
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [messages, setMessages] = useState<Message[]>([]);
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSourceText(saved);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function readFileAsText(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("ファイルの読み込みに失敗しました"));
      reader.readAsText(file, "utf-8");
    });
  }

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setOcrError("");

    const textFiles = files.filter((f) => f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name));
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const collected: string[] = [];

    if (textFiles.length) {
      try {
        const texts = await Promise.all(textFiles.map(readFileAsText));
        collected.push(...texts);
      } catch (e: any) {
        setOcrError(e.message);
      }
    }

    if (imageFiles.length) {
      setOcrLoading(true);
      try {
        const fd = new FormData();
        imageFiles.forEach((f) => fd.append("files", f));
        const res = await fetch("/api/french-ocr", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "画像からの文字起こしに失敗しました");
        if (data.text) collected.push(data.text);
      } catch (e: any) {
        setOcrError(e.message);
      } finally {
        setOcrLoading(false);
      }
    }

    const combined = collected.filter(Boolean).join("\n\n");
    if (combined) setSourceText(combined);
    setFileName(files.map((f) => f.name).join(", "));
  }

  function historyForApi() {
    return messages.map((m) =>
      m.role === "assistant"
        ? { role: "assistant" as const, content: m.french }
        : { role: "user" as const, content: m.french }
    );
  }

  async function callChatApi(userMessage?: string) {
    const res = await fetch("/api/french-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText,
        level,
        history: historyForApi(),
        userMessage,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "会話の生成に失敗しました");
    return data as {
      reply: string;
      reply_translation_ja: string;
      correction_fr: string | null;
      correction_note_ja: string | null;
    };
  }

  async function startConversation() {
    if (!sourceText.trim()) {
      alert("テキストを貼り付けるか、テキストファイルをアップロードしてください");
      return;
    }
    localStorage.setItem(STORAGE_KEY, sourceText);
    setError("");
    setLoading(true);
    setMessages([]);
    setStarted(true);
    try {
      const data = await callChatApi();
      setMessages([{ role: "assistant", french: data.reply, translation: data.reply_translation_ja }]);
    } catch (e: any) {
      setError(e.message);
      setStarted(false);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    setInput("");
    const userMsg: Message = { role: "user", french: text, correction: null, correctionNote: null };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const data = await callChatApi(text);
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.role === "user") {
          next[lastIdx] = {
            role: "user",
            french: text,
            correction: data.correction_fr,
            correctionNote: data.correction_note_ja,
          };
        }
        return [
          ...next,
          { role: "assistant", french: data.reply, translation: data.reply_translation_ja },
        ];
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setStarted(false);
    setError("");
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-2">
        <Link href="/" className="text-sm text-stone-500 underline">
          ← BON PINARD 在庫アプリへ
        </Link>
      </div>

      <section className="card p-6">
        <p className="text-sm font-bold text-stone-500">🇫🇷 Français</p>
        <h1 className="mt-2 text-3xl font-bold">フランス語 会話練習アプリ</h1>
        <p className="mt-2 text-stone-600">
          テキストをアップロード（または貼り付け）すると、その内容をもとにAIがフランス語で会話練習の相手をしてくれます。
          文法の間違いはやさしく訂正してくれます。
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">1. 会話の元になるテキストを用意</h2>
        <p className="mt-1 text-sm text-stone-600">
          テキストファイル（.txt / .md）、または教科書などのページ写真をアップロードできます。写真はAIが文字を読み取ってテキスト化します。
        </p>
        <input
          className="input mt-3 w-full"
          type="file"
          multiple
          accept="image/*,.txt,.md,text/plain"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {ocrLoading && <p className="mt-1 text-xs text-stone-500">写真から文字を読み取っています...</p>}
        {fileName && !ocrLoading && <p className="mt-1 text-xs text-stone-500">読み込み済み: {fileName}</p>}
        {ocrError && (
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            エラー: {ocrError}
          </div>
        )}

        <textarea
          className="input mt-3 w-full"
          rows={8}
          placeholder="ここにフランス語の記事・会話文などのテキストを貼り付けることもできます"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
        />

        <div className="mt-3">
          <label className="text-sm font-semibold text-stone-600">レベル</label>
          <select
            className="input mt-1 w-full md:w-64"
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={loading || ocrLoading} onClick={startConversation}>
            {loading && !started ? "準備中..." : started ? "テキストを変えて再スタート" : "会話を始める"}
          </button>
          {started && (
            <button className="btn btn-secondary" onClick={resetConversation}>
              会話をリセット
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            エラー: {error}
          </div>
        )}
      </section>

      {started && (
        <section className="card mt-4 p-5">
          <h2 className="text-xl font-bold">2. 会話練習</h2>

          <div ref={scrollRef} className="mt-3 max-h-[520px] space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-4">
            {messages.map((m, i) =>
              m.role === "assistant" ? (
                <div key={i} className="flex flex-col items-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white border border-stone-200 px-4 py-2 text-sm">
                    {m.french}
                  </div>
                  <div className="mt-1 max-w-[85%] text-xs text-stone-500">{m.translation}</div>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-stone-900 px-4 py-2 text-sm text-white">
                    {m.french}
                  </div>
                  {m.correction && (
                    <div className="mt-1 max-w-[85%] rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      <div className="font-bold">添削: {m.correction}</div>
                      {m.correctionNote && <div className="mt-1">{m.correctionNote}</div>}
                    </div>
                  )}
                </div>
              )
            )}
            {loading && (
              <div className="text-xs text-stone-400">相手が入力中...</div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="フランス語で返信してみましょう"
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <button className="btn btn-primary" disabled={loading || !input.trim()} onClick={sendMessage}>
              送信
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
