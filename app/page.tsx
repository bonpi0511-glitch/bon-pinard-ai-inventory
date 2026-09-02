"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import InventoryApp from "./inventory-app";

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("ログインできませんでした。メールアドレスとパスワードを確認してください。");
    }

    setLoggingIn(false);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif" }}>
        読み込み中...
      </main>
    );
  }

  if (!session) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f2ec",
          padding: 20,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "white",
            padding: 32,
            borderRadius: 16,
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 14, color: "#806c5a", marginBottom: 8 }}>
            BON PINARD SAS
          </div>

          <h1 style={{ marginTop: 0 }}>在庫管理ログイン</h1>

          <p style={{ marginTop: -8, marginBottom: 16 }}>
            <Link href="/french" style={{ fontSize: 14, color: "#171411", textDecoration: "underline" }}>
              🇫🇷 フランス語 会話練習アプリはこちら
            </Link>
          </p>

          <p style={{ color: "#666" }}>
            メールアドレスとパスワードを入力してください。
          </p>

          <form onSubmit={login}>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                marginBottom: 12,
                border: "1px solid #ccc",
                borderRadius: 8,
                fontSize: 16,
              }}
            />

            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                marginBottom: 12,
                border: "1px solid #ccc",
                borderRadius: 8,
                fontSize: 16,
              }}
            />

            {error && (
              <p style={{ color: "#b00020", fontSize: 14 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              style={{
                width: "100%",
                padding: 13,
                border: 0,
                borderRadius: 8,
                background: "#171411",
                color: "white",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loggingIn ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
      <div
        style={{
          padding: "8px 16px",
          textAlign: "right",
          background: "#f6f2ec",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link href="/french" style={{ fontSize: 14, textDecoration: "underline" }}>
          🇫🇷 フランス語 会話練習
        </Link>
        <button onClick={logout}>ログアウト</button>
      </div>

      <InventoryApp />
    </>
  );
}