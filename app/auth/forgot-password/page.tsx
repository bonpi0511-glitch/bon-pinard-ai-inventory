"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/*
 * パスワード再設定メール送信ページ。
 *
 * Supabase Authの既存設計を維持し、
 * supabase.auth.resetPasswordForEmail() だけを使う
 * （Admin API・service_roleは一切使わない）。
 *
 * リンク先は既存の /auth/setup-password をそのまま再利用する
 * （type=recoveryの処理は既にそちらで実装済み）。
 *
 * セキュリティ：
 * メールアドレスの存在有無をレスポンスから推測されないよう、
 * 送信が実際に行われたか（アカウントが存在したか）に関わらず、
 * 成功時の表示文言は常に同じ「アカウントが存在する場合は送信した」
 * という一般的な文言にする。Supabase側から明確なエラー
 * （ネットワーク障害等）が返った場合のみ、一般的な送信失敗
 * メッセージを表示する。
 *
 * production domainはハードコードせず、window.location.originを
 * 使う（既存のredirect URL構成・localhost/production設定に依存）。
 */

type Lang = "ja" | "fr" | "en";

const translations = {
  ja: {
    brand: "BON PINARD",
    title: "パスワードの再設定",
    description:
      "登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをメールでお送りします。",
    email: "メールアドレス",
    send: "再設定メールを送信",
    sending: "送信中...",
    resendIn: "再送信まで {seconds} 秒",
    resultMessage:
      "アカウントが存在する場合、パスワード再設定メールを送信しました。",
    genericError:
      "メールの送信に失敗しました。しばらくしてから再度お試しください。",
    emailEmpty: "メールアドレスを入力してください。",
    backToLogin: "ログイン画面へ戻る",
  },

  fr: {
    brand: "BON PINARD",
    title: "Réinitialiser le mot de passe",
    description:
      "Saisissez votre adresse e-mail. Nous vous enverrons un lien de réinitialisation du mot de passe.",
    email: "Adresse e-mail",
    send: "Envoyer l'e-mail de réinitialisation",
    sending: "Envoi...",
    resendIn: "Nouvel envoi possible dans {seconds} s",
    resultMessage:
      "Si ce compte existe, un e-mail de réinitialisation du mot de passe a été envoyé.",
    genericError:
      "Échec de l'envoi de l'e-mail. Veuillez réessayer plus tard.",
    emailEmpty: "Veuillez saisir une adresse e-mail.",
    backToLogin: "Retour à la connexion",
  },

  en: {
    brand: "BON PINARD",
    title: "Reset your password",
    description:
      "Enter your email address. We'll send you a link to reset your password.",
    email: "Email address",
    send: "Send reset email",
    sending: "Sending...",
    resendIn: "Resend available in {seconds}s",
    resultMessage:
      "If this account exists, a password reset email has been sent.",
    genericError:
      "Failed to send the email. Please try again later.",
    emailEmpty: "Please enter an email address.",
    backToLogin: "Back to login",
  },
} as const;

const RESEND_COOLDOWN_SECONDS = 45;

export default function ForgotPasswordPage() {
  const [lang, setLang] = useState<Lang>("ja");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] =
    useState(0);

  const t = translations[lang];

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(
        "bonpinard-language"
      ) as Lang | null;

      if (
        savedLang === "ja" ||
        savedLang === "fr" ||
        savedLang === "en"
      ) {
        setLang(savedLang);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) =>
        prev > 0 ? prev - 1 : 0
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  function changeLanguage(newLang: Lang) {
    setLang(newLang);
    try {
      localStorage.setItem(
        "bonpinard-language",
        newLang
      );
    } catch {}
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (submitting || cooldownSeconds > 0) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage(t.emailEmpty);
      return;
    }

    setErrorMessage("");
    setResultMessage("");
    setSubmitting(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          trimmedEmail,
          {
            redirectTo: `${window.location.origin}/auth/setup-password`,
          }
        );

      /*
       * Supabaseのresetpasswordforemail()は、アカウントの
       * 存在有無では意図的にエラーを返さない設計になっている
       * （ユーザー列挙攻撃を防ぐため）。ここでerrorが返る場合は
       * ネットワーク障害・レート制限等の技術的な問題であり、
       * アカウントの存在有無を示すものではないため、
       * その場合だけ一般的な送信失敗メッセージを表示する。
       * それ以外は常に同じ「存在する場合は送信した」という
       * 文言を表示し、アカウントの存在有無を一切公開しない。
       */
      if (error) {
        setErrorMessage(t.genericError);
      } else {
        setResultMessage(t.resultMessage);
        setCooldownSeconds(
          RESEND_COOLDOWN_SECONDS
        );
      }
    } catch (err: any) {
      setErrorMessage(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

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
          boxShadow:
            "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
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
              background:
                lang === "ja"
                  ? "#171411"
                  : "white",
              color:
                lang === "ja"
                  ? "white"
                  : "#171411",
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
              background:
                lang === "fr"
                  ? "#171411"
                  : "white",
              color:
                lang === "fr"
                  ? "white"
                  : "#171411",
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
              background:
                lang === "en"
                  ? "#171411"
                  : "white",
              color:
                lang === "en"
                  ? "white"
                  : "#171411",
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
          {t.brand}
        </div>

        <h1 style={{ marginTop: 0 }}>{t.title}</h1>

        <p style={{ color: "#666" }}>
          {t.description}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            autoComplete="email"
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

          {errorMessage && (
            <p
              style={{
                color: "#b00020",
                fontSize: 14,
              }}
            >
              {errorMessage}
            </p>
          )}

          {resultMessage && (
            <p
              style={{
                color: "#1b6b3a",
                fontSize: 14,
                background: "#eaf6ee",
                padding: 10,
                borderRadius: 8,
              }}
            >
              {resultMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={
              submitting || cooldownSeconds > 0
            }
            style={{
              width: "100%",
              padding: 13,
              border: 0,
              borderRadius: 8,
              background: "#171411",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              cursor:
                submitting || cooldownSeconds > 0
                  ? "default"
                  : "pointer",
              opacity:
                submitting || cooldownSeconds > 0
                  ? 0.6
                  : 1,
            }}
          >
            {submitting
              ? t.sending
              : cooldownSeconds > 0
                ? t.resendIn.replace(
                    "{seconds}",
                    String(cooldownSeconds)
                  )
                : t.send}
          </button>
        </form>

        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 16,
            color: "#171411",
            textDecoration: "underline",
            fontSize: 14,
          }}
        >
          {t.backToLogin}
        </a>
      </div>
    </main>
  );
}
