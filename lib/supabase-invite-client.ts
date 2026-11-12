import { createClient } from "@supabase/supabase-js";

/*
 * app/auth/setup-password 専用のSupabaseクライアント。
 *
 * 共有クライアント(lib/supabase.ts)はdetectSessionInUrl=true
 * (デフォルト)のままconstructorから自動的に initialize() が
 * 呼ばれ、URL中のinviteコールバック（hashのaccess_token等、または
 * ?code=）を自動的に検出・処理・URLから消去してしまう
 * （node_modules/@supabase/auth-js の GoTrueClient._initialize() /
 * _getSessionFromURL() で確認済み）。
 *
 * これはReactのuseEffectがURLを確認するより前に発生し得るため、
 * 「有効な招待リンクなのにアプリ側が誤ってinvalid判定する」
 * raceの原因になり得る。
 *
 * このページでは、招待URLの有効性を先にアプリ側で判定してから
 * Supabase公式の setSession() / exchangeCodeForSession() を
 * 明示的に呼び出す必要があるため、
 *   detectSessionInUrl: false（URLの自動処理を無効化）
 *   skipAutoInitialize: true（constructorでの自動initializeも無効化）
 * を指定した専用クライアントを使い、
 * セッション確立のタイミングを完全にコード側で制御する。
 *
 * storageKeyは指定しない。省略時はSupabaseプロジェクトURLから
 * 自動導出され（sb-<project-ref>-auth-token）、これは共有クライアント
 * (lib/supabase.ts)と同じキーになる。そのためこのクライアントで
 * 確立したセッションは、以後アプリ全体（共有クライアント）から
 * 通常のログイン後と同じように利用できる。
 */
export function createInviteCallbackClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      detectSessionInUrl: false,
      skipAutoInitialize: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
