"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type VocabPair = { fr: string; ja: string };

type MaterialEntry = {
  id: string;
  addedAt: string;
  label: string;
  preview: string;
  vocabulary: VocabPair[];
};

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "beginner", label: "初級（簡単な単語・短い文）" },
  { value: "intermediate", label: "中級（一般的な語彙）" },
  { value: "advanced", label: "上級（自然な言い回し）" },
];

const STORAGE_KEY = "french_practice_source_text";
const BANK_STORAGE_KEY = "french_practice_vocab_bank";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

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
  const [vocabBank, setVocabBank] = useState<MaterialEntry[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSourceText(saved);
    try {
      const savedBank = localStorage.getItem(BANK_STORAGE_KEY);
      if (savedBank) setVocabBank(JSON.parse(savedBank));
    } catch {}
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function saveBank(next: MaterialEntry[]) {
    setVocabBank(next);
    localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(next));
  }

  async function addToVocabBank(text: string, label: string) {
    if (!text.trim()) return;
    setVocabLoading(true);
    try {
      const res = await fetch("/api/french-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ボキャブラリー抽出に失敗しました");
      const entry: MaterialEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        addedAt: new Date().toISOString(),
        label,
        preview: text.trim().slice(0, 80),
        vocabulary: data.vocabulary || [],
      };
      saveBank([...vocabBank, entry]);
    } catch (e: any) {
      setOcrError(e.message);
    } finally {
      setVocabLoading(false);
    }
  }

  function removeFromBank(id: string) {
    saveBank(vocabBank.filter((e) => e.id !== id));
  }

  // Most recent materials first, deduped by French term, capped for the API payload.
  const accumulatedVocab = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = vocabBank.length - 1; i >= 0; i--) {
      for (const v of vocabBank[i].vocabulary) {
        const key = v.fr.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(`${v.fr} — ${v.ja}`);
      }
    }
    return out.slice(0, 150);
  }, [vocabBank]);

  const totalVocabCount = useMemo(() => {
    const seen = new Set<string>();
    vocabBank.forEach((e) => e.vocabulary.forEach((v) => seen.add(v.fr.trim().toLowerCase())));
    return seen.size;
  }, [vocabBank]);

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
    const label = files.map((f) => f.name).join(", ");
    if (combined) {
      setSourceText(combined);
      // アップロードした教材は自動でボキャブラリーバンクに蓄積する
      addToVocabBank(combined, label);
    }
    setFileName(label);
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
        vocabularyBank: accumulatedVocab,
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
          アップロードした教材のボキャブラリーは自動的に蓄積され、以後の会話でも復習として登場します。
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
        {vocabLoading && <p className="mt-1 text-xs text-stone-500">ボキャブラリーを抽出してバンクに追加しています...</p>}
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
        <div className="mt-2">
          <button
            className="btn btn-secondary text-xs"
            disabled={vocabLoading || !sourceText.trim()}
            onClick={() => addToVocabBank(sourceText, "手入力テキスト")}
          >
            このテキストをボキャブラリーバンクに保存
          </button>
        </div>

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
          <p className="mt-1 text-xs text-stone-500">
            会話の難易度と、蓄積ボキャブラリーの復習頻度をこのレベルに合わせて調整します。
          </p>
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

      {vocabBank.length > 0 && (
        <section className="card mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">📚 蓄積ボキャブラリーバンク</h2>
            <span className="text-sm text-stone-500">単語・表現 {totalVocabCount} 件蓄積中</span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            これまでにアップロードした教材から集めた語彙です。会話中にレベルに合わせて自然に復習として登場します。
          </p>

          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-2">
            {vocabBank
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.id} className="mb-2 rounded-lg border border-stone-200 bg-white p-2 last:mb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-stone-700">{entry.label}</div>
                      <div className="text-[11px] text-stone-400">
                        {formatDate(entry.addedAt)} ・ 語彙 {entry.vocabulary.length} 件
                      </div>
                    </div>
                    <button
                      className="shrink-0 text-xs text-red-600 underline"
                      onClick={() => removeFromBank(entry.id)}
                    >
                      削除
                    </button>
                  </div>
                  {entry.vocabulary.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.vocabulary.slice(0, 12).map((v, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700"
                          title={v.ja}
                        >
                          {v.fr}
                        </span>
                      ))}
                      {entry.vocabulary.length > 12 && (
                        <span className="text-[11px] text-stone-400">+{entry.vocabulary.length - 12}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

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
