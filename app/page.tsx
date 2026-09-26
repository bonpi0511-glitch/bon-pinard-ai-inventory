"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import InventoryApp from "./inventory-app";

type Lang = "ja" | "fr" | "en";

const translations = {
  ja: {
    loading: "読み込み中...",
    loginTitle: "在庫管理ログイン",
    loginDescription: "メールアドレスとパスワードを入力してください。",
    email: "メールアドレス",
    password: "パスワード",
    login: "ログイン",
    loggingIn: "ログイン中...",
    logout: "ログアウト",
    loginError:
      "ログインできませんでした。メールアドレスとパスワードを確認してください。",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを非表示",
    clearPassword: "パスワードを消す",
    forgotPassword: "パスワードを忘れた方",
  },

  fr: {
    loading: "Chargement...",
    loginTitle: "Connexion à la gestion des stocks",
    loginDescription: "Veuillez saisir votre adresse e-mail et votre mot de passe.",
    email: "Adresse e-mail",
    password: "Mot de passe",
    login: "Se connecter",
    loggingIn: "Connexion...",
    logout: "Se déconnecter",
    loginError:
      "Connexion impossible. Veuillez vérifier votre adresse e-mail et votre mot de passe.",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    clearPassword: "Effacer le mot de passe",
    forgotPassword: "Mot de passe oublié ?",
  },

  en: {
    loading: "Loading...",
    loginTitle: "Inventory management login",
    loginDescription: "Please enter your email address and password.",
    email: "Email address",
    password: "Password",
    login: "Log in",
    loggingIn: "Logging in...",
    logout: "Log out",
    loginError:
      "Unable to log in. Please check your email address and password.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    clearPassword: "Clear password",
    forgotPassword: "Forgot password?",
  },
};

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [lang, setLang] = useState<Lang>("ja");

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("bonpinard-language") as Lang | null;

    if (
      savedLang === "ja" ||
      savedLang === "fr" ||
      savedLang === "en"
    ) {
      setLang(savedLang);
    }

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

  function changeLanguage(newLang: Lang) {
    setLang(newLang);
    localStorage.setItem("bonpinard-language", newLang);

    window.dispatchEvent(
      new CustomEvent("bonpinard-language-change", {
        detail: newLang,
      })
    );
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(t.loginError);
    }

    setLoggingIn(false);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main
        style={{
          padding: 40,
          fontFamily: "sans-serif",
        }}
      >
        {t.loading}
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
          {/* 言語切替 */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 6,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={() => changeLanguage("ja")}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: lang === "ja" ? "#171411" : "white",
                color: lang === "ja" ? "white" : "#171411",
                cursor: "pointer",
              }}
            >
              日本語
            </button>

            <button
              type="button"
              onClick={() => changeLanguage("fr")}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: lang === "fr" ? "#171411" : "white",
                color: lang === "fr" ? "white" : "#171411",
                cursor: "pointer",
              }}
            >
              FR
            </button>

            <button
              type="button"
              onClick={() => changeLanguage("en")}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: lang === "en" ? "#171411" : "white",
                color: lang === "en" ? "white" : "#171411",
                cursor: "pointer",
              }}
            >
              EN
            </button>
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#806c5a",
              marginBottom: 8,
            }}
          >
            BON PINARD SAS
          </div>

          <h1 style={{ marginTop: 0 }}>
            {t.loginTitle}
          </h1>

          <p style={{ color: "#666" }}>
            {t.loginDescription}
          </p>

          <form onSubmit={login}>
            <input
              type="email"
              placeholder={t.email}
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

            <div
              style={{
                position: "relative",
                marginBottom: 12,
              }}
            >
              <input
                type={showPassword ? "text" : "password"}
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  paddingRight: 76,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  fontSize: 16,
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 4,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {password && (
                  <button
                    type="button"
                    onClick={() => setPassword("")}
                    aria-label={t.clearPassword}
                    title={t.clearPassword}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      color: "#999",
                      padding: "4px 6px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={
                    showPassword
                      ? t.hidePassword
                      : t.showPassword
                  }
                  title={
                    showPassword
                      ? t.hidePassword
                      : t.showPassword
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 15,
                    padding: "4px 6px",
                    lineHeight: 1,
                  }}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
                marginBottom: 12,
              }}
            >
              <a
                href="/auth/forgot-password"
                style={{
                  fontSize: 13,
                  color: "#666",
                  textDecoration: "underline",
                }}
              >
                {t.forgotPassword}
              </a>
            </div>

            {error && (
              <p
                style={{
                  color: "#b00020",
                  fontSize: 14,
                }}
              >
                {error}
              </p>
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
              {loggingIn ? t.loggingIn : t.login}
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
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          background: "#f6f2ec",
        }}
      >
        <button
          onClick={() => changeLanguage("ja")}
          style={{
            fontWeight: lang === "ja" ? 700 : 400,
          }}
        >
          日本語
        </button>

        <button
          onClick={() => changeLanguage("fr")}
          style={{
            fontWeight: lang === "fr" ? 700 : 400,
          }}
        >
          FR
        </button>

        <button
          onClick={() => changeLanguage("en")}
          style={{
            fontWeight: lang === "en" ? 700 : 400,
          }}
        >
          EN
        </button>

        <button onClick={logout}>
          {t.logout}
        </button>
      </div>

      <InventoryApp />
    </>
  );
}