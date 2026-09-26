-- ============================================================
-- wine_alias_key(): numeric overloadの追加
--
-- 適用方法：Supabaseダッシュボード → SQL Editor → New query に
-- このファイルの内容を貼り付けて実行してください。
--
-- 重要：このファイルはまだ適用しないでください
-- （ユーザーの明示確認後に、手動で適用してください）。
--
-- 背景（production実機で確認済みのエラー）：
--   function wine_alias_key(text, text, text, numeric) does not exist
--
--   既存のwine_alias_key()はp_bottle_size_cl integerの1つだけが
--   productionに存在するが、merge_wines()内の呼び出し
--     wine_alias_key(v_to.producer, v_to.wine_name, v_to.vintage, v_to.bottle_size_cl)
--     wine_alias_key(v_from.producer, v_from.wine_name, v_from.vintage, v_from.bottle_size_cl)
--   は、wines.bottle_size_clがnumeric型として解決されるため、
--   integer版のシグネチャに一致せず"does not exist"で失敗する。
--
-- このmigrationが行うこと：
--   - p_bottle_size_cl numericを受け取るwine_alias_key()の
--     overloadを新規追加するだけ（CREATE OR REPLACEで新シグネチャを
--     作成。同名の既存integer版とは引数型が異なるため、
--     別関数としてoverloadされる＝integer版のCREATE OR REPLACEには
--     ならない）。
--   - 既存のinteger版wine_alias_key(text,text,text,integer)は
--     一切DROP・変更しない。
--   - merge_wines()本体、wine_name_aliases、stock_movements、
--     purchase_items、wine_list_settings、wine_classification_memory、
--     wine_stock_alert_settings、wine_merge_log、RLS、GRANTは
--     一切変更しない（今回のスコープはoverload追加のみ）。
--
-- 37.5clのような小数ボトルサイズを将来扱う可能性があるため、
-- ::integer キャストによる情報欠落を避け、numeric版を正しく
-- 追加する方針を採用する（::integer castをmerge_wines()側に
-- 追加する対応は今回禁止）。
--
-- alias key互換性（trim_scale()により末尾の無意味な0を除去する）：
--   integer版:   75        → "75"
--   numeric版:   75        → "75"
--   numeric版:   75.0      → "75"
--   numeric版:   75.00     → "75"
--   numeric版:   37.5      → "37.5"
-- 既存のinteger版が生成してきた"75"という表記と、numeric版が
-- 75/75.0/75.00から生成する"75"は完全に一致するため、
-- 既存のwine_name_aliases.source_keyとの互換性が保たれる。
--
-- 全体をBEGIN/COMMITで囲み、途中で失敗した場合の部分適用を防ぐ。
-- CREATE OR REPLACE FUNCTIONは冪等（再実行しても安全）。
-- ============================================================

begin;

create or replace function public.wine_alias_key(
  p_producer text,
  p_wine_name text,
  p_vintage text,
  p_bottle_size_cl numeric
)
returns text
language sql
immutable
set search_path = public
as $function$
  select
    trim(
      regexp_replace(
        upper(
          unaccent(
            coalesce(p_producer, '') || ' ' || coalesce(p_wine_name, '')
          )
        ),
        '[^A-Z0-9]+',
        ' ',
        'g'
      )
    )
    || ' | ' || coalesce(trim(p_vintage), '')
    || ' | ' ||
       coalesce(
         trim_scale(p_bottle_size_cl)::text,
         '75'
       );
$function$;

comment on function public.wine_alias_key(text, text, text, numeric) is
  'wine_alias_key()のnumeric版overload。既存のinteger版(text,text,text,integer)と共存し、DROPしない。merge_wines()がwines.bottle_size_cl(numeric)をそのまま渡しても解決できるようにするために追加。trim_scale()により75/75.0/75.00はすべて"75"となり、既存integer版のalias keyと互換性を保つ。37.5等の小数サイズはそのまま"37.5"として保持する（::integerキャストによる情報欠落を避けるため）。';

notify pgrst, 'reload schema';

commit;
