"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createInviteCallbackClient } from "@/lib/supabase-invite-client";

/*
 * Section 13「招待受諾・初回パスワード設定」。
 *
 * Section 12の inviteUserByEmail() が redirectTo として
 * ここ（/auth/setup-password）を指す。招待メールのリンクを開くと、
 * Supabaseが発行したセッション情報（ハッシュフラグメントの
 * access_token/refresh_token、またはPKCEの ?code= のいずれか）に
 * 加えて、type=invite というマーカーがこのURLへ付与された状態で
 * ブラウザが着地する。リンクが無効・期限切れの場合は、
 * Supabase側がハッシュへ error / error_code / error_description を
 * 付けてリダイレクトしてくる（例：error_code=otp_expired）。
 *
 * 重大な安全設計（2026-09-08の実機テストで判明した問題への対応）：
 *
 * 1回目の修正：「supabase.auth.getSession()がセッションを返す」
 * ことだけをreadyの条件にしていたため、同じブラウザに残っていた
 * 運営者Admin等の既存sessionを拾ってしまう問題があった。
 * → URL(hash/query)のerror/error_code/type/token有無を
 *   先に確認するよう修正した。
 *
 * 2回目の修正：上記の修正後も、共有クライアント
 * (lib/supabase.ts)は detectSessionInUrl=true のままconstructorから
 * 自動的にURL中のトークンを検出・処理・消去してしまうため、
 * ReactのuseEffectがURLを確認する前にSupabase側が既にhashを
 * 処理してしまうrace（実装はnode_modules/@supabase/auth-js の
 * GoTrueClient._initialize() / _getSessionFromURL() で確認済み）
 * が理論上あり得た。
 * → このページ専用に detectSessionInUrl:false かつ
 *   skipAutoInitialize:true のクライアント
 *   (lib/supabase-invite-client.ts) を使い、Supabase側の自動URL処理を
 *   完全に無効化した。その上で、URLの有効性をアプリ側で先に判定し、
 *   有効な招待コールバックだった場合だけ、Supabase公式の
 *   setSession() / exchangeCodeForSession() を明示的に呼び出して
 *   セッションを確立する。これにより：
 *     - 既存session/自動処理を一切経由しないため、
 *       「既存sessionをfallback利用する」余地が構造的に無い
 *     - セッション確立の可否がPromiseの解決を待つだけの
 *       決定的な処理になり、タイミング依存のraceが無くなる
 *
 * 3回目の修正（今回）：上記2つの修正の後も、開発サーバー
 * （React Strict Mode。next.config.jsが無いためApp Routerの既定で
 * 有効）ではuseEffectが setup→cleanup→setup と2回実行される。
 * 修正前は「1回目のeffectがURLのhashを読んでreplaceState()で
 * 消す→setSession()を開始→cleanupでcancelled=trueになる」
 * →「2回目のeffectが同じwindow.location.hashを再度読むが、
 * 既に1回目が消去した後なので空になっている→invalid判定」
 * という、共有clientとは無関係な「自分自身との自己競合」が
 * 起きていた（無効な旧リンクの再利用ではなく、新規リンクを
 * 1回だけ開いても毎回再現する）。
 * → URLの読み取り（snapshot化）・URL cleanup・
 *   resolveInviteCallback()の呼び出し（＝setSession()/
 *   exchangeCodeForSession()の呼び出し）を、それぞれuseRefで
 *   「componentインスタンスの中で1回だけ」に固定した。
 *   1回目のeffectが開始したPromiseを2回目のeffectがそのまま
 *   awaitして結果を受け取る構造にすることで、Strict Modeの
 *   2回実行があっても、URLの読み取りは1回・setSession()等の
 *   呼び出しも1回だけになる（詳細は下記のuseRef群を参照）。
 *
 * 手順：
 *   1. URL(hash/query)にauth errorが無いかを確認（最優先）。
 *      あれば即座に無効/期限切れ表示にする。
 *   2. URLに type=invite と access_token+refresh_token（実装形式）
 *      または code（PKCE形式）が揃っているか確認。
 *      揃っていなければ即座に無効表示にする（既存sessionは一切見ない）。
 *   3. 揃っている場合だけ、setSession()/exchangeCodeForSession()を
 *      呼び出して実際にセッションを確立する（失敗したら無効表示）。
 *   4. セッション確立後、必ずpublic.profilesでcompany_idの
 *      存在を確認する。確認できなければパスワード設定不可のまま
 *      「管理者へ連絡してください」を表示する（フォーム自体を出さない）。
 *
 * URLのtoken/code自体は関数内のローカル変数としてSupabase公式APIへ
 * 渡す以外の用途では一切使わない（ログ出力・DB保存・localStorageへの
 * 独自保存はしない）。
 *
 * パスワード自体は supabase.auth.updateUser({ password }) で
 * 本人セッションのままSupabase Authへ直接設定する。
 * Service Role・Admin APIは一切使わず、アプリ独自DBにも
 * パスワードを一切保存しない。
 */

type Lang = "ja" | "fr" | "en";

const translations = {
  ja: {
    brand: "BON PINARD",
    title: "アカウントを設定",
    description:
      "招待されたアカウントのパスワードを設定してください。",
    newPassword: "新しいパスワード",
    confirmPassword: "パスワード確認",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを非表示",
    clearPassword: "パスワードを消す",
    setPassword: "パスワードを設定",
    settingUp: "設定中...",
    passwordEmpty: "パスワードを入力してください。",
    passwordTooShort:
      "パスワードは8文字以上で入力してください。",
    passwordMismatch:
      "パスワードが一致しません。",
    setupPasswordFailed:
      "パスワードの設定に失敗しました。",
    passwordSetupSuccess:
      "パスワードを設定しました。",
    continueToApp: "アプリへ進む",
    invalidInviteLink:
      "招待リンクが無効または期限切れです。",
    expiredInviteLink:
      "招待リンクが無効または期限切れです。\n新しい招待メールを管理者に依頼してください。",
    checkingInvite:
      "招待リンクを確認しています...",
    checkingProfile:
      "アカウント情報を確認しています...",
    backToLogin: "ログイン画面へ戻る",
    accountCompanyNotFound:
      "アカウントの会社設定を確認できません。管理者に連絡してください。",
  },
  fr: {
    brand: "BON PINARD",
    title: "Configurer le compte",
    description:
      "Veuillez définir le mot de passe de votre compte invité.",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    clearPassword: "Effacer le mot de passe",
    setPassword: "Définir le mot de passe",
    settingUp: "Configuration...",
    passwordEmpty:
      "Veuillez saisir un mot de passe.",
    passwordTooShort:
      "Le mot de passe doit contenir au moins 8 caractères.",
    passwordMismatch:
      "Les mots de passe ne correspondent pas.",
    setupPasswordFailed:
      "Échec de la configuration du mot de passe.",
    passwordSetupSuccess:
      "Mot de passe défini.",
    continueToApp: "Accéder à l'application",
    invalidInviteLink:
      "Le lien d'invitation est invalide ou a expiré.",
    expiredInviteLink:
      "Le lien d'invitation est invalide ou a expiré.\nVeuillez demander à l'administrateur de vous envoyer un nouveau lien d'invitation.",
    checkingInvite:
      "Vérification du lien d'invitation...",
    checkingProfile:
      "Vérification des informations du compte...",
    backToLogin: "Retour à la connexion",
    accountCompanyNotFound:
      "Impossible de vérifier la société associée à ce compte. Veuillez contacter l'administrateur.",
  },
  en: {
    brand: "BON PINARD",
    title: "Set up your account",
    description:
      "Please set a password for your invited account.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    clearPassword: "Clear password",
    setPassword: "Set password",
    settingUp: "Setting up...",
    passwordEmpty: "Please enter a password.",
    passwordTooShort:
      "Password must be at least 8 characters.",
    passwordMismatch:
      "Passwords do not match.",
    setupPasswordFailed:
      "Failed to set the password.",
    passwordSetupSuccess:
      "Password set successfully.",
    continueToApp: "Continue to the app",
    invalidInviteLink:
      "This invite link is invalid or has expired.",
    expiredInviteLink:
      "This invite link is invalid or has expired.\nPlease ask your administrator to send you a new invite.",
    checkingInvite:
      "Checking invite link...",
    checkingProfile:
      "Checking account information...",
    backToLogin: "Back to login",
    accountCompanyNotFound:
      "Unable to verify the company associated with this account. Please contact your administrator.",
  },
} as const;

type Phase =
  | "checking"
  | "checking_profile"
  | "ready"
  | "invalid"
  | "expired"
  | "no_company"
  | "success";

type InviteResolution =
  | { outcome: "error"; errorCode: string | null }
  | { outcome: "not_invite" }
  | { outcome: "session"; userId: string }
  | { outcome: "failed" };

/*
 * URL(hash/query)から読み取ったcallback情報のsnapshot。
 *
 * React Strict Mode（開発時）はuseEffectを setup→cleanup→setup と
 * 2回実行するため、window.location.hash/searchを毎回読み直すと、
 * 1回目のeffectがURL cleanup（history.replaceState）で消した後の
 * 「空のURL」を2回目のeffectが読んでしまい、有効な招待/recovery
 * リンクでも「無効」と誤判定するrace が起きる（共有Supabase client
 * とは無関係の、このページ自身の中だけで起きる自己競合）。
 * これを防ぐため、URLの読み取りはcomponentのライフサイクル中に
 * 必ず1回だけ行い（呼び出し側のsnapshotRefで保証）、その結果を
 * このsnapshotとしてStrict Modeの2回目のeffectでも使い回す。
 */
type CallbackSnapshot = {
  error: string | null;
  errorCode: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
};

/*
 * window.location.hash/searchを読み取り、CallbackSnapshotへ変換する。
 * 呼び出し側（useEffect）がsnapshotRefで「1回だけ」呼ぶことを保証する。
 * この関数自体はURLの書き換え（history.replaceState）は行わない
 * （読み取りとcleanupの責務を分離し、cleanupは別途1回だけ行う）。
 */
function captureCallbackSnapshotFromUrl(): CallbackSnapshot {
  const empty: CallbackSnapshot = {
    error: null,
    errorCode: null,
    type: null,
    accessToken: null,
    refreshToken: null,
    code: null,
  };

  if (typeof window === "undefined") {
    return empty;
  }

  const rawHash = window.location.hash.startsWith(
    "#"
  )
    ? window.location.hash.slice(1)
    : window.location.hash;

  const hashParams = new URLSearchParams(rawHash);
  const searchParams = new URLSearchParams(
    window.location.search
  );

  return {
    error:
      hashParams.get("error") ||
      searchParams.get("error") ||
      null,
    errorCode:
      hashParams.get("error_code") ||
      searchParams.get("error_code") ||
      null,
    type:
      hashParams.get("type") ||
      searchParams.get("type") ||
      null,
    // snapshotのプロパティとしてのみ保持する。setSession()/
    // exchangeCodeForSession()へ渡す以外の用途（ログ出力・DB保存・
    // localStorageへの独自保存・UI表示等）には一切使わない。
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    code: searchParams.get("code"),
  };
}

/*
 * 既にcaptureCallbackSnapshotFromUrl()で確定したsnapshotだけを使い、
 * 有効な招待コールバックの場合だけSupabase公式の
 * setSession() / exchangeCodeForSession() を呼び出して実際に
 * セッションを確立する。window.location.hash/searchはここでは
 * 一切再読しない（呼び出し側がuseRefで「このcomponentインスタンス
 * では1回だけ」この関数を呼ぶことを保証する＝setSession()等の
 * 二重実行防止もそこで担保される）。
 *
 * 既存session（自動復元されたもの等）はここでは一切参照しない。
 * このページのクライアント(createInviteCallbackClient())は
 * detectSessionInUrl:false かつ skipAutoInitialize:true のため、
 * Supabase側が自動的にセッションを復元・確立することはなく、
 * ここで明示的に呼ぶsetSession()/exchangeCodeForSession()だけが
 * セッション確立の唯一の経路になる。
 */
async function resolveInviteCallback(
  client: SupabaseClient,
  snapshot: CallbackSnapshot
): Promise<InviteResolution> {
  const hasError = Boolean(
    snapshot.error || snapshot.errorCode
  );

  // 1. auth errorが明示されている場合は最優先。
  //    既存sessionの有無に関わらず即座に弾く。
  if (hasError) {
    return {
      outcome: "error",
      errorCode: snapshot.errorCode,
    };
  }

  // 2. このページは招待受諾（type=invite）と、既に招待受諾済み
  //    （＝メール確認済み）だがpassword設定が未完了のユーザー向けの
  //    パスワード設定リンク（resetPasswordForEmail、type=recovery）
  //    の両方を受け入れる。実際のSupabase仕様
  //    （node_modules/@supabase/auth-js の _initialize()内で
  //    redirectType/params.typeが 'recovery' かどうかで
  //    PASSWORD_RECOVERYイベントを判定している）に基づく。
  //    それ以外のtype、またはtype無しの場合は無効として扱う。
  if (
    snapshot.type !== "invite" &&
    snapshot.type !== "recovery"
  ) {
    return { outcome: "not_invite" };
  }

  if (snapshot.accessToken && snapshot.refreshToken) {
    const { data, error } =
      await client.auth.setSession({
        access_token: snapshot.accessToken,
        refresh_token: snapshot.refreshToken,
      });

    if (error || !data.session) {
      return { outcome: "failed" };
    }

    return {
      outcome: "session",
      userId: data.session.user.id,
    };
  }

  if (snapshot.code) {
    const { data, error } =
      await client.auth.exchangeCodeForSession(
        snapshot.code
      );

    if (error || !data.session) {
      return { outcome: "failed" };
    }

    return {
      outcome: "session",
      userId: data.session.user.id,
    };
  }

  return { outcome: "not_invite" };
}

export default function SetupPasswordPage() {
  const [lang, setLang] = useState<Lang>("ja");
  const [phase, setPhase] = useState<Phase>(
    "checking"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  // 新しいパスワード・確認用パスワードは、それぞれ独立して
  // 表示/非表示を切り替えられるようにする（認証ロジックには
  // 一切関係しない、表示上のUXのみ）。
  const [showNewPassword, setShowNewPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [formError, setFormError] = useState("");

  // このページ専用のクライアント（detectSessionInUrl:false /
  // skipAutoInitialize:true）。招待コールバック確立に成功した後、
  // handleSetPassword()から同じインスタンスを使い続ける必要が
  // あるためrefで保持する。Strict Modeでeffectが2回実行されても
  // 2個目のclientを作らないよう、生成済みならそれを再利用する。
  const clientRef = useRef<SupabaseClient | null>(
    null
  );

  // URL(hash/query)のsnapshot。componentインスタンスの中で
  // 最初のeffect実行時に1回だけ確定させ、Strict Modeの
  // 2回目のeffect実行では再読しない（詳細は
  // captureCallbackSnapshotFromUrl()のコメント参照）。
  const snapshotRef =
    useRef<CallbackSnapshot | null>(null);

  // URLからtoken等を消すhistory.replaceState()を1回だけ
  // 実行するためのガード。
  const urlCleanedRef = useRef(false);

  // resolveInviteCallback()（＝setSession()/
  // exchangeCodeForSession()の呼び出し）を1回だけ開始するための
  // Promiseキャッシュ。Strict Modeの2回目のeffectは、新しい
  // Promiseを開始せず、1回目が開始したこの同じPromiseをawaitする。
  const callbackPromiseRef =
    useRef<Promise<InviteResolution> | null>(null);

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
    let cancelled = false;

    /*
     * Strict Mode対策の核心部分。
     *
     * このuseEffectはReact Strict Mode（開発時）下では
     * setup→cleanup→setup と2回実行されるが、client生成・URL
     * snapshot・URL cleanup・callback解決（Promise）のいずれも
     * refで「componentインスタンスの中で1回だけ」に固定する。
     * 2回目のeffect実行では、既に存在するref値をそのまま再利用
     * するだけで、window.locationの再読も、setSession()/
     * exchangeCodeForSession()の再実行も一切発生しない。
     */

    // 1. Supabase clientは1個だけ生成する。
    if (!clientRef.current) {
      clientRef.current = createInviteCallbackClient();
    }

    const client = clientRef.current;

    // 2. URL(hash/query)のsnapshotは1回だけ取得する。
    if (!snapshotRef.current) {
      snapshotRef.current =
        captureCallbackSnapshotFromUrl();
    }

    const snapshot = snapshotRef.current;

    // 3. URL cleanup（token等の痕跡を消す）も1回だけ行う。
    //    snapshot取得後であれば、アドレスバーからtokenを消しても
    //    snapshotの値には影響しない。
    if (!urlCleanedRef.current) {
      urlCleanedRef.current = true;

      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname
        );
      } catch {}
    }

    // 4. callback解決（setSession()/exchangeCodeForSession()の
    //    呼び出し）を含むPromiseは1個だけ作る。Strict Modeの
    //    2回目のeffectは、この既存Promiseをそのままawaitするだけで、
    //    同じaccess_token/refresh_tokenで新しいsetSession()を
    //    並行実行することはない。
    if (!callbackPromiseRef.current) {
      callbackPromiseRef.current =
        resolveInviteCallback(client, snapshot);
    }

    async function run() {
      const result = await callbackPromiseRef.current!;

      if (cancelled) return;

      if (result.outcome === "error") {
        setPhase(
          result.errorCode === "otp_expired"
            ? "expired"
            : "invalid"
        );
        return;
      }

      if (
        result.outcome === "not_invite" ||
        result.outcome === "failed"
      ) {
        setPhase("invalid");
        return;
      }

      // result.outcome === "session"
      // ここで初めて、有効な招待コールバックから確立された
      // セッションのuserIdでprofileを確認する。
      setPhase("checking_profile");

      let hasCompany = false;

      try {
        /*
         * このページ専用クライアント（本人session）から既存の
         * RLS(profiles SELECT policy)をそのまま利用する。
         * ここでprofilesへINSERT/UPDATEは一切行わない
         * （会社所属の作成はSection 12のAdmin APIのみ）。
         */
        const {
          data: profile,
          error,
        } = await client
          .from("profiles")
          .select("company_id")
          .eq("id", result.userId)
          .maybeSingle();

        hasCompany = Boolean(
          !error && profile && profile.company_id
        );
      } catch {
        hasCompany = false;
      }

      if (cancelled) return;

      setPhase(
        hasCompany ? "ready" : "no_company"
      );
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  function changeLanguage(newLang: Lang) {
    setLang(newLang);
    try {
      localStorage.setItem(
        "bonpinard-language",
        newLang
      );
    } catch {}
  }

  async function handleSetPassword(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setFormError("");

    // フォーム自体はphase==="ready"（招待コールバック確認済み・
    // company所属確認済み）のときしか表示されないが、念のため
    // ここでも二重にガードする。
    const client = clientRef.current;

    if (phase !== "ready" || !client) {
      return;
    }

    if (!password || !confirmPassword) {
      setFormError(t.passwordEmpty);
      return;
    }

    if (password.length < 8) {
      setFormError(t.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t.passwordMismatch);
      return;
    }

    setSubmitting(true);

    try {
      // 招待コールバックから確立した本人sessionのまま
      // Supabase Authへ直接設定する。Admin API・service_roleは
      // 使わない。
      const { error } =
        await client.auth.updateUser({
          password,
        });

      if (error) {
        setFormError(
          error.message || t.setupPasswordFailed
        );
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setPhase("success");
    } catch (err: any) {
      setFormError(
        err?.message || t.setupPasswordFailed
      );
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

        {phase === "checking" && (
          <p style={{ color: "#666" }}>
            {t.checkingInvite}
          </p>
        )}

        {phase === "checking_profile" && (
          <p style={{ color: "#666" }}>
            {t.checkingProfile}
          </p>
        )}

        {phase === "invalid" && (
          <>
            <h1 style={{ marginTop: 0 }}>
              {t.invalidInviteLink}
            </h1>

            <a
              href="/"
              style={{
                color: "#171411",
                textDecoration: "underline",
              }}
            >
              {t.backToLogin}
            </a>
          </>
        )}

        {phase === "expired" && (
          <>
            <h1 style={{ marginTop: 0 }}>
              {t.brand}
            </h1>

            <p
              style={{
                color: "#b00020",
                whiteSpace: "pre-line",
              }}
            >
              {t.expiredInviteLink}
            </p>

            <a
              href="/"
              style={{
                color: "#171411",
                textDecoration: "underline",
              }}
            >
              {t.backToLogin}
            </a>
          </>
        )}

        {phase === "no_company" && (
          <>
            <h1 style={{ marginTop: 0 }}>
              {t.brand}
            </h1>

            <p
              style={{
                color: "#b00020",
                background: "#fdecea",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {t.accountCompanyNotFound}
            </p>
          </>
        )}

        {phase === "ready" && (
          <>
            <h1 style={{ marginTop: 0 }}>
              {t.title}
            </h1>

            <p style={{ color: "#666" }}>
              {t.description}
            </p>

            <form onSubmit={handleSetPassword}>
              <div
                style={{
                  position: "relative",
                  marginBottom: 12,
                }}
              >
                <input
                  type={
                    showNewPassword
                      ? "text"
                      : "password"
                  }
                  placeholder={t.newPassword}
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="new-password"
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
                      onClick={() =>
                        setPassword("")
                      }
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
                      setShowNewPassword(
                        (prev) => !prev
                      )
                    }
                    aria-label={
                      showNewPassword
                        ? t.hidePassword
                        : t.showPassword
                    }
                    title={
                      showNewPassword
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
                    {showNewPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  position: "relative",
                  marginBottom: 12,
                }}
              >
                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder={t.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  autoComplete="new-password"
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
                  {confirmPassword && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmPassword("")
                      }
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
                      setShowConfirmPassword(
                        (prev) => !prev
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? t.hidePassword
                        : t.showPassword
                    }
                    title={
                      showConfirmPassword
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
                    {showConfirmPassword
                      ? "🙈"
                      : "👁"}
                  </button>
                </div>
              </div>

              {formError && (
                <p
                  style={{
                    color: "#b00020",
                    fontSize: 14,
                  }}
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
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
                {submitting
                  ? t.settingUp
                  : t.setPassword}
              </button>
            </form>
          </>
        )}

        {phase === "success" && (
          <>
            <h1 style={{ marginTop: 0 }}>
              {t.passwordSetupSuccess}
            </h1>

            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "13px 20px",
                borderRadius: 8,
                background: "#171411",
                color: "white",
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              {t.continueToApp}
            </a>
          </>
        )}
      </div>
    </main>
  );
}
