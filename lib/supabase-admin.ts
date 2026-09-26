import { createClient } from "@supabase/supabase-js";

/*
 * サーバー専用のSupabaseクライアント（Service Role）。
 *
 * 絶対にブラウザ／クライアントバンドルへ公開しないこと。
 * このファイルは "use client" コンポーネントから絶対にimportしない。
 * API Route（app/api/**\/route.ts）等、サーバーでしか実行されない
 * コードだけがこの関数を呼び出せる。
 *
 * NEXT_PUBLIC_を付けていない SUPABASE_SERVICE_ROLE_KEY を使う。
 * このキーはSupabaseのRLSを完全にバイパスするため、
 * 運営者専用のAdmin APIからのみ、必ずAdmin認証（requireAdminUser）を
 * 通した後に使用すること。
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Set it in .env.local (server-only; never expose it to the client)."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
