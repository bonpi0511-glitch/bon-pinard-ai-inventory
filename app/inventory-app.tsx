"use client";

import { supabase } from "../lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type {
  InitialInventoryImportRow,
  InitialImportRowStatus,
  InitialImportSummary,
} from "../lib/initial-import-types";

type StatusCode = "CONFIRMED" | "NEEDS_CHECK" | "MANUAL";

/*
 * アプリ全体の表示言語。
 *
 * appLanguage        : 管理画面全体（在庫表・AI判定・重複候補など）
 * wineListLanguage    : お客様向けワインリスト（Carte des vins）専用
 *                        初期値はappLanguageだが、独立して変更できる。
 */
type AppLanguage = "FR" | "JA" | "EN";

const APP_LANGUAGE_STORAGE_KEY = "bon_pinard_app_language";

/*
 * アプリ全体のUI翻訳辞書。
 *
 * ワイン名・生産者名・Appellation・Cuvéeなど
 * DB内の商品固有データは翻訳しない。
 *
 * ここではボタン、見出し、説明文など
 * システムUIだけを翻訳する。
 */
const APP_I18N = {
  FR: {
    language: "Langue",

    appTitle:
      "Gestion de stock de vins assistée par IA",

    appDescription:
      "Importez un PDF ou une photo. L'IA analyse le document et prépare automatiquement les articles pour le stock.",

    installTitle:
      "Utiliser sur iPhone / iPad",

    installDescription:
      "Ouvrez l'application dans Safari puis choisissez « Sur l'écran d'accueil » depuis le menu Partager.",

    installStep1:
      "Ouvrir l'URL de l'application dans Safari",

    installStep2:
      "Appuyer sur le bouton Partager",

    installStep3:
      "Choisir « Sur l'écran d'accueil »",

    installStep4:
      "Lancer l'application depuis l'icône BON PINARD",

    section1Title:
      "1. Sélectionner un PDF ou une photo",

    analyzing:
      "Analyse IA en cours...",

    analyzeAndRegister:
      "Analyser avec l'IA et préparer le stock",

    addManualRow:
      "Ajouter une ligne manuellement",

    section2Title:
      "2. Informations de la facture",

    supplier:
      "Fournisseur",

    company:
      "Société",

    invoiceNumber:
      "N° de facture",

    invoiceDate:
      "Date de facture",

    section3Title:
      "3. Document original et résultat de l'analyse IA",

    section3Description:
      "Consultez le document original à gauche et vérifiez le millésime, la quantité et le prix unitaire à droite.",

    sourceDocument:
      "PDF / Photo original",

    openNewTab:
      "Ouvrir dans un nouvel onglet",

    imageFile:
      "Photo / Image",

    noPreview:
      "Sélectionnez un PDF ou une photo pour afficher le document original ici.",

    extractedInventory:
      "Résultat IA / Détail du stock",

    stockBottles:
      "Bouteilles",

    amountHT:
      "Montant HT",

    productCount:
      "Produits",

    needsReview:
      "À vérifier",

    exportExcel:
      "Exporter Excel",

    exportCSV:
      "Exporter CSV",

    exportMasters:
      "Exporter les référentiels",

    saveDevice:
      "Enregistrer sur l'appareil",

    saveSupabase:
      "Enregistrer sur Supabase",

    clearAI:
      "Effacer le résultat IA",

    clearAIConfirm:
      "Effacer le résultat de l'analyse IA ?",

    noAIResults:
      "Aucun résultat IA pour le moment.",

    status:
      "Statut",

    statusConfirmed:
      "Confirmé",

    statusNeedsCheck:
      "À vérifier",

    statusManual:
      "Saisie manuelle",

    action:
      "Action",

    delete:
      "Supprimer",

    stockDate:
      "Date d'entrée",

    producer:
      "Producteur",

    cuvee:
      "Cuvée",

    originalProductName:
      "Nom original",

    color:
      "Couleur",

    vintage:
      "Millésime",

    bottleSize:
      "Contenance",

    alcohol:
      "Alcool",

    quantity:
      "Quantité",

    unitPriceHT:
      "Prix unitaire HT",

    memo:
      "Note",

    section4Title:
      "4. Stock actuel",

    section4Description:
      "Stock actuellement enregistré dans Supabase",

    refreshInventory:
      "Actualiser le stock",

    classifying:
      "Classification IA en cours...",

    classifyTest:
      "Classification géographique IA — test 20 vins",

    classifyAll:
      "Classification géographique IA — tout le stock",

    wineName:
      "Nom du vin",

    country:
      "Pays",

    region:
      "Région",

    subregion:
      "Sous-région",

    appellation:
      "Appellation",

    cruLevel:
      "Classement",

    category:
      "Catégorie",

    confidence:
      "Confiance",

    classificationConfirmed:
      "Confirmé",

    manualCorrection:
      "Correction manuelle",

    memoryCandidate:
      "Suggestion mémoire",

    aiClassification:
      "Classification IA",

    saving:
      "Enregistrement...",

    saved:
      "Enregistré",

    markConfirmed:
      "Confirmer",

    categorySparkling:
      "Effervescent",

    categoryWhite:
      "Blanc",

    categoryRose:
      "Rosé",

    categoryRed:
      "Rouge",

    categorySpirit:
      "Spiritueux",

    wineTypes:
      "Références de vin",

    currentStockBottles:
      "Bouteilles en stock",

    inventoryCostHT:
      "Valeur du stock HT",

    inventorySearchPlaceholder:
      "Rechercher par producteur, cuvée, millésime ou couleur",

    displayed:
      "Affichage",

    wineTypesUnit:
      "références",

    cuveeWineName:
      "Cuvée / Vin",

    costHT:
      "Coût HT",

    noMatchingInventory:
      "Aucun stock correspondant.",
    unknownError:
      "Erreur inconnue",

    loginUserUnavailable:
      "Impossible de récupérer l'utilisateur connecté.",

    companyInfoUnavailable:
      "Impossible de récupérer les informations de la société.",

    confirmedClassificationFetchFailed:
      "Échec du chargement des classifications confirmées : {error}",

    savedAiCandidateFetchFailed:
      "Échec du chargement des suggestions IA enregistrées : {error}",

    aiCandidateTempSaveFailed:
      "Échec de l'enregistrement temporaire des suggestions IA : {error}",

    classificationTestTargetsMissing:
      "Impossible de récupérer les 20 vins du test multirégional : {found}/20.",

    classificationSearchingConfirmed:
      "Recherche des données confirmées... {total} vins",

    classificationAiRunning:
      "Confirmés {confirmed} / Classification IA {ai} vins",

    classificationComplete:
      "Classification terminée : {total} vins (confirmés {confirmed} / mémoire {memory} / IA {ai})",

    classificationError:
      "Erreur de classification : {error}",

    noClassifiableInventory:
      "Aucun vin du stock ne peut être classifié par l'IA.",

    classifyAllConfirm:
      "Classer géographiquement {total} vins par lots de 20 avec l'IA.\nL'API OpenAI sera utilisée. Démarrer ?",

    classificationAllSearchingConfirmed:
      "Recherche des données confirmées pour tout le stock... {total} vins",

    classificationBatchProgress:
      "Stock total {total} / confirmés {confirmed} / IA {from}–{to} / {aiTotal} (lot {batch}/{batches})",

    classificationProcessing:
      "Traitement : {done}/{total} vins (confirmés {confirmed} / mémoire {memory} / IA traités {aiDone}/{aiTotal})",

    classificationAllComplete:
      "Classification de tout le stock terminée : {done}/{total} vins (confirmés {confirmed} / mémoire {memory} / IA {ai})",

    classificationAllErrorPartial:
      "Erreur de classification de tout le stock : {error}. Les résultats déjà obtenus restent affichés.",

    parallelProcessingError:
      "Traitement parallèle {index} : {error}",

    parallelResultCountMismatch:
      "Traitement parallèle {index} : {input} entrées, {output} résultats.",

    batchResultCountMismatch:
      "Lot {batch}/{batches} : {input} entrées, {output} résultats.",

    classificationWineMissing:
      "Impossible de récupérer le vin à enregistrer.",

    existingClassificationCheckFailed:
      "Échec de la vérification de la classification existante : {error}",

    classificationUpdateFailed:
      "Échec de la mise à jour de la classification : {error}",

    classificationSaveFailed:
      "Échec de l'enregistrement de la classification : {error}",

    classificationSavedConfirmed:
      "Enregistré comme confirmé : {wine}",

    classificationConfirmedSaveFailed:
      "Échec de l'enregistrement des données confirmées.\n{error}",

  },

  JA: {
    language: "言語",

    appTitle:
      "AI在庫自動登録アプリ",

    appDescription:
      "PDF・写真をアップロードすると、AI判定して商品在庫へ登録できます。ログイン中の会社を自社として扱い、仕入先は伝票ごとに判定します。",

    installTitle:
      "iPhone / iPadで使う方法",

    installDescription:
      "公開URLをSafariで開き、共有ボタンから「ホーム画面に追加」を選ぶと、アプリのように起動できます。",

    installStep1:
      "SafariでこのアプリのURLを開く",

    installStep2:
      "共有ボタンを押す",

    installStep3:
      "「ホーム画面に追加」を選択",

    installStep4:
      "BON PINARDアイコンから起動",

    section1Title:
      "1. PDF・写真を選択",

    analyzing:
      "AI判定中...",

    analyzeAndRegister:
      "AI判定して在庫へ自動登録",

    addManualRow:
      "手入力で行追加",

    section2Title:
      "2. 伝票情報",

    supplier:
      "仕入先",

    company:
      "自社",

    invoiceNumber:
      "伝票番号",

    invoiceDate:
      "伝票日付",

    section3Title:
      "3. 原本PDF/写真とAI抽出結果",

    section3Description:
      "左で原本を見ながら、右でヴィンテージ・数量・単価を確認できます。",

    sourceDocument:
      "原本PDF / 写真",

    openNewTab:
      "別タブで開く",

    imageFile:
      "写真 / 画像",

    noPreview:
      "PDFまたは写真を選択すると、ここに原本が表示されます。",

    extractedInventory:
      "AI抽出結果・在庫明細",

    stockBottles:
      "在庫本数",

    amountHT:
      "金額HT",

    productCount:
      "商品数",

    needsReview:
      "要確認",

    exportExcel:
      "Excel出力",

    exportCSV:
      "CSV出力",

    exportMasters:
      "マスター出力",

    saveDevice:
      "端末保存",

    saveSupabase:
      "Supabaseへ保存",

    clearAI:
      "AI結果クリア",

    clearAIConfirm:
      "AI抽出結果をクリアしますか？",

    noAIResults:
      "AI抽出結果はまだありません",

    status:
      "状態",

    statusConfirmed:
      "確認済",

    statusNeedsCheck:
      "要確認",

    statusManual:
      "手入力",

    action:
      "操作",

    delete:
      "削除",

    stockDate:
      "入庫日",

    producer:
      "生産者",

    cuvee:
      "キュヴェ",

    originalProductName:
      "商品名原文",

    color:
      "色",

    vintage:
      "年",

    bottleSize:
      "容量",

    alcohol:
      "度数",

    quantity:
      "本数",

    unitPriceHT:
      "単価HT",

    memo:
      "メモ",

    section4Title:
      "4. 全在庫一覧",

    section4Description:
      "Supabaseに保存されている現在庫",

    refreshInventory:
      "在庫を更新",

    classifying:
      "AI判定中...",

    classifyTest:
      "AI地域判定（20件テスト）",

    classifyAll:
      "AI地域判定（全在庫）",

    wineName:
      "ワイン名",

    country:
      "国",

    region:
      "地域",

    subregion:
      "サブリージョン",

    appellation:
      "アペラシオン",

    cruLevel:
      "格付け",

    category:
      "カテゴリー",

    confidence:
      "信頼度",

    classificationConfirmed:
      "確認済み",

    manualCorrection:
      "手動修正",

    memoryCandidate:
      "記憶候補",

    aiClassification:
      "AI判定",

    saving:
      "保存中...",

    saved:
      "保存済み",

    markConfirmed:
      "確認済みにする",

    categorySparkling:
      "泡",

    categoryWhite:
      "白",

    categoryRose:
      "ロゼ",

    categoryRed:
      "赤",

    categorySpirit:
      "スピリッツ",

    wineTypes:
      "ワイン種類",

    currentStockBottles:
      "現在庫本数",

    inventoryCostHT:
      "在庫原価HT",

    inventorySearchPlaceholder:
      "生産者・キュヴェ・ヴィンテージ・色で検索",

    displayed:
      "表示",

    wineTypesUnit:
      "種類",

    cuveeWineName:
      "キュヴェ / ワイン名",

    costHT:
      "原価HT",

    noMatchingInventory:
      "該当する在庫がありません",
    unknownError:
      "不明なエラー",

    loginUserUnavailable:
      "ログインユーザーを取得できませんでした。",

    companyInfoUnavailable:
      "会社情報を取得できませんでした。",

    confirmedClassificationFetchFailed:
      "確認済み分類の取得に失敗しました: {error}",

    savedAiCandidateFetchFailed:
      "保存済みAI候補の取得に失敗しました: {error}",

    aiCandidateTempSaveFailed:
      "AI候補の一時保存に失敗しました: {error}",

    classificationTestTargetsMissing:
      "多地域テスト対象を20件取得できませんでした：{found}/20件",

    classificationSearchingConfirmed:
      "確認済みデータを検索中... {total}件",

    classificationAiRunning:
      "確認済み {confirmed}件 / AI判定中 {ai}件",

    classificationComplete:
      "判定完了：{total}件（確認済み {confirmed}件 / 記憶候補 {memory}件 / AI判定 {ai}件）",

    classificationError:
      "判定エラー：{error}",

    noClassifiableInventory:
      "AI判定できる在庫がありません",

    classifyAllConfirm:
      "全在庫 {total}件を20件ずつAI地域判定します。\nOpenAI APIを使用します。開始しますか？",

    classificationAllSearchingConfirmed:
      "全在庫の確認済みデータを検索中... {total}件",

    classificationBatchProgress:
      "全在庫 {total}件 / 確認済み {confirmed}件 / AI判定 {from}〜{to} / {aiTotal}件（バッチ {batch}/{batches}）",

    classificationProcessing:
      "処理中：{done}/{total}件（確認済み {confirmed}件 / 記憶候補 {memory}件 / AI処理済み {aiDone}/{aiTotal}件）",

    classificationAllComplete:
      "全在庫判定完了：{done}/{total}件（確認済み {confirmed}件 / 記憶候補 {memory}件 / AI判定 {ai}件）",

    classificationAllErrorPartial:
      "全在庫判定エラー：{error}。途中までの結果は画面に残しています。",

    parallelProcessingError:
      "並列処理 {index}: {error}",

    parallelResultCountMismatch:
      "並列処理 {index}: 入力 {input}件に対して結果 {output}件でした。",

    batchResultCountMismatch:
      "バッチ {batch}/{batches}: 入力 {input}件に対して結果 {output}件でした。",

    classificationWineMissing:
      "保存するワイン情報を取得できませんでした。",

    existingClassificationCheckFailed:
      "既存分類の確認に失敗しました: {error}",

    classificationUpdateFailed:
      "分類の更新に失敗しました: {error}",

    classificationSaveFailed:
      "分類の保存に失敗しました: {error}",

    classificationSavedConfirmed:
      "確認済みとして保存しました：{wine}",

    classificationConfirmedSaveFailed:
      "確認済みデータの保存に失敗しました。\n{error}",

  },

  EN: {
    language: "Language",

    appTitle:
      "AI Wine Inventory Management",

    appDescription:
      "Upload a PDF or photo. AI analyzes the document and automatically prepares the products for inventory.",

    installTitle:
      "Use on iPhone / iPad",

    installDescription:
      "Open the application in Safari and choose “Add to Home Screen” from the Share menu.",

    installStep1:
      "Open the application URL in Safari",

    installStep2:
      "Tap the Share button",

    installStep3:
      "Choose “Add to Home Screen”",

    installStep4:
      "Launch the application from the BON PINARD icon",

    section1Title:
      "1. Select a PDF or photo",

    analyzing:
      "AI analysis in progress...",

    analyzeAndRegister:
      "Analyze with AI and prepare inventory",

    addManualRow:
      "Add row manually",

    section2Title:
      "2. Invoice information",

    supplier:
      "Supplier",

    company:
      "Company",

    invoiceNumber:
      "Invoice number",

    invoiceDate:
      "Invoice date",

    section3Title:
      "3. Original document and AI extraction",

    section3Description:
      "View the original document on the left and verify vintage, quantity and unit price on the right.",

    sourceDocument:
      "Original PDF / Photo",

    openNewTab:
      "Open in new tab",

    imageFile:
      "Photo / Image",

    noPreview:
      "Select a PDF or photo to display the original document here.",

    extractedInventory:
      "AI extraction / Inventory details",

    stockBottles:
      "Bottles",

    amountHT:
      "Amount excl. tax",

    productCount:
      "Products",

    needsReview:
      "Needs review",

    exportExcel:
      "Export Excel",

    exportCSV:
      "Export CSV",

    exportMasters:
      "Export master data",

    saveDevice:
      "Save on device",

    saveSupabase:
      "Save to Supabase",

    clearAI:
      "Clear AI results",

    clearAIConfirm:
      "Clear the AI extraction results?",

    noAIResults:
      "No AI extraction results yet.",

    status:
      "Status",

    statusConfirmed:
      "Confirmed",

    statusNeedsCheck:
      "Needs review",

    statusManual:
      "Manual entry",

    action:
      "Action",

    delete:
      "Delete",

    stockDate:
      "Stock-in date",

    producer:
      "Producer",

    cuvee:
      "Cuvée",

    originalProductName:
      "Original product name",

    color:
      "Color",

    vintage:
      "Vintage",

    bottleSize:
      "Bottle size",

    alcohol:
      "Alcohol",

    quantity:
      "Quantity",

    unitPriceHT:
      "Unit price excl. tax",

    memo:
      "Note",

    section4Title:
      "4. Current inventory",

    section4Description:
      "Current inventory stored in Supabase",

    refreshInventory:
      "Refresh inventory",

    classifying:
      "AI classification in progress...",

    classifyTest:
      "AI geographic classification — 20-wine test",

    classifyAll:
      "AI geographic classification — all inventory",

    wineName:
      "Wine name",

    country:
      "Country",

    region:
      "Region",

    subregion:
      "Subregion",

    appellation:
      "Appellation",

    cruLevel:
      "Classification",

    category:
      "Category",

    confidence:
      "Confidence",

    classificationConfirmed:
      "Confirmed",

    manualCorrection:
      "Manual correction",

    memoryCandidate:
      "Memory candidate",

    aiClassification:
      "AI classification",

    saving:
      "Saving...",

    saved:
      "Saved",

    markConfirmed:
      "Mark as confirmed",

    categorySparkling:
      "Sparkling",

    categoryWhite:
      "White",

    categoryRose:
      "Rosé",

    categoryRed:
      "Red",

    categorySpirit:
      "Spirits",

    wineTypes:
      "Wine references",

    currentStockBottles:
      "Bottles in stock",

    inventoryCostHT:
      "Inventory cost excl. tax",

    inventorySearchPlaceholder:
      "Search producer, cuvée, vintage or color",

    displayed:
      "Showing",

    wineTypesUnit:
      "references",

    cuveeWineName:
      "Cuvée / Wine",

    costHT:
      "Cost excl. tax",

    noMatchingInventory:
      "No matching inventory.",
    unknownError:
      "Unknown error",

    loginUserUnavailable:
      "Unable to retrieve the signed-in user.",

    companyInfoUnavailable:
      "Unable to retrieve company information.",

    confirmedClassificationFetchFailed:
      "Failed to load confirmed classifications: {error}",

    savedAiCandidateFetchFailed:
      "Failed to load saved AI candidates: {error}",

    aiCandidateTempSaveFailed:
      "Failed to temporarily save AI candidates: {error}",

    classificationTestTargetsMissing:
      "Unable to retrieve all 20 wines for the multi-region test: {found}/20.",

    classificationSearchingConfirmed:
      "Searching confirmed data... {total} wines",

    classificationAiRunning:
      "Confirmed {confirmed} / AI classification {ai} wines",

    classificationComplete:
      "Classification complete: {total} wines (confirmed {confirmed} / memory {memory} / AI {ai})",

    classificationError:
      "Classification error: {error}",

    noClassifiableInventory:
      "There are no inventory wines available for AI classification.",

    classifyAllConfirm:
      "Run AI geographic classification on all {total} wines in batches of 20.\nThe OpenAI API will be used. Start?",

    classificationAllSearchingConfirmed:
      "Searching confirmed data for all inventory... {total} wines",

    classificationBatchProgress:
      "Total {total} / confirmed {confirmed} / AI {from}–{to} / {aiTotal} (batch {batch}/{batches})",

    classificationProcessing:
      "Processing: {done}/{total} wines (confirmed {confirmed} / memory {memory} / AI processed {aiDone}/{aiTotal})",

    classificationAllComplete:
      "Full inventory classification complete: {done}/{total} wines (confirmed {confirmed} / memory {memory} / AI {ai})",

    classificationAllErrorPartial:
      "Full inventory classification error: {error}. Results completed so far remain displayed.",

    parallelProcessingError:
      "Parallel request {index}: {error}",

    parallelResultCountMismatch:
      "Parallel request {index}: {input} inputs but {output} results were returned.",

    batchResultCountMismatch:
      "Batch {batch}/{batches}: {input} inputs but {output} results were returned.",

    classificationWineMissing:
      "Unable to retrieve the wine information to save.",

    existingClassificationCheckFailed:
      "Failed to check the existing classification: {error}",

    classificationUpdateFailed:
      "Failed to update the classification: {error}",

    classificationSaveFailed:
      "Failed to save the classification: {error}",

    classificationSavedConfirmed:
      "Saved as confirmed: {wine}",

    classificationConfirmedSaveFailed:
      "Failed to save the confirmed data.\n{error}",

  },
} as const;

/* Additional translations for Sections 5–7 and dynamic UI messages. */
const EXTRA_UI_I18N = {
  FR: {
    duplicateWarning: "Doublon possible : facture {invoice} / {producer} / {wine} / {vintage}",
    wineListLoading: "Chargement de la carte des vins...",
    wineListFetchFailed: "Échec du chargement de la carte des vins : {error}",
    wineListLoaded: "Carte des vins chargée : {total} vins ({listed} à la carte)",
    wineListFetchError: "Erreur de chargement de la carte des vins : {error}",
    wineInfoUnavailable: "Impossible de récupérer les informations du vin.",
    salePricePositive: "Veuillez saisir un prix de vente supérieur à 0.",
    salePriceSaveUnavailable: "Impossible d'enregistrer le prix de vente.",
    salePriceSaved: "Prix de vente enregistré : {producer} {vintage} / {price} €",
    salePriceSaveFailed: "Échec de l'enregistrement du prix de vente.\n{error}",
    listingStateSaveUnavailable: "Impossible d'enregistrer le statut de publication.",
    listingNeedsPrice: "Définissez d'abord un prix de vente avant d'ajouter ce vin à la carte.",
    listingNeedsClassification: "Le vin doit être classifié avant sa publication.",
    wineListUnclassified: "Non classifié",
    wineListed: "Vin ajouté à la carte : {producer} {vintage}",
    wineUnlisted: "Vin retiré de la carte : {producer} {vintage}",
    listingStateSaveFailed: "Échec de l'enregistrement du statut de publication.\n{error}",
    section5Title: "5. Compléter les cuvées (IA)",
    section5Description: "L’IA extrait des propositions de cuvée à partir du libellé original des factures. Vous pouvez limiter la sélection avec la recherche de la section 4 (par exemple CHAMPAGNE), puis vérifier, corriger et enregistrer chaque proposition. wines.cuvee sera mis à jour et utilisé dans la carte des vins.",
    cuveeNoTarget: "Aucun vin à traiter. Vérifiez le filtre de recherche ou actualisez d'abord le stock.",
    cuveeExtractProgress: "Extraction IA des cuvées : {from}–{to} / {total}",
    cuveeProducerSameFilteredNote: "Proposition IA identique au nom du producteur : supprimée automatiquement.",
    cuveeExtractComplete: "Extraction IA terminée : {total} vins (vérifiez puis enregistrez les résultats)",
    cuveeExtractFailed: "Échec de l'extraction des cuvées : {error}",
    cuveeSaveInfoMissing: "Impossible de récupérer la proposition de cuvée à enregistrer.",
    cuveeSaveFailed: "Échec de l'enregistrement de la cuvée : {error}",
    cuveeNoValidSuggestions: "Aucune proposition de cuvée valide à enregistrer.",
    cuveeBulkConfirm: "Enregistrer {total} propositions de cuvée valides en une seule fois.\nLes vins « sans correspondance » ne seront pas modifiés.\n\nEnregistrer ?",
    cuveeBulkSaving: "Enregistrement des cuvées valides : {current}/{total}",
    cuveeBulkComplete: "Enregistrement terminé pour {total} propositions de cuvée valides.",
    cuveeExtracting: "Extraction IA...",
    cuveeExtractButton: "Extraction IA des cuvées ({total} vins affichés)",
    cuveeBulkSaveButton: "Enregistrer les propositions valides ({total})",
    currentCuvee: "Cuvée actuelle",
    aiSuggestedCuvee: "Cuvée proposée par l’IA",
    noApplicable: "(aucune)",
    aiSuggestion: "Proposition IA",
    saveAction: "Enregistrer",
    unsaved: "Non enregistré",
    changing: "Modification...",
    moveToUnlisted: "Retirer de la carte",
    listWine: "Ajouter à la carte",
    section6Title: "6. Doublons possibles",
    section6Description: "Affiche les vins dont le producteur, le millésime et le format de bouteille correspondent (les vins avec un stock à 0 sont exclus). « Fusionner comme même vin » vérifie les conflits de classification confirmée et de prix manuel, puis rattache les lignes d’achat et les mouvements de stock au Master via la RPC atomique merge_wines de Supabase. Les quantités ne sont pas additionnées directement : l’historique est rattaché à un seul wine_id, donc le nombre total de bouteilles et la valeur du stock restent inchangés.",
    exactMatch: "Correspondance 100 %",
    highProbability: "Forte probabilité",
    countUnit: "vins",
    filtering: "Filtre actif",
    exactReviewRestore: "Revenir à l'affichage normal des correspondances 100 %",
    exactReviewStart: "Vérifier les correspondances 100 % une par une",
    remaining: "Restant : {total}",
    noPendingDuplicates: "Aucun doublon non traité.",
    noFilterDuplicates: "Aucun doublon ne correspond à ce filtre.",
    unknownProducer: "Producteur inconnu",
    nvBlank: "NV / vide",
    candidates: "Candidats : {total}",
    judgment: "Évaluation",
    stockQty: "Stock",
    costPerBottle: "Coût HT/bouteille",
    reference: "Référence",
    merged: "Fusionné",
    merging: "Fusion...",
    mergeSameWine: "Fusionner comme même vin",
    cancelDifferentWine: "Annuler « vin différent »",
    differentWine: "Vin différent",
    duplicateHigh: "Forte probabilité",
    duplicateMedium: "À vérifier",
    duplicateLow: "Différent",
    duplicateDecisionSaveFailed: "Échec de l'enregistrement du statut « vin différent » : {error}",
    duplicateDecisionSaved: "Le statut « vin différent » a été enregistré dans Supabase.",
    duplicateDecisionCancelFailed: "Échec de l'annulation du statut « vin différent » : {error}",
    duplicateDecisionCancelled: "Le statut « vin différent » a été annulé.",
    duplicateDecisionGenericFailed: "Échec de l'enregistrement du statut « vin différent ».",
    mergeChecking: "Vérification du contenu de la fusion...",
    classificationFetchFailed: "Échec du chargement des informations de classification : {error}",
    wineIdUnavailable: "Impossible de récupérer le wine_id.",
    mergeClassificationConflict: "Fusion annulée.\n\nLes deux vins ont une classification confirmée, mais les éléments suivants sont contradictoires :\n\n{conflicts}\n\nVérifiez qu’il s’agit bien du même vin et corrigez la classification si nécessaire avant de réessayer.",
    priceNotSet: "non défini",
    priceConflictPrompt: "Conflit de prix.\n\n{masterProducer} (Master) : {masterPrice} €\n{otherProducer} : {otherPrice} €\n\nOK = conserver le prix de {otherProducer}\nAnnuler = conserver le prix de {masterProducer}",
    masterKeepLine: "Master (conserver) : {producer} {vintage} / {wine}",
    mergedLine: "Fusionné dans le Master : {producer} {vintage} / {wine}",
    similarityLine: "Similarité : {similarity}",
    classificationInheritLine: "Classification : reprendre la classification confirmée de {producer} ({appellation})",
    classificationKeepLine: "Classification : conserver la classification confirmée du Master",
    classificationNoChangeLine: "Classification : aucune modification (relancez ensuite la classification IA et la confirmation)",
    priceAdoptLine: "Prix : utiliser {price} €",
    priceKeepLine: "Prix : conserver le prix du Master",
    mergeConfirm: "Exécuter la fusion avec les paramètres suivants ?\n\n{summary}",
    mergeRunning: "Fusion en cours...",
    mergeRpcFailed: "Échec de la fusion : {error}",
    mergeCompleteQty: "Fusion terminée : la quantité de stock a été correctement conservée ({qty} bouteilles).",
    mergeQtyMismatch: "La fusion est terminée, mais la quantité avant et après ne correspond pas. Vérifiez immédiatement. (avant : {before} bouteilles → après : {after} bouteilles)",
    mergeFailed: "Échec de la fusion.\n{error}",
    savedAndMasterUpdated: "Enregistré. Les historiques des référentiels ont également été mis à jour.",
    existingInvoiceCheckFailed: "Échec de la vérification de la facture existante.",
    invoiceSaveFailed: "Échec de l'enregistrement de la facture dans Supabase.",
    itemCheckFailed: "Échec de la vérification des lignes de facture.",
    invoiceAlreadySaved: "Les lignes de cette facture sont déjà enregistrées dans Supabase.",
    wineMasterSearchFailed: "Échec de la recherche dans le référentiel des vins.",
    wineMasterInsertFailed: "Échec de l'ajout au référentiel des vins.",
    purchaseItemsSaveFailed: "Échec de l'enregistrement des lignes de produits.",
    stockMovementSaveFailed: "Échec de l'enregistrement des mouvements d'entrée en stock.",
    supabaseSaved: "Enregistré dans Supabase.\nFacture : {invoice}\nLignes : {items}",
    selectPdfOrPhoto: "Veuillez sélectionner un PDF ou une photo.",
    aiJudging: "Analyse IA en cours...",
    aiAnalysisFailed: "Échec de l'analyse IA.",
    itemsAutoRegistered: "{total} produits ont été préparés pour le stock. Vérifiez le contenu.",
    genericError: "Erreur : {error}",
    stockSheetName: "Stock",
    inventoryFileBase: "BON_PINARD_AI_stock",
    supplierMasterSheet: "Référentiel fournisseurs",
    wineMasterSheet: "Référentiel vins",
    priceHistorySheet: "Historique prix d’achat",
    masterHistoryFileBase: "BON_PINARD_historique_referentiels",
    section7Title: "7. Carte des vins",
    section7Description: "Par région, catégorie et producteur",
    loadingShort: "Chargement...",
    refreshWineList: "Actualiser la carte des vins",
    allData: "Toutes les données",
    listedWines: "Vins à la carte",
    unlistedWines: "Hors carte",
    displayMode: "Mode d'affichage",
    wineListHeaderSettingsTitle: "Titre de la carte des vins",
    wineListHeaderTitleLabel: "Titre principal",
    wineListHeaderSubtitleLabel: "Sous-titre",
    wineListHeaderHint: "Ces deux textes sont libres. Laissez le sous-titre vide pour ne pas l’afficher.",
    wineListHeaderSave: "Enregistrer le titre",
    wineListHeaderSaved: "Titre de la carte des vins enregistré.",
    wineListHeaderLoadFailed: "Échec du chargement du titre de la carte : {error}",
    wineListHeaderSaveFailed: "Échec de l’enregistrement du titre de la carte : {error}",
    wineListLanguageLabel: "Langue de la carte",
    wineListA4PdfPrint: "PDF A4 / Imprimer",
    wineListA4PdfHint: "A4 compact sur 2 colonnes. Les espacements des titres sont réduits et les prix utilisent la virgule en français. Choisissez « Enregistrer au format PDF ».",
    wineListPrintWindowBlocked: "Impossible d’ouvrir la fenêtre d’impression. Autorisez les fenêtres contextuelles pour cette application.",

    inventoryEdit: "Modifier",
    inventoryEditTitle: "Modifier le vin / Ajuster le stock",
    inventoryEditCurrentQty: "Stock actuel",
    inventoryEditNewQty: "Nouveau stock",
    inventoryEditDifference: "Écart",
    inventoryEditNote: "Motif / Note",
    inventoryEditNotePlaceholder: "Ex. inventaire physique, casse, correction...",
    inventoryEditSave: "Enregistrer",
    inventoryEditCancel: "Annuler",
    inventoryEditSaving: "Enregistrement...",
    inventoryEditSaved: "Vin et stock mis à jour.",
    inventoryEditInvalidQty: "Saisissez un stock valide supérieur ou égal à 0.",
    inventoryEditUnavailable: "Impossible de récupérer les informations du vin.",
    inventoryEditSaveFailed: "Échec de la modification du stock : {error}",
    inventoryEditReasonLabel: "Motif de l'ajustement",
    inventoryEditReasonSelect: "Sélectionner un motif",
    inventoryReasonInventoryCount: "Inventaire (comptage)",
    inventoryReasonSaleCorrection: "Correction de vente",
    inventoryReasonBreakage: "Casse",
    inventoryReasonLoss: "Perte",
    inventoryReasonTasting: "Dégustation / service",
    inventoryReasonPurchaseCorrection: "Correction de réception",
    inventoryReasonOther: "Autre",
    inventoryEditUnsavedBadge: "Non enregistré",
    inventoryEditConfirmQtyChange:
      "{wine}\nModifier le stock de {from} à {to} bouteille(s) ?",
    inventoryEditConfirmReasonLine: "Motif : {reason}",
    inventoryEditConfirmNoteLine: "Note : {note}",
    inventoryEditReasonRequired:
      "Veuillez sélectionner un motif lorsque vous modifiez le stock.",
    inventoryEditOtherNoteRequired:
      "Veuillez saisir une note lorsque vous sélectionnez « Autre ».",
    inventoryEditRequiredLabel: "*",
    inventorySortLabel: "Trier",
    inventorySortProducerAsc: "Producteur A→Z",
    inventorySortVintageDesc: "Millésime récent→ancien",
    inventorySortVintageAsc: "Millésime ancien→récent",
    inventorySortQtyAsc: "Stock croissant",
    inventorySortQtyDesc: "Stock décroissant",
    inventorySortCostDesc: "Coût décroissant",
    inventorySortCostAsc: "Coût croissant",
    inventoryFilterLabel: "Filtrer le stock",
    inventoryFilterAll: "Tous",
    inventoryFilterInStock: "En stock",
    inventoryFilterZero: "Rupture (0)",
    inventoryFilterOne: "Stock = 1",
    inventoryFilterTwoOrFewer: "Stock ≤ 2",
    inventoryShowZeroStock:
      "Afficher aussi les vins en rupture de stock",
    inventoryHideChecked: "Masquer les vins vérifiés",
    inventoryStocktakeMarkChecked: "Vérifié",
    inventoryStocktakeUndoCheck: "Annuler la vérification",
    inventoryStocktakeCheckedBadge: "Vérifié le {date}",
    inventoryStocktakeUncheckedCount: "Non vérifiés {count}",
    inventoryStocktakeCheckedCount: "Vérifiés {count}",
    inventoryStocktakeSaveFailed:
      "Échec de l'enregistrement de la vérification.\n{error}",
    inventoryStocktakeResetAll:
      "Réinitialiser toutes les vérifications",
    inventoryStocktakeResetAllConfirm:
      "Toutes les vérifications de stock de cette société vont être réinitialisées.\nLes quantités en stock et l'historique des mouvements ne seront pas modifiés.\nContinuer ?",
    inventoryStocktakeResetAllFailed:
      "Échec de la réinitialisation des vérifications.\n{error}",
    wineReviewTitle: "À vérifier / non classés",
    wineReviewSummary:
      "{count} vins en stock sans région ou catégorie. Ils n'apparaissent pas dans les filtres région / catégorie.",
    wineReviewAutoClassify: "Classer automatiquement",
    wineReviewClassifying: "Classification en cours... {done}/{total}",
    wineReviewClassified:
      "Propositions prêtes : {total} vins. Vérifiez, corrigez puis enregistrez.",
    wineReviewAiFailed:
      "La classification IA a échoué pour une partie des vins ; seules les règles (couleur / mots-clés) ont été utilisées pour ceux-ci.\n{error}",
    wineReviewRegion: "Région",
    wineReviewCategory: "Catégorie",
    wineReviewSource: "Origine",
    wineReviewSourceColor: "Couleur",
    wineReviewSourceRule: "Règle",
    wineReviewSourceAi: "IA",
    wineReviewSourceExisting: "Existant",
    wineReviewSourceNone: "—",
    wineReviewExistingRow: "Classement existant",
    wineReviewIncomplete: "Région et catégorie requises",
    wineReviewSelectAll: "Tout sélectionner",
    wineReviewSaveSelected: "Enregistrer la sélection ({count})",
    wineReviewDiscard: "Abandonner les propositions",
    wineReviewSaveConfirm:
      "Enregistrer la classification de {count} vins cochés ?\nLes prix, l'affichage sur la carte et les quantités en stock ne seront pas modifiés.",
    wineReviewSaveFailed:
      "Échec de l'enregistrement de la classification.\n{error}",
    wineReviewSaved: "Classification enregistrée : {count} vins.",
    winePricingTitle: "Prix non définis",
    winePricingSummary:
      "Vins classés, en stock, sans prix de vente : {count}. Seul le prix est enregistré ; l'affichage sur la carte n'est pas modifié.",
    winePricingRuleHint:
      "Règle : coût HT × 1,2 × 2 (= ×2,4), arrondi au multiple de 5 € supérieur.",
    winePricingLoading: "Chargement des vins actifs...",
    winePricingOnlyUnpriced: "Prix non définis uniquement",
    winePricingListingAll: "Tous",
    winePricingListingListed: "Affichés uniquement",
    winePricingListingUnlisted: "Non affichés uniquement",
    winePricingRegionAll: "Toutes les régions",
    winePricingCategoryAll: "Toutes les catégories",
    winePricingStock: "Stock",
    winePricingCost: "Coût HT",
    winePricingCurrentPrice: "Prix actuel",
    winePricingRecommended: "Prix de vente",
    winePricingRatio: "Coef.",
    winePricingListing: "Carte",
    winePricingListed: "Affiché",
    winePricingUnlisted: "Non affiché",
    winePricingNeedsReview: "À vérifier",
    winePricingSelectAll: "Tout sélectionner",
    winePricingDeselectAll: "Tout désélectionner",
    winePricingRecalculate: "Recalculer les prix conseillés",
    winePricingSaveSelected: "Enregistrer la sélection ({count})",
    winePricingNoRows: "Aucun vin ne correspond aux filtres.",
    winePricingSaveConfirm:
      "Enregistrer le prix de vente de {count} vins cochés ?\nL'affichage sur la carte ne sera pas modifié.",
    winePricingSaved: "Prix enregistrés : {count} vins.",
    winePricingSavePartial:
      "Prix enregistrés : {saved} vins / échecs : {failed} vins.\n{error}",

    section8Title: "8. Déduire les bouteilles vendues par photo (IA)",
    section8Description: "Photographiez les bouteilles vendues après le service. L’IA lit les étiquettes et propose les vins correspondants dans le stock. Vérifiez toujours les correspondances avant de déduire les bouteilles.",
    soldBottleSelect: "Sélectionner / Photographier les bouteilles vendues",
    soldBottleAnalyze: "Analyser les bouteilles avec l’IA",
    soldBottleAnalyzing: "Analyse des bouteilles...",
    soldBottleNoFiles: "Sélectionnez au moins une photo.",
    soldBottleNoInventory: "Le stock est vide. Actualisez d’abord le stock.",
    soldBottleAiFailed: "Échec de l’analyse des bouteilles : {error}",
    soldBottleDetected: "Analyse terminée : {total} vin(s) détecté(s). Vérifiez les correspondances avant validation.",
    soldBottleAiRead: "Lecture IA",
    soldBottleMatchedInventory: "Vin du stock correspondant",
    soldBottleNoMatch: "Aucune correspondance sélectionnée",
    soldBottleQty: "Bouteilles vendues",
    soldBottleStock: "Stock",
    soldBottleConfidence: "Confiance IA",
    soldBottleApplyAll: "Déduire les bouteilles confirmées",
    soldBottleApplying: "Déduction en cours...",
    soldBottleNeedMatch: "Sélectionnez un vin du stock pour chaque ligne à déduire.",
    soldBottleInvalidQty: "La quantité vendue doit être supérieure à 0.",
    soldBottleOverStock: "La quantité à déduire dépasse le stock disponible pour {wine} : stock {stock}, demande {qty}.",
    soldBottleConfirm: "Déduire {qty} bouteille(s) du stock pour {lines} ligne(s) confirmée(s) ?",
    soldBottleApplied: "Stock mis à jour : {qty} bouteille(s) déduite(s).",
    soldBottleSaleNote: "Vente détectée par photo IA",
    soldBottleClear: "Effacer les résultats",
    soldBottleSearchLabel: "Rechercher dans le stock",
    soldBottleSearchPlaceholder: "ex. chambertin 1972",
    soldBottleSearchNoResults: "Aucun vin trouvé.",
    soldBottleSearchSelected: "Sélectionné par recherche",
    soldBottleConfirmedCount: "Confirmés",
    soldBottleUnconfirmedCount: "À confirmer",
    soldBottleAllConfirmed: "Tout est confirmé",
    soldBottleConfirmRemaining: "{count} vin(s) à confirmer",
    soldBottleConfirmedBadge: "Confirmé",
    soldBottleUnconfirmedBadge: "À confirmer",

    stockHistoryTitle: "9. Historique des mouvements de stock",
    stockHistoryDescription:
      "Consultez l'historique des ventes, ajustements, entrées et annulations. Une vente ou un ajustement erroné peut être annulé en toute sécurité par une écriture inverse, sans jamais supprimer l'historique d'origine.",
    stockHistorySearchPlaceholder:
      "ex. roumier 2019, breakage...",
    stockHistoryDate: "Date",
    stockHistoryType: "Type",
    stockHistoryWine: "Vin",
    stockHistoryQuantity: "Quantité",
    stockHistoryCost: "Coût HT",
    stockHistoryNotes: "Notes",
    stockHistoryAction: "Action",
    stockMovementPurchase: "Entrée",
    stockMovementSale: "Vente",
    stockMovementAdjustment: "Ajustement",
    stockMovementReversal: "Annulation",
    stockHistoryTypeFilterLabel: "Type de mouvement",
    stockHistoryDateFilterLabel: "Période",
    stockHistoryDateAll: "Toutes",
    stockHistoryDateToday: "Aujourd'hui",
    stockHistoryDate7d: "7 derniers jours",
    stockHistoryDate30d: "30 derniers jours",
    stockHistoryAll: "Tous",
    stockHistoryLoadMore: "Afficher 100 de plus",
    stockHistoryLoading: "Chargement...",
    stockHistoryNoResults:
      "Aucun mouvement de stock ne correspond.",
    stockHistoryUndo: "Annuler",
    stockHistoryUndoing: "Annulation...",
    stockHistoryUndone: "Annulé",
    stockHistoryAlreadyUndone:
      "Ce mouvement a déjà été annulé.",
    stockHistoryUndoConfirm:
      "{wine}\nAnnuler {type} {qty} bouteille(s) ?\n\nStock :\n{from} → {to}\n\nConfirmer ?",
    stockHistoryUndoSuccess:
      "Mouvement de stock annulé.",
    stockHistoryUndoFailed:
      "Échec de l'annulation : {error}",
    stockHistoryUndoNegativeStock:
      "Cette annulation rendrait le stock négatif. Elle ne peut pas être effectuée.",
    stockHistoryReversalOfLabel:
      "↳ Annulation de {type} {qty}",
    stockHistoryReversalOfSale:
      "Annulation de la vente {qty}",
    stockHistoryReversalOfAdjustment:
      "Annulation de l'ajustement {qty}",
    stockHistoryReversalGeneric:
      "Annulation d'un mouvement de stock",
    stockHistoryOriginalNote:
      "Note d'origine : {note}",
    stockHistoryNotReversible:
      "Non annulable ici",
    todaySales: "Ventes du jour",
    todayAdjustments: "Ajustements du jour",
    todayReversals: "Annulations du jour",

    initialImportTitle:
      "10. Import du stock initial (réservé aux administrateurs)",
    initialImportDescription:
      "Importez le tableau Excel/CSV d'inventaire déjà utilisé par un nouveau client, sans lui demander de le réécrire dans un modèle. Rien n'est enregistré dans la base tant que l'import final n'est pas confirmé.",
    initialImportTargetCompany:
      "Société de destination",
    initialImportSelectCompanyPlaceholder:
      "Sélectionner une société...",
    initialImportSelectFile:
      "Fichier Excel / CSV du client",
    initialImportFileInfo:
      "{name} ({size})",
    initialImportAnalyze: "Analyser le fichier",
    initialImportAnalyzing: "Analyse en cours...",
    initialImportSelectCompanyFirst:
      "Veuillez d'abord sélectionner une société de destination.",
    initialImportSelectFileFirst:
      "Veuillez d'abord sélectionner un fichier.",
    initialImportAnalyzeFailed:
      "Échec de l'analyse du fichier.",
    initialImportSourceRows:
      "Lignes du fichier",
    initialImportRecognizedWines:
      "Vins reconnus",
    initialImportUniqueWines: "Vins uniques",
    initialImportTotalBottles:
      "Total bouteilles",
    initialImportCardHint:
      "Cliquez sur une carte pour afficher les données correspondantes.",
    initialImportReady: "Prêt",
    initialImportReview: "À vérifier",
    initialImportDuplicate: "Doublon",
    initialImportInvalid: "Invalide",
    initialImportSkip: "Ignoré",
    initialImportBillableUnits:
      "Références facturables (candidates) : {count}",
    initialImportExistingMatch:
      "Vin existant",
    initialImportNewWine: "Nouveau vin",
    initialImportClearMatch:
      "Enregistrer comme nouveau",
    initialImportImportButton:
      "Importer le stock initial",
    initialImportExistingInventoryWarning:
      "{company} a déjà {count} bouteille(s) en stock. L'import ajoutera ces quantités au stock existant.",
    initialImportConfirmExistingInventory:
      "Je confirme l'ajout au stock existant",
    initialImportConfirm:
      "Société :\n{company}\n\nFichier :\n{filename}\n\nVins à enregistrer :\n{wineCount}\n\nTotal bouteilles :\n{totalBottles}\n\nImporter ce stock initial ?",
    initialImportSuccess:
      "Stock initial importé avec succès.",
    initialImportCommitFailed:
      "Échec de l'import du stock initial.",
    initialImportNoReadyRows:
      "Aucune ligne \"Prêt\" à importer.",
    initialImportUnresolvedRows:
      "{count} ligne(s) à vérifier / en doublon / invalide(s) doivent être résolues avant l'import.",
    initialImportMustAcknowledgeExisting:
      "Veuillez confirmer l'ajout au stock existant avant de continuer.",
    initialImportRowInvalid:
      "Cette ligne doit avoir un nom de vin et une quantité entière positive avant de passer à \"Prêt\".",
    initialImportAlreadyImported:
      "Ce fichier a déjà été importé pour cette société.",
    initialImportLoadCompaniesFailed:
      "Échec du chargement de la liste des sociétés.",
    initialImportPreviewTitle:
      "Aperçu ({count} ligne(s))",
    initialImportSearchPlaceholder:
      "Rechercher producteur, vin, millésime...",
    initialImportStatusFilterLabel:
      "Filtrer par statut",
    initialImportStatusAll: "Tous",
    initialImportColProducer: "Producteur",
    initialImportColWineName: "Vin",
    initialImportColCuvee: "Cuvée",
    initialImportColVintage: "Millésime",
    initialImportColColor: "Couleur",
    initialImportColSize: "Format",
    initialImportColQuantity: "Quantité",
    initialImportColCost: "Coût HT",
    initialImportColConfidence: "Confiance",
    initialImportColWarnings: "Avertissements",
    initialImportColMatch: "Correspondance",
    initialImportColAction: "Action",
    initialImportMarkReady:
      "Marquer \"Prêt\"",
    initialImportExportCsv:
      "Exporter le rapport (CSV)",
    initialImportResultTitle:
      "Import terminé",
    initialImportResultBatch: "Batch",
    initialImportResultCompany: "Société",
    initialImportResultWineCount:
      "Vins enregistrés",
    initialImportResultTotalBottles:
      "Total bouteilles",
    initialImportResultFile: "Fichier",

    customerAdminTitle:
      "11. Gestion des sociétés clientes (réservé aux administrateurs)",
    customerAdminDescription:
      "Créez de nouvelles sociétés clientes et suivez ici leur onboarding, leur statut contractuel et leur import initial. Aucune suppression n'est possible depuis cet écran ; pour mettre fin à un contrat, passez son statut à Résilié.",
    customerLoadFailed:
      "Échec du chargement des sociétés clientes.",
    customerNoResults:
      "Aucune société cliente correspondante.",
    customerNameRequired:
      "Le nom de la société est requis.",
    customerCompanyName: "Nom de la société",
    customerCompanyNamePlaceholder:
      "Nom de la nouvelle société",
    customerCreateButton:
      "Créer la société",
    customerCreating: "Création...",
    customerCreateSuccess:
      "Société cliente créée.",
    customerCreateFailed:
      "Échec de la création de la société cliente.",
    customerDuplicateWarningTitle:
      "Une société portant ce nom existe déjà",
    customerDuplicateWarningBody:
      "Sociétés existantes portant le même nom : {names}",
    customerConfirmCreateDuplicate:
      "Créer quand même",
    customerCancelDuplicate: "Annuler",
    customerSearchPlaceholder:
      "Rechercher par nom de société",
    customerContractFilterLabel:
      "Statut contractuel",
    customerOnboardingFilterLabel:
      "Statut d'onboarding",
    customerFilterAll: "Tous",
    customerContractProspect: "Prospect",
    customerContractTrial: "Essai",
    customerContractActive: "Actif",
    customerContractPaused: "En pause",
    customerContractCancelled: "Résilié",
    customerOnboardingNew: "Nouveau",
    customerOnboardingWaitingExcel:
      "En attente de l'Excel",
    customerOnboardingExcelReceived:
      "Excel reçu",
    customerOnboardingAnalyzing:
      "En cours d'analyse",
    customerOnboardingReadyToImport:
      "Prêt à importer",
    customerOnboardingImported: "Importé",
    customerOnboardingActive: "Actif",
    customerColCompany: "Société",
    customerColContractStatus:
      "Statut contractuel",
    customerColOnboardingStatus:
      "Statut d'onboarding",
    customerColWineCount: "Vins",
    customerColBottleCount:
      "Bouteilles",
    customerColImportCount: "Imports",
    customerColLatestImport:
      "Dernier import",
    customerColCreatedAt: "Créée le",
    customerColActions: "Actions",
    customerWineCount: "Types de vin",
    customerBottleCount:
      "Bouteilles en stock",
    customerImportCount:
      "Nombre d'imports initiaux",
    customerLatestImport:
      "Dernier import",
    customerLatestImportNone:
      "Aucun pour le moment",
    customerChargeableWineCount:
      "Vins facturables : {count}",
    customerCreatedAt: "Créée le",
    customerDetails: "Détails",
    customerDetailsTitle:
      "Détails de la société cliente",
    customerCompanyId: "ID de la société",
    customerCurrentStock: "Stock actuel",
    customerImportHistory:
      "Historique des imports initiaux",
    customerNoImportHistory:
      "Aucun import initial pour le moment.",
    customerOnboardingStatusLabel:
      "Statut d'onboarding",
    customerContractStatusLabel:
      "Statut contractuel",
    customerPlan: "Formule",
    customerInitialFee:
      "Frais initiaux (€)",
    customerMonthlyFee:
      "Frais mensuels (€)",
    customerInternalNotes:
      "Notes internes",
    customerSave: "Enregistrer",
    customerSaving: "Enregistrement...",
    customerSaveSuccess:
      "Société cliente mise à jour.",
    customerSaveFailed:
      "Échec de la mise à jour de la société cliente.",
    customerNoDeleteNotice:
      "Les sociétés ne peuvent pas être supprimées ici. Pour mettre fin à un contrat, passez son statut à Résilié.",
    customerClose: "Fermer",
    customerInitialImportDoneBadge:
      "Stock initial importé",

    customerUsersTitle:
      "12. Gestion et invitation des utilisateurs clients (réservé aux administrateurs)",
    customerUsersDescription:
      "Sélectionnez une société pour voir ses utilisateurs et en inviter de nouveaux par e-mail. Un e-mail d'invitation Supabase est envoyé ; aucun mot de passe n'est créé ici.",
    customerUsersCompany: "Société",
    customerUsersSelectCompanyPlaceholder:
      "Sélectionner une société...",
    customerUsersSelectCompanyPrompt:
      "Sélectionnez une société pour afficher ses utilisateurs.",
    customerUsersInviteEmail:
      "Adresse e-mail à inviter",
    customerUsersInviteHeading:
      "Inviter un utilisateur pour {company}",
    customerUsersInviteButton: "Inviter",
    customerUsersInviting: "Envoi en cours...",
    customerUsersSelectCompanyFirst:
      "Veuillez d'abord sélectionner une société.",
    customerUsersInvalidEmail:
      "Veuillez saisir une adresse e-mail valide.",
    customerUsersInviteFailed:
      "Échec de l'invitation de l'utilisateur.",
    customerUsersInviteSuccess:
      "Invitation envoyée.",
    customerUsersAlreadyMember:
      "Cet utilisateur appartient déjà à cette société.",
    customerUsersOtherCompany:
      "Cette adresse e-mail appartient à une autre société.",
    customerUsersNoProfileRow:
      "Cet utilisateur existe dans Supabase Auth, mais aucune ligne profiles n'a été trouvée. Résolution manuelle nécessaire.",
    customerUsersInvitedNotLinked:
      "L'e-mail d'invitation a été envoyé, mais l'affectation à la société a échoué. Vérifiez manuellement.",
    customerUsersLoadFailed:
      "Échec du chargement des utilisateurs.",
    customerUsersNoUsers:
      "Aucun utilisateur pour cette société.",
    customerUsersColEmail: "E-mail",
    customerUsersColCreatedAt: "Créé le",
    customerUsersColEmailConfirmed:
      "E-mail confirmé",
    customerUsersColLastSignIn:
      "Dernière connexion",
    customerUsersColStatus: "Statut",
    customerUsersColAction: "Action",
    customerUsersActive: "Actif",
    customerUsersInvited: "Invité",
    customerUsersUnconfirmed:
      "Non confirmé",
    customerUsersUnknownStatus: "Inconnu",
    customerUsersNever: "Jamais",
    customerUsersYes: "Oui",
    customerUsersNo: "Non",
    customerUsersResendInvite:
      "Renvoyer l'invitation",
    customerUsersResending: "Envoi...",
    customerUsersResendSuccess:
      "E-mail d'invitation renvoyé.",
    customerUsersResendFailed:
      "Échec du renvoi de l'invitation.",
    customerUsersAlreadyConfirmed:
      "Cet utilisateur a déjà confirmé son e-mail ; l'invitation ne peut pas être renvoyée.",
    customerUsersSendPasswordSetup:
      "Envoyer le lien de définition du mot de passe",
    customerUsersSendingPasswordSetup:
      "Envoi...",
    customerUsersPasswordSetupSuccess:
      "E-mail de définition du mot de passe envoyé.",
    customerUsersPasswordSetupFailed:
      "Échec de l'envoi de l'e-mail de définition du mot de passe.",
    customerUsersColRole: "Rôle",
    customerUsersInviteRoleLabel: "Rôle",
    customerUsersRoleOwner: "Propriétaire",
    customerUsersRoleStaff: "Employé",
    customerUsersRoleViewer: "Lecture seule",
    customerUsersRoleUpdateSuccess:
      "Rôle mis à jour.",
    customerUsersRoleUpdateFailed:
      "Échec de la mise à jour du rôle.",
    customerUsersLastOwnerProtection:
      "Impossible de modifier ce rôle : c'est le seul propriétaire de cette société.",
    viewerReadOnlyAction:
      "Votre rôle (lecture seule) ne permet pas cette action.",
    ownerOnlyAction:
      "Seul le propriétaire de la société peut effectuer cette action.",
    viewerBanner:
      "Lecture seule : ce compte ne peut pas modifier les données.",

    section16Title: "16. Sauvegarde / Export des données",
    section16Description:
      "Exportez à tout moment le stock actuel et l'historique des mouvements de stock au format Excel/CSV. Fonction en lecture seule, disponible pour owner, staff et viewer, sans jamais inclure les données d'une autre société.",
    exportCurrentInventoryExcel: "Stock actuel Excel",
    exportCurrentInventoryCsv: "Stock actuel CSV",
    exportFullBackupExcel: "Sauvegarde complète Excel",
    exportRunning: "Export en cours...",
    exportCompanyMissing:
      "Impossible de récupérer les informations de la société. Veuillez recharger la page et réessayer.",
    exportInventoryFetchFailed:
      "Échec de la récupération du stock actuel : {error}",
    exportMovementsFetchFailed:
      "Échec de la récupération de l'historique des mouvements : {error}",
    exportBuildFailed:
      "Échec de la création du fichier : {error}",
    exportNoInventoryData:
      "Aucune donnée de stock à exporter (tout le stock est à 0).",
    exportNoMovementsData:
      "Aucun historique de mouvement de stock à exporter.",
    exportInventorySuccess:
      "Export Excel du stock actuel terminé ({count} lignes).",
    exportInventoryCsvSuccess:
      "Export CSV du stock actuel terminé ({count} lignes).",
    exportFullBackupSuccess:
      "Sauvegarde complète Excel terminée (stock : {inventoryCount} / mouvements : {movementCount}).",

    section17Title: "17. Alertes de stock / Réapprovisionnement",
    section17Description:
      "Repérez en un coup d'œil les vins en rupture ou en stock faible. Tous les vins actifs (non fusionnés) de la société sont concernés ; le stock minimum et le stock cible sont facultatifs et se règlent vin par vin. Un vin sans réglage ne déclenche jamais d'alerte.",
    alertSummaryOutOfStock: "Rupture de stock",
    alertSummaryLowStock: "Stock faible",
    alertSummaryConfigured: "Alertes configurées",
    alertSummaryRecommendedOrder: "Bouteilles à recommander",
    alertColProducer: "Producteur",
    alertColWine: "Vin",
    alertColCuvee: "Cuvée",
    alertColVintage: "Millésime",
    alertColCurrentStock: "Stock actuel",
    alertColMinStock: "Stock minimum",
    alertColTargetStock: "Stock cible",
    alertColStatus: "État",
    alertColRecommendedOrder: "Réappro. recommandé",
    alertColAlert: "Alerte",
    alertColSave: "Enregistrer",
    alertStatusNotSet: "Non défini",
    alertStatusOff: "OFF",
    alertStatusOutOfStock: "Rupture de stock",
    alertStatusLowStock: "Stock faible",
    alertStatusOk: "OK",
    alertFilterLabel: "Filtre",
    alertFilterAll: "Toutes",
    alertFilterNeedsAction: "À traiter",
    alertFilterOutOfStock: "Rupture de stock",
    alertFilterLowStock: "Stock faible",
    alertFilterOk: "OK",
    alertFilterNotSet: "Non défini",
    alertFilterAlertEnabled: "Alertes configurées",
    alertFilterReorder: "Réappro. nécessaire",
    alertSearchPlaceholder: "ex. : chablis 2022",
    alertSearchNoResults: "Aucun vin correspondant trouvé.",
    alertRecommendedOrderNotSet: "—",
    alertMinQuantityLabel: "Stock minimum",
    alertTargetQuantityLabel: "Stock cible (facultatif)",
    alertEnabledLabel: "Activer l'alerte",
    alertSaveButton: "Enregistrer",
    alertSaving: "Enregistrement...",
    alertSaveSuccess: "Enregistré : {producer} {vintage}",
    alertSaveFailed: "Échec de l'enregistrement : {error}",
    alertInvalidMinQuantity:
      "Le stock minimum doit être un nombre supérieur ou égal à 0.",
    alertInvalidTargetQuantity:
      "Le stock cible doit être un nombre supérieur ou égal à 0, ou laissé vide.",
    alertTargetLessThanMin:
      "Le stock cible doit être supérieur ou égal au stock minimum.",
    alertCompanyMissing:
      "Impossible de récupérer les informations de la société. Veuillez recharger la page et réessayer.",
    alertWinesFetchFailed:
      "Échec de la récupération des vins : {error}",
    alertInventoryFetchFailed:
      "Échec de la récupération du stock actuel : {error}",
    alertSettingsFetchFailed:
      "Échec de la récupération des paramètres d'alerte : {error}",
    alertLoading: "Chargement...",
    alertNoResults: "Aucun vin ne correspond à ces critères.",
    alertRefresh: "Actualiser",
  },
  JA: {
    duplicateWarning: "重複の可能性: 伝票 {invoice} / {producer} / {wine} / {vintage}",
    wineListLoading: "ワインリストを読み込み中...",
    wineListFetchFailed: "ワインリスト取得に失敗しました: {error}",
    wineListLoaded: "ワインリスト読込完了：{total}件（掲載 {listed}件）",
    wineListFetchError: "ワインリスト取得エラー：{error}",
    wineInfoUnavailable: "ワイン情報を取得できませんでした。",
    salePricePositive: "販売価格は0より大きい数字を入力してください。",
    salePriceSaveUnavailable: "販売価格を保存できませんでした。",
    salePriceSaved: "販売価格を保存しました：{producer} {vintage} / {price} €",
    salePriceSaveFailed: "販売価格の保存に失敗しました。\n{error}",
    listingStateSaveUnavailable: "掲載状態を保存できませんでした。",
    listingNeedsPrice: "掲載するには販売価格を先に設定してください。",
    listingNeedsClassification: "地域分類後に掲載できます。",
    wineListUnclassified: "未分類",
    wineListed: "ワインリストへ掲載しました：{producer} {vintage}",
    wineUnlisted: "ワインリストから非掲載にしました：{producer} {vintage}",
    listingStateSaveFailed: "掲載状態の保存に失敗しました。\n{error}",
    section5Title: "5. キュヴェ名補完（AI）",
    section5Description: "仕入伝票の原文からキュヴェ名候補をAIが抽出します。「4. 全在庫一覧」の検索欄で絞り込んでから実行すると対象を限定できます（例：CHAMPAGNEで検索）。内容を確認・修正し、1件ずつ保存するとwines.cuveeが更新され、お客様向けワインリストに反映されます。",
    cuveeNoTarget: "対象のワインがありません。検索条件を確認するか、先に在庫を更新してください。",
    cuveeExtractProgress: "AIキュヴェ抽出中 {from}〜{to} / {total}件",
    cuveeProducerSameFilteredNote: "AI提案が生産者名と同一のため自動除外。",
    cuveeExtractComplete: "AIキュヴェ抽出完了：{total}件（内容を確認して保存してください）",
    cuveeExtractFailed: "キュヴェ抽出に失敗しました：{error}",
    cuveeSaveInfoMissing: "保存するキュヴェ情報を取得できませんでした。",
    cuveeSaveFailed: "キュヴェの保存に失敗しました：{error}",
    cuveeNoValidSuggestions: "保存できる有効なキュヴェ提案はありません。",
    cuveeBulkConfirm: "有効なキュヴェ提案 {total}件を一括保存します。\n「該当なし」のワインは変更しません。\n\n保存しますか？",
    cuveeBulkSaving: "有効キュヴェを保存中 {current}/{total}件",
    cuveeBulkComplete: "有効なキュヴェ提案 {total}件の保存処理が完了しました。",
    cuveeExtracting: "AI抽出中...",
    cuveeExtractButton: "AIキュヴェ抽出（表示中{total}件）",
    cuveeBulkSaveButton: "有効提案を一括保存（{total}件）",
    currentCuvee: "現在のcuvee",
    aiSuggestedCuvee: "AI提案キュヴェ",
    noApplicable: "（該当なし）",
    aiSuggestion: "AI提案",
    saveAction: "保存",
    unsaved: "未保存",
    changing: "変更中...",
    moveToUnlisted: "非掲載へ",
    listWine: "掲載する",
    section6Title: "6. 重複ワイン候補",
    section6Description: "生産者・ヴィンテージ・ボトルサイズが一致する在庫を候補として一覧表示します（在庫数0のワインは含みません）。「同じワインとして統合」を押すと、確認済み分類・手動価格の競合チェックを行った上で、Supabase側のアトミックなRPC（merge_wines）で仕入明細・在庫移動をMasterへ付け替えます。数量を直接足すのではなく履歴を1つのwine_idへ寄せる方式のため、統合前後で総本数・在庫金額は変わりません。",
    exactMatch: "100%一致",
    highProbability: "高確率",
    countUnit: "件",
    filtering: "絞り込み中",
    exactReviewRestore: "100%一致を通常表示に戻す",
    exactReviewStart: "100%一致を1件ずつ確認",
    remaining: "残り {total}件",
    noPendingDuplicates: "未処理の重複候補はありません。",
    noFilterDuplicates: "この条件に該当する重複候補はありません。",
    unknownProducer: "生産者不明",
    nvBlank: "NV・空欄",
    candidates: "候補 {total}件",
    judgment: "判定",
    stockQty: "在庫数",
    costPerBottle: "原価HT/本",
    reference: "基準",
    merged: "統合済み",
    merging: "統合中...",
    mergeSameWine: "同じワインとして統合",
    cancelDifferentWine: "別ワインを取消",
    differentWine: "別ワイン",
    duplicateHigh: "高確率",
    duplicateMedium: "要確認",
    duplicateLow: "別物",
    duplicateDecisionSaveFailed: "別ワイン判定の保存に失敗しました: {error}",
    duplicateDecisionSaved: "別ワイン判定をSupabaseへ保存しました。",
    duplicateDecisionCancelFailed: "別ワイン判定の取消に失敗しました: {error}",
    duplicateDecisionCancelled: "別ワイン判定を取り消しました。",
    duplicateDecisionGenericFailed: "別ワイン判定の保存に失敗しました。",
    mergeChecking: "統合内容を確認中...",
    classificationFetchFailed: "分類情報の取得に失敗しました: {error}",
    wineIdUnavailable: "wine_idを取得できませんでした。",
    mergeClassificationConflict: "統合を中止しました。\n\n両方とも確認済み分類ですが、次の項目が矛盾しています。\n\n{conflicts}\n\n同じワインかを確認し、必要なら分類を修正してから再度お試しください。",
    priceNotSet: "未設定",
    priceConflictPrompt: "価格が競合しています。\n\n{masterProducer}（Master候補）: {masterPrice} €\n{otherProducer}: {otherPrice} €\n\nOK = {otherProducer}側の価格を残す\nキャンセル = {masterProducer}側の価格を残す",
    masterKeepLine: "Master（残す）: {producer} {vintage} / {wine}",
    mergedLine: "統合される: {producer} {vintage} / {wine}",
    similarityLine: "類似度: {similarity}",
    classificationInheritLine: "分類: {producer}側の確認済み分類を引き継ぎます（{appellation}）",
    classificationKeepLine: "分類: Master側の確認済み分類を維持します",
    classificationNoChangeLine: "分類: 変更しません（後でAI判定・確認をやり直してください）",
    priceAdoptLine: "価格: {price} € を採用します",
    priceKeepLine: "価格: Master側の価格を維持します",
    mergeConfirm: "以下の内容で統合を実行します。よろしいですか？\n\n{summary}",
    mergeRunning: "統合を実行中...",
    mergeRpcFailed: "統合に失敗しました: {error}",
    mergeCompleteQty: "統合完了：在庫数量は正しく引き継がれました（{qty}本）。",
    mergeQtyMismatch: "統合は完了しましたが、統合前後で数量が一致しませんでした。至急ご確認ください。（統合前 合計{before}本 → 統合後 {after}本）",
    mergeFailed: "統合に失敗しました。\n{error}",
    savedAndMasterUpdated: "保存しました。マスター履歴も更新しました。",
    existingInvoiceCheckFailed: "既存伝票の確認に失敗しました。",
    invoiceSaveFailed: "Supabaseへの伝票保存に失敗しました。",
    itemCheckFailed: "明細の確認に失敗しました。",
    invoiceAlreadySaved: "この伝票の明細はすでにSupabaseに保存されています。",
    wineMasterSearchFailed: "ワインマスターの検索に失敗しました。",
    wineMasterInsertFailed: "ワインマスターへの登録に失敗しました。",
    purchaseItemsSaveFailed: "商品明細の保存に失敗しました。",
    stockMovementSaveFailed: "入庫履歴の保存に失敗しました。",
    supabaseSaved: "Supabaseへ保存しました。\n伝票：{invoice}\n商品明細：{items}件",
    selectPdfOrPhoto: "PDFまたは写真を選択してください",
    aiJudging: "AI判定中です...",
    aiAnalysisFailed: "AI判定に失敗しました",
    itemsAutoRegistered: "{total}件の商品を在庫へ自動登録しました。内容を確認してください。",
    genericError: "エラー: {error}",
    stockSheetName: "在庫表",
    inventoryFileBase: "BON_PINARD_AI在庫表",
    supplierMasterSheet: "仕入先マスター",
    wineMasterSheet: "ワインマスター",
    priceHistorySheet: "仕入価格履歴",
    masterHistoryFileBase: "BON_PINARD_マスター履歴",
    section7Title: "7. ワインリスト",
    section7Description: "地域・カテゴリー・生産者順",
    loadingShort: "読込中...",
    refreshWineList: "ワインリストを更新",
    allData: "全データ",
    listedWines: "掲載ワイン",
    unlistedWines: "非掲載",
    displayMode: "表示モード",
    wineListHeaderSettingsTitle: "ワインリストのタイトル設定",
    wineListHeaderTitleLabel: "メインタイトル",
    wineListHeaderSubtitleLabel: "サブタイトル",
    wineListHeaderHint: "ここは自由入力です。サブタイトルを空欄にすると、お客様表示では表示されません。",
    wineListHeaderSave: "タイトルを保存",
    wineListHeaderSaved: "ワインリストのタイトルを保存しました。",
    wineListHeaderLoadFailed: "ワインリストタイトルの読み込みに失敗しました: {error}",
    wineListHeaderSaveFailed: "ワインリストタイトルの保存に失敗しました: {error}",
    wineListLanguageLabel: "ワインリスト言語",
    wineListA4PdfPrint: "A4 PDF / 印刷",
    wineListA4PdfHint: "A4縦・2段組。文字サイズは維持したまま見出し余白を圧縮しています。印刷画面で「PDFに保存」を選ぶとPDFを作成できます。",
    wineListPrintWindowBlocked: "印刷画面を開けませんでした。このアプリのポップアップを許可してください。",

    inventoryEdit: "編集",
    inventoryEditTitle: "ワイン情報・在庫数を編集",
    inventoryEditCurrentQty: "現在庫",
    inventoryEditNewQty: "新しい在庫数",
    inventoryEditDifference: "増減",
    inventoryEditNote: "理由・メモ",
    inventoryEditNotePlaceholder: "例：棚卸調整、破損、入力修正など",
    inventoryEditSave: "保存",
    inventoryEditCancel: "キャンセル",
    inventoryEditSaving: "保存中...",
    inventoryEditSaved: "ワイン情報と在庫を更新しました。",
    inventoryEditInvalidQty: "在庫数は0以上の正しい数字を入力してください。",
    inventoryEditUnavailable: "ワイン情報を取得できませんでした。",
    inventoryEditSaveFailed: "在庫編集に失敗しました：{error}",
    inventoryEditReasonLabel: "調整理由",
    inventoryEditReasonSelect: "選択してください",
    inventoryReasonInventoryCount: "棚卸調整",
    inventoryReasonSaleCorrection: "販売修正",
    inventoryReasonBreakage: "破損",
    inventoryReasonLoss: "紛失",
    inventoryReasonTasting: "試飲 / サービス",
    inventoryReasonPurchaseCorrection: "入庫修正",
    inventoryReasonOther: "その他",
    inventoryEditUnsavedBadge: "未保存",
    inventoryEditConfirmQtyChange:
      "{wine}\n在庫を {from}本 → {to}本 に変更しますか？",
    inventoryEditConfirmReasonLine: "調整理由：{reason}",
    inventoryEditConfirmNoteLine: "メモ：{note}",
    inventoryEditReasonRequired:
      "在庫数を変更する場合は、調整理由を選択してください。",
    inventoryEditOtherNoteRequired:
      "「その他」を選択した場合は、理由・メモを入力してください。",
    inventoryEditRequiredLabel: "*",
    inventorySortLabel: "並び替え",
    inventorySortProducerAsc: "生産者 A→Z",
    inventorySortVintageDesc: "Vintage 新→旧",
    inventorySortVintageAsc: "Vintage 旧→新",
    inventorySortQtyAsc: "在庫 少→多",
    inventorySortQtyDesc: "在庫 多→少",
    inventorySortCostDesc: "原価 高→低",
    inventorySortCostAsc: "原価 低→高",
    inventoryFilterLabel: "在庫フィルター",
    inventoryFilterAll: "すべて",
    inventoryFilterInStock: "在庫あり",
    inventoryFilterZero: "在庫0",
    inventoryFilterOne: "在庫1本",
    inventoryFilterTwoOrFewer: "在庫2本以下",
    inventoryShowZeroStock: "0在庫も表示",
    inventoryHideChecked: "確認済みを非表示",
    inventoryStocktakeMarkChecked: "確認済み",
    inventoryStocktakeUndoCheck: "確認を取消",
    inventoryStocktakeCheckedBadge: "{date} 確認済み",
    inventoryStocktakeUncheckedCount: "未確認 {count}",
    inventoryStocktakeCheckedCount: "確認済み {count}",
    inventoryStocktakeSaveFailed:
      "在庫確認状態の保存に失敗しました。\n{error}",
    inventoryStocktakeResetAll: "確認済みをすべて解除",
    inventoryStocktakeResetAllConfirm:
      "この会社の在庫確認済み状態をすべて解除します。\n在庫数量や移動履歴は変更されません。\nよろしいですか？",
    inventoryStocktakeResetAllFailed:
      "確認済み状態の一括解除に失敗しました。\n{error}",
    wineReviewTitle: "要確認 / 未分類",
    wineReviewSummary:
      "在庫があるのに地域またはカテゴリーが未設定のワイン：{count}件。地域・カテゴリー検索に表示されません。",
    wineReviewAutoClassify: "未分類を自動判定",
    wineReviewClassifying: "判定中... {done}/{total}件",
    wineReviewClassified:
      "判定候補：{total}件。内容を確認・修正してから保存してください。",
    wineReviewAiFailed:
      "一部のワインでAI判定に失敗したため、色・キーワードのルールのみで判定しました。\n{error}",
    wineReviewRegion: "地域",
    wineReviewCategory: "カテゴリー",
    wineReviewSource: "根拠",
    wineReviewSourceColor: "色",
    wineReviewSourceRule: "ルール",
    wineReviewSourceAi: "AI",
    wineReviewSourceExisting: "既存",
    wineReviewSourceNone: "—",
    wineReviewExistingRow: "既存分類あり",
    wineReviewIncomplete: "地域とカテゴリーが必要です",
    wineReviewSelectAll: "すべて選択",
    wineReviewSaveSelected: "一括保存（{count}件）",
    wineReviewDiscard: "判定結果を破棄",
    wineReviewSaveConfirm:
      "チェックした{count}件の分類を保存します。\n価格・掲載状態・在庫数は変更されません。\nよろしいですか？",
    wineReviewSaveFailed:
      "分類の保存に失敗しました。\n{error}",
    wineReviewSaved: "{count}件の分類を保存しました。",
    winePricingTitle: "価格未設定",
    winePricingSummary:
      "分類済み・在庫ありで販売価格が未設定のワイン：{count}件。保存するのは価格のみで、掲載/非掲載は変更しません。",
    winePricingRuleHint:
      "推奨価格ルール：原価HT × 1.2 × 2（= ×2.4）、5€単位に切り上げ。",
    winePricingLoading: "有効なワインを確認中...",
    winePricingOnlyUnpriced: "価格未設定のみ",
    winePricingListingAll: "掲載状態：すべて",
    winePricingListingListed: "掲載中のみ",
    winePricingListingUnlisted: "非掲載のみ",
    winePricingRegionAll: "地域：すべて",
    winePricingCategoryAll: "カテゴリー：すべて",
    winePricingStock: "在庫",
    winePricingCost: "原価HT",
    winePricingCurrentPrice: "現在価格",
    winePricingRecommended: "販売価格",
    winePricingRatio: "倍率",
    winePricingListing: "掲載",
    winePricingListed: "掲載中",
    winePricingUnlisted: "非掲載",
    winePricingNeedsReview: "要確認",
    winePricingSelectAll: "すべて選択",
    winePricingDeselectAll: "選択解除",
    winePricingRecalculate: "推奨価格を再計算",
    winePricingSaveSelected: "一括保存（{count}件）",
    winePricingNoRows: "条件に一致するワインはありません。",
    winePricingSaveConfirm:
      "チェックした{count}件の販売価格を保存します。\n掲載/非掲載は変更されません。\nよろしいですか？",
    winePricingSaved: "{count}件の販売価格を保存しました。",
    winePricingSavePartial:
      "{saved}件保存 / {failed}件失敗しました。\n{error}",

    section8Title: "8. 売れたボトルを写真AI判定で在庫から引く",
    section8Description: "営業後に売れたボトルを撮影すると、AIがラベルを読み取り現在庫から候補を探します。誤判定防止のため、在庫を減らす前に必ず候補を確認します。",
    soldBottleSelect: "売れたボトルの写真を選択 / 撮影",
    soldBottleAnalyze: "写真をAI判定",
    soldBottleAnalyzing: "ボトルをAI判定中...",
    soldBottleNoFiles: "写真を1枚以上選択してください。",
    soldBottleNoInventory: "在庫データがありません。先に「在庫を更新」を押してください。",
    soldBottleAiFailed: "ボトル写真のAI判定に失敗しました：{error}",
    soldBottleDetected: "AI判定完了：{total}件。候補を確認してから在庫を減らしてください。",
    soldBottleAiRead: "AI読取結果",
    soldBottleMatchedInventory: "対応する在庫ワイン",
    soldBottleNoMatch: "在庫候補を選択してください",
    soldBottleQty: "販売本数",
    soldBottleStock: "現在庫",
    soldBottleConfidence: "AI信頼度",
    soldBottleApplyAll: "確認したボトルを在庫から引く",
    soldBottleApplying: "在庫を更新中...",
    soldBottleNeedMatch: "在庫から引く全ての行で、対応するワインを選択してください。",
    soldBottleInvalidQty: "販売本数は1以上にしてください。",
    soldBottleOverStock: "{wine} の販売本数が現在庫を超えています。現在庫 {stock}本 / 指定 {qty}本",
    soldBottleConfirm: "確認済み {lines}件、合計 {qty}本を在庫から引きますか？",
    soldBottleApplied: "在庫更新完了：合計 {qty}本を在庫から引きました。",
    soldBottleSaleNote: "写真AI判定による販売",
    soldBottleClear: "結果をクリア",
    soldBottleSearchLabel: "現在庫を検索",
    soldBottleSearchPlaceholder: "例：chambertin 1972",
    soldBottleSearchNoResults: "該当するワインが見つかりません。",
    soldBottleSearchSelected: "検索から選択",
    soldBottleConfirmedCount: "確認済み",
    soldBottleUnconfirmedCount: "未確認",
    soldBottleAllConfirmed: "すべて確認済み",
    soldBottleConfirmRemaining: "{count}件を確認してください",
    soldBottleConfirmedBadge: "確認済み",
    soldBottleUnconfirmedBadge: "未確認",

    stockHistoryTitle: "9. 在庫移動履歴",
    stockHistoryDescription:
      "販売・在庫調整・入庫・取消の履歴を確認できます。誤って登録したSALE/ADJUSTMENTは、元の履歴を削除せず「逆仕訳」で安全に取り消せます。",
    stockHistorySearchPlaceholder:
      "例：roumier 2019、chambertin 1972、breakage など",
    stockHistoryDate: "日付",
    stockHistoryType: "種別",
    stockHistoryWine: "ワイン",
    stockHistoryQuantity: "数量",
    stockHistoryCost: "原価HT",
    stockHistoryNotes: "メモ",
    stockHistoryAction: "操作",
    stockMovementPurchase: "入庫",
    stockMovementSale: "販売",
    stockMovementAdjustment: "在庫調整",
    stockMovementReversal: "取消",
    stockHistoryTypeFilterLabel: "移動種別",
    stockHistoryDateFilterLabel: "期間",
    stockHistoryDateAll: "すべて",
    stockHistoryDateToday: "今日",
    stockHistoryDate7d: "過去7日",
    stockHistoryDate30d: "過去30日",
    stockHistoryAll: "すべて",
    stockHistoryLoadMore: "さらに100件表示",
    stockHistoryLoading: "読み込み中...",
    stockHistoryNoResults:
      "該当する在庫移動がありません。",
    stockHistoryUndo: "取消",
    stockHistoryUndoing: "取消中...",
    stockHistoryUndone: "取消済み",
    stockHistoryAlreadyUndone:
      "この移動はすでに取り消し済みです。",
    stockHistoryUndoConfirm:
      "{wine}\n{type} {qty}本を取り消します。\n\n在庫：\n{from}本 → {to}本\n\n取り消しますか？",
    stockHistoryUndoSuccess:
      "在庫移動を取り消しました。",
    stockHistoryUndoFailed:
      "取消に失敗しました：{error}",
    stockHistoryUndoNegativeStock:
      "この取消を実行すると在庫がマイナスになるため、取り消せません。",
    stockHistoryReversalOfLabel:
      "↳ {type} {qty} の取消",
    stockHistoryReversalOfSale:
      "販売 {qty}本の取消",
    stockHistoryReversalOfAdjustment:
      "在庫調整 {qty}本の取消",
    stockHistoryReversalGeneric:
      "在庫移動の取消",
    stockHistoryOriginalNote:
      "元メモ：{note}",
    stockHistoryNotReversible:
      "ここでは取消できません",
    todaySales: "本日の販売",
    todayAdjustments: "本日の調整",
    todayReversals: "本日の取消",

    initialImportTitle:
      "10. 初期在庫インポート（運営者専用）",
    initialImportDescription:
      "新規顧客が現在使っているExcel/CSVの在庫表を、テンプレートへの書き直しなしでそのままインポートできます。最後の「初期在庫をインポート」実行までDBは一切書き換わりません。",
    initialImportTargetCompany:
      "インポート先会社",
    initialImportSelectCompanyPlaceholder:
      "会社を選択してください...",
    initialImportSelectFile:
      "顧客のExcel / CSVファイル",
    initialImportFileInfo: "{name}（{size}）",
    initialImportAnalyze: "ファイルを解析",
    initialImportAnalyzing: "解析中...",
    initialImportSelectCompanyFirst:
      "先にインポート先会社を選択してください。",
    initialImportSelectFileFirst:
      "先にファイルを選択してください。",
    initialImportAnalyzeFailed:
      "ファイルの解析に失敗しました。",
    initialImportSourceRows: "Excel行数",
    initialImportRecognizedWines:
      "認識ワイン",
    initialImportUniqueWines: "ユニークワイン",
    initialImportTotalBottles: "総在庫本数",
    initialImportCardHint:
      "カードをクリックすると該当データを表示します",
    initialImportReady: "登録準備OK",
    initialImportReview: "要確認",
    initialImportDuplicate: "重複候補",
    initialImportInvalid: "無効",
    initialImportSkip: "スキップ",
    initialImportBillableUnits:
      "課金対象候補件数（ユニークワイン数）：{count}",
    initialImportExistingMatch: "既存ワイン",
    initialImportNewWine: "新規ワイン",
    initialImportClearMatch:
      "新規ワインとして登録",
    initialImportImportButton:
      "初期在庫をインポート",
    initialImportExistingInventoryWarning:
      "{company}には既に{count}本の在庫があります。初期在庫を追加すると数量が加算されます。",
    initialImportConfirmExistingInventory:
      "既存在庫へ追加することを確認しました",
    initialImportConfirm:
      "会社：\n{company}\n\nファイル：\n{filename}\n\n登録ワイン：\n{wineCount}種類\n\n総在庫：\n{totalBottles}本\n\nこの初期在庫を登録しますか？",
    initialImportSuccess:
      "初期在庫を登録しました。",
    initialImportCommitFailed:
      "初期在庫の登録に失敗しました。",
    initialImportNoReadyRows:
      "登録準備OKの行がありません。",
    initialImportUnresolvedRows:
      "要確認・重複候補・無効な行が{count}件残っています。解決してからインポートしてください。",
    initialImportMustAcknowledgeExisting:
      "既存在庫へ追加することを確認するチェックボックスをONにしてください。",
    initialImportRowInvalid:
      "この行を「登録準備OK」にするには、ワイン名と1以上の整数の数量が必要です。",
    initialImportAlreadyImported:
      "このファイルはこの会社に既にインポートされています。",
    initialImportLoadCompaniesFailed:
      "会社一覧の取得に失敗しました。",
    initialImportPreviewTitle:
      "プレビュー（{count}行）",
    initialImportSearchPlaceholder:
      "生産者・ワイン名・年などで検索",
    initialImportStatusFilterLabel:
      "状態で絞り込み",
    initialImportStatusAll: "すべて",
    initialImportColProducer: "生産者",
    initialImportColWineName: "ワイン名",
    initialImportColCuvee: "キュヴェ",
    initialImportColVintage: "年",
    initialImportColColor: "色",
    initialImportColSize: "容量",
    initialImportColQuantity: "数量",
    initialImportColCost: "原価HT",
    initialImportColConfidence: "信頼度",
    initialImportColWarnings: "警告",
    initialImportColMatch: "既存ワイン照合",
    initialImportColAction: "操作",
    initialImportMarkReady:
      "登録準備OKにする",
    initialImportExportCsv:
      "インポート結果CSVを出力",
    initialImportResultTitle:
      "インポート完了",
    initialImportResultBatch: "バッチID",
    initialImportResultCompany: "会社",
    initialImportResultWineCount:
      "登録ワイン数",
    initialImportResultTotalBottles:
      "総本数",
    initialImportResultFile: "ファイル",

    customerAdminTitle:
      "11. 顧客会社管理（運営者専用）",
    customerAdminDescription:
      "新規顧客会社を作成し、導入状況・契約状況・初期在庫インポート状況をここで管理します。この画面から会社を削除することはできません。契約終了時は契約状態を「解約」にしてください。",
    customerLoadFailed:
      "顧客会社一覧の取得に失敗しました。",
    customerNoResults:
      "該当する顧客会社がありません。",
    customerNameRequired:
      "会社名を入力してください。",
    customerCompanyName: "会社名",
    customerCompanyNamePlaceholder:
      "新しい会社名",
    customerCreateButton: "会社を作成",
    customerCreating: "作成中...",
    customerCreateSuccess:
      "顧客会社を作成しました。",
    customerCreateFailed:
      "顧客会社の作成に失敗しました。",
    customerDuplicateWarningTitle:
      "同じ名前の会社が既にあります",
    customerDuplicateWarningBody:
      "同名の既存会社：{names}",
    customerConfirmCreateDuplicate:
      "それでも作成する",
    customerCancelDuplicate: "キャンセル",
    customerSearchPlaceholder:
      "会社名で検索",
    customerContractFilterLabel:
      "契約状態",
    customerOnboardingFilterLabel:
      "導入状態",
    customerFilterAll: "すべて",
    customerContractProspect: "見込み客",
    customerContractTrial: "トライアル",
    customerContractActive: "契約中",
    customerContractPaused: "一時停止",
    customerContractCancelled: "解約",
    customerOnboardingNew: "未着手",
    customerOnboardingWaitingExcel:
      "Excel待ち",
    customerOnboardingExcelReceived:
      "Excel受領済み",
    customerOnboardingAnalyzing:
      "解析中",
    customerOnboardingReadyToImport:
      "インポート準備完了",
    customerOnboardingImported:
      "インポート済み",
    customerOnboardingActive: "運用中",
    customerColCompany: "会社名",
    customerColContractStatus: "契約状態",
    customerColOnboardingStatus:
      "導入状態",
    customerColWineCount: "ワイン種類",
    customerColBottleCount: "在庫本数",
    customerColImportCount:
      "インポート回数",
    customerColLatestImport:
      "最終インポート",
    customerColCreatedAt: "作成日",
    customerColActions: "操作",
    customerWineCount: "ワイン種類",
    customerBottleCount: "現在庫本数",
    customerImportCount:
      "初期インポート回数",
    customerLatestImport:
      "最終インポート",
    customerLatestImportNone: "まだありません",
    customerChargeableWineCount:
      "課金対象ワイン数：{count}種類",
    customerCreatedAt: "作成日",
    customerDetails: "詳細",
    customerDetailsTitle: "顧客会社詳細",
    customerCompanyId: "会社ID",
    customerCurrentStock: "現在",
    customerImportHistory:
      "初期インポート履歴",
    customerNoImportHistory:
      "初期インポート履歴はまだありません。",
    customerOnboardingStatusLabel:
      "導入状態",
    customerContractStatusLabel:
      "契約状態",
    customerPlan: "プラン",
    customerInitialFee: "初期費用（€）",
    customerMonthlyFee: "月額料金（€）",
    customerInternalNotes:
      "管理メモ",
    customerSave: "保存",
    customerSaving: "保存中...",
    customerSaveSuccess:
      "顧客会社情報を更新しました。",
    customerSaveFailed:
      "顧客会社情報の更新に失敗しました。",
    customerNoDeleteNotice:
      "この画面から会社を削除することはできません。契約終了時は契約状態を「解約」にしてください。",
    customerClose: "閉じる",
    customerInitialImportDoneBadge:
      "初期在庫登録済み",

    customerUsersTitle:
      "12. 顧客ユーザー管理・招待（運営者専用）",
    customerUsersDescription:
      "会社を選択するとユーザー一覧が表示され、メールアドレスで新しいユーザーを招待できます。Supabaseの招待メールが送信されます。パスワードはここでは作成しません。",
    customerUsersCompany: "会社",
    customerUsersSelectCompanyPlaceholder:
      "会社を選択してください...",
    customerUsersSelectCompanyPrompt:
      "会社を選択するとユーザー一覧が表示されます。",
    customerUsersInviteEmail:
      "招待するメールアドレス",
    customerUsersInviteHeading:
      "{company} にユーザーを招待",
    customerUsersInviteButton: "招待",
    customerUsersInviting: "送信中...",
    customerUsersSelectCompanyFirst:
      "先に会社を選択してください。",
    customerUsersInvalidEmail:
      "正しいメールアドレスを入力してください。",
    customerUsersInviteFailed:
      "ユーザーの招待に失敗しました。",
    customerUsersInviteSuccess:
      "招待メールを送信しました。",
    customerUsersAlreadyMember:
      "このユーザーは既にこの会社に所属しています。",
    customerUsersOtherCompany:
      "このメールアドレスは別の会社に所属しています。",
    customerUsersNoProfileRow:
      "このユーザーはSupabase Authには存在しますが、profiles行が見つかりませんでした。手動での確認が必要です。",
    customerUsersInvitedNotLinked:
      "招待メールは送信されましたが、会社所属の設定に失敗しました。手動で確認してください。",
    customerUsersLoadFailed:
      "ユーザー一覧の取得に失敗しました。",
    customerUsersNoUsers:
      "この会社にはまだユーザーがいません。",
    customerUsersColEmail:
      "メールアドレス",
    customerUsersColCreatedAt: "作成日",
    customerUsersColEmailConfirmed:
      "メール確認",
    customerUsersColLastSignIn:
      "最終ログイン",
    customerUsersColStatus: "状態",
    customerUsersColAction: "操作",
    customerUsersActive: "利用開始済み",
    customerUsersInvited: "招待中",
    customerUsersUnconfirmed: "未確認",
    customerUsersUnknownStatus: "不明",
    customerUsersNever: "なし",
    customerUsersYes: "済",
    customerUsersNo: "未",
    customerUsersResendInvite: "招待を再送",
    customerUsersResending: "送信中...",
    customerUsersResendSuccess:
      "招待メールを再送しました。",
    customerUsersResendFailed:
      "招待の再送に失敗しました。",
    customerUsersAlreadyConfirmed:
      "このユーザーは既にメールを確認済みのため、招待を再送できません。",
    customerUsersSendPasswordSetup:
      "パスワード設定リンクを送信",
    customerUsersSendingPasswordSetup:
      "送信中...",
    customerUsersPasswordSetupSuccess:
      "パスワード設定メールを送信しました。",
    customerUsersPasswordSetupFailed:
      "パスワード設定メールの送信に失敗しました。",
    customerUsersColRole: "権限",
    customerUsersInviteRoleLabel: "権限",
    customerUsersRoleOwner: "オーナー",
    customerUsersRoleStaff: "スタッフ",
    customerUsersRoleViewer: "閲覧のみ",
    customerUsersRoleUpdateSuccess:
      "権限を更新しました。",
    customerUsersRoleUpdateFailed:
      "権限の更新に失敗しました。",
    customerUsersLastOwnerProtection:
      "この会社で唯一のオーナーのため、権限を変更できません。",
    viewerReadOnlyAction:
      "あなたの権限（閲覧のみ）ではこの操作はできません。",
    ownerOnlyAction:
      "この操作はオーナーのみ実行できます。",
    viewerBanner:
      "閲覧のみ：このアカウントではデータを変更できません",

    section16Title: "16. データバックアップ / エクスポート",
    section16Description:
      "現在庫と在庫移動履歴を、いつでも自社のExcel/CSVとして書き出せます。owner・staff・viewerのどの権限でも実行できる読み取り専用機能で、他社のデータが含まれることは一切ありません。",
    exportCurrentInventoryExcel: "現在庫Excel",
    exportCurrentInventoryCsv: "現在庫CSV",
    exportFullBackupExcel: "完全バックアップExcel",
    exportRunning: "エクスポート中...",
    exportCompanyMissing:
      "会社情報を取得できませんでした。再読み込みしてからお試しください。",
    exportInventoryFetchFailed:
      "現在庫の取得に失敗しました：{error}",
    exportMovementsFetchFailed:
      "在庫移動履歴の取得に失敗しました：{error}",
    exportBuildFailed:
      "ファイルの作成に失敗しました：{error}",
    exportNoInventoryData:
      "出力できる現在庫データがありません（在庫はすべて0本です）。",
    exportNoMovementsData:
      "出力できる在庫移動履歴がありません。",
    exportInventorySuccess:
      "現在庫Excelを書き出しました（{count}件）。",
    exportInventoryCsvSuccess:
      "現在庫CSVを書き出しました（{count}件）。",
    exportFullBackupSuccess:
      "完全バックアップExcelを書き出しました（在庫{inventoryCount}件 / 移動履歴{movementCount}件）。",

    section17Title: "17. 在庫アラート / 補充候補",
    section17Description:
      "在庫切れ・残りわずかのワインをひと目で確認できます。company内のactiveな（統合されていない）ワインすべてを対象にし、最低在庫数・目標在庫数はワインごとに任意で設定できます。設定していないワインは警告を出しません。",
    alertSummaryOutOfStock: "在庫切れ",
    alertSummaryLowStock: "残りわずか",
    alertSummaryConfigured: "アラート設定済み",
    alertSummaryRecommendedOrder: "発注候補本数",
    alertColProducer: "生産者",
    alertColWine: "ワイン",
    alertColCuvee: "キュヴェ",
    alertColVintage: "ヴィンテージ",
    alertColCurrentStock: "現在庫",
    alertColMinStock: "最低在庫",
    alertColTargetStock: "目標在庫",
    alertColStatus: "状態",
    alertColRecommendedOrder: "補充候補",
    alertColAlert: "アラート",
    alertColSave: "保存",
    alertStatusNotSet: "未設定",
    alertStatusOff: "OFF",
    alertStatusOutOfStock: "在庫切れ",
    alertStatusLowStock: "残りわずか",
    alertStatusOk: "OK",
    alertFilterLabel: "フィルター",
    alertFilterAll: "すべて",
    alertFilterNeedsAction: "要対応",
    alertFilterOutOfStock: "在庫切れ",
    alertFilterLowStock: "残りわずか",
    alertFilterOk: "OK",
    alertFilterNotSet: "未設定",
    alertFilterAlertEnabled: "アラート設定済み",
    alertFilterReorder: "発注候補あり",
    alertSearchPlaceholder: "例：chablis 2022",
    alertSearchNoResults: "該当するワインが見つかりません。",
    alertRecommendedOrderNotSet: "—",
    alertMinQuantityLabel: "最低在庫数",
    alertTargetQuantityLabel: "目標在庫数（任意）",
    alertEnabledLabel: "アラートを有効にする",
    alertSaveButton: "保存",
    alertSaving: "保存中...",
    alertSaveSuccess: "保存しました：{producer} {vintage}",
    alertSaveFailed: "保存に失敗しました：{error}",
    alertInvalidMinQuantity:
      "最低在庫数は0以上の数字で入力してください。",
    alertInvalidTargetQuantity:
      "目標在庫数は0以上の数字、または空欄にしてください。",
    alertTargetLessThanMin:
      "目標在庫数は最低在庫数以上にしてください。",
    alertCompanyMissing:
      "会社情報を取得できませんでした。再読み込みしてからお試しください。",
    alertWinesFetchFailed:
      "対象ワインの取得に失敗しました：{error}",
    alertInventoryFetchFailed:
      "在庫数の取得に失敗しました：{error}",
    alertSettingsFetchFailed:
      "アラート設定の取得に失敗しました：{error}",
    alertLoading: "読み込み中...",
    alertNoResults: "該当するワインがありません。",
    alertRefresh: "更新",
  },
  EN: {
    duplicateWarning: "Possible duplicate: invoice {invoice} / {producer} / {wine} / {vintage}",
    wineListLoading: "Loading wine list...",
    wineListFetchFailed: "Failed to load wine list: {error}",
    wineListLoaded: "Wine list loaded: {total} wines ({listed} listed)",
    wineListFetchError: "Wine list error: {error}",
    wineInfoUnavailable: "Unable to retrieve wine information.",
    salePricePositive: "Enter a sale price greater than 0.",
    salePriceSaveUnavailable: "Unable to save the sale price.",
    salePriceSaved: "Sale price saved: {producer} {vintage} / {price} €",
    salePriceSaveFailed: "Failed to save the sale price.\n{error}",
    listingStateSaveUnavailable: "Unable to save the listing status.",
    listingNeedsPrice: "Set a sale price before adding this wine to the list.",
    listingNeedsClassification: "Classify this wine before listing it.",
    wineListUnclassified: "Unclassified",
    wineListed: "Added to the wine list: {producer} {vintage}",
    wineUnlisted: "Removed from the wine list: {producer} {vintage}",
    listingStateSaveFailed: "Failed to save the listing status.\n{error}",
    section5Title: "5. Cuvée completion (AI)",
    section5Description: "AI extracts suggested cuvée names from the original invoice text. You can narrow the target wines using the search box in Section 4 (for example, search CHAMPAGNE), then review, edit and save each suggestion. This updates wines.cuvee and feeds the customer wine list.",
    cuveeNoTarget: "No wines to process. Check the search filter or refresh inventory first.",
    cuveeExtractProgress: "AI cuvée extraction: {from}–{to} / {total}",
    cuveeProducerSameFilteredNote: "AI suggestion matched the producer name and was removed automatically.",
    cuveeExtractComplete: "AI cuvée extraction complete: {total} wines (review and save the results)",
    cuveeExtractFailed: "Cuvée extraction failed: {error}",
    cuveeSaveInfoMissing: "Unable to retrieve the cuvée suggestion to save.",
    cuveeSaveFailed: "Failed to save the cuvée: {error}",
    cuveeNoValidSuggestions: "There are no valid cuvée suggestions to save.",
    cuveeBulkConfirm: "Save {total} valid cuvée suggestions in bulk.\nWines marked “not applicable” will not be changed.\n\nSave?",
    cuveeBulkSaving: "Saving valid cuvées: {current}/{total}",
    cuveeBulkComplete: "Finished saving {total} valid cuvée suggestions.",
    cuveeExtracting: "AI extracting...",
    cuveeExtractButton: "AI cuvée extraction ({total} displayed wines)",
    cuveeBulkSaveButton: "Save valid suggestions ({total})",
    currentCuvee: "Current cuvée",
    aiSuggestedCuvee: "AI suggested cuvée",
    noApplicable: "(none)",
    aiSuggestion: "AI suggestion",
    saveAction: "Save",
    unsaved: "Unsaved",
    changing: "Updating...",
    moveToUnlisted: "Remove from list",
    listWine: "Add to list",
    section6Title: "6. Possible duplicate wines",
    section6Description: "Shows wines with the same producer, vintage and bottle size (wines with zero stock are excluded). “Merge as the same wine” checks conflicts in confirmed classification and manual pricing, then moves purchase lines and stock movements to the Master using Supabase’s atomic merge_wines RPC. Quantities are not added directly; the history is reassigned to one wine_id, so total bottle count and inventory value do not change.",
    exactMatch: "100% match",
    highProbability: "High probability",
    countUnit: "wines",
    filtering: "Filtered",
    exactReviewRestore: "Return 100% matches to normal view",
    exactReviewStart: "Review 100% matches one by one",
    remaining: "{total} remaining",
    noPendingDuplicates: "No unprocessed duplicate candidates.",
    noFilterDuplicates: "No duplicate candidates match this filter.",
    unknownProducer: "Unknown producer",
    nvBlank: "NV / blank",
    candidates: "{total} candidates",
    judgment: "Assessment",
    stockQty: "Stock",
    costPerBottle: "Cost excl. tax/bottle",
    reference: "Reference",
    merged: "Merged",
    merging: "Merging...",
    mergeSameWine: "Merge as the same wine",
    cancelDifferentWine: "Undo different-wine flag",
    differentWine: "Different wine",
    duplicateHigh: "High probability",
    duplicateMedium: "Needs review",
    duplicateLow: "Different",
    duplicateDecisionSaveFailed: "Failed to save the different-wine decision: {error}",
    duplicateDecisionSaved: "Different-wine decision saved to Supabase.",
    duplicateDecisionCancelFailed: "Failed to cancel the different-wine decision: {error}",
    duplicateDecisionCancelled: "Different-wine decision cancelled.",
    duplicateDecisionGenericFailed: "Failed to save the different-wine decision.",
    mergeChecking: "Checking merge details...",
    classificationFetchFailed: "Failed to load classification information: {error}",
    wineIdUnavailable: "Unable to retrieve wine_id.",
    mergeClassificationConflict: "Merge cancelled.\n\nBoth wines have confirmed classifications, but the following fields conflict:\n\n{conflicts}\n\nConfirm that they are the same wine and correct the classification if necessary before trying again.",
    priceNotSet: "not set",
    priceConflictPrompt: "Price conflict.\n\n{masterProducer} (Master candidate): {masterPrice} €\n{otherProducer}: {otherPrice} €\n\nOK = keep {otherProducer} price\nCancel = keep {masterProducer} price",
    masterKeepLine: "Master (keep): {producer} {vintage} / {wine}",
    mergedLine: "Will be merged: {producer} {vintage} / {wine}",
    similarityLine: "Similarity: {similarity}",
    classificationInheritLine: "Classification: inherit confirmed classification from {producer} ({appellation})",
    classificationKeepLine: "Classification: keep the Master confirmed classification",
    classificationNoChangeLine: "Classification: no change (run AI classification and confirmation again later)",
    priceAdoptLine: "Price: use {price} €",
    priceKeepLine: "Price: keep the Master price",
    mergeConfirm: "Run the merge with the following settings?\n\n{summary}",
    mergeRunning: "Merging...",
    mergeRpcFailed: "Merge failed: {error}",
    mergeCompleteQty: "Merge complete: inventory quantity was preserved correctly ({qty} bottles).",
    mergeQtyMismatch: "Merge completed, but the quantity before and after does not match. Please check immediately. (before: {before} bottles → after: {after} bottles)",
    mergeFailed: "Merge failed.\n{error}",
    savedAndMasterUpdated: "Saved. Master histories were also updated.",
    existingInvoiceCheckFailed: "Failed to check for an existing invoice.",
    invoiceSaveFailed: "Failed to save the invoice to Supabase.",
    itemCheckFailed: "Failed to check invoice line items.",
    invoiceAlreadySaved: "The line items for this invoice are already saved in Supabase.",
    wineMasterSearchFailed: "Failed to search the wine master.",
    wineMasterInsertFailed: "Failed to add the wine to the master.",
    purchaseItemsSaveFailed: "Failed to save product line items.",
    stockMovementSaveFailed: "Failed to save stock-in movements.",
    supabaseSaved: "Saved to Supabase.\nInvoice: {invoice}\nLine items: {items}",
    selectPdfOrPhoto: "Select a PDF or photo.",
    aiJudging: "AI analysis in progress...",
    aiAnalysisFailed: "AI analysis failed.",
    itemsAutoRegistered: "{total} products were prepared for inventory. Please review the details.",
    genericError: "Error: {error}",
    stockSheetName: "Inventory",
    inventoryFileBase: "BON_PINARD_AI_inventory",
    supplierMasterSheet: "Supplier master",
    wineMasterSheet: "Wine master",
    priceHistorySheet: "Purchase price history",
    masterHistoryFileBase: "BON_PINARD_master_history",
    section7Title: "7. Wine list",
    section7Description: "By region, category and producer",
    loadingShort: "Loading...",
    refreshWineList: "Refresh wine list",
    allData: "All data",
    listedWines: "Listed wines",
    unlistedWines: "Unlisted",
    displayMode: "Display mode",
    wineListHeaderSettingsTitle: "Wine list title settings",
    wineListHeaderTitleLabel: "Main title",
    wineListHeaderSubtitleLabel: "Subtitle",
    wineListHeaderHint: "These texts are fully editable. Leave the subtitle blank to hide it in customer view.",
    wineListHeaderSave: "Save title",
    wineListHeaderSaved: "Wine list title saved.",
    wineListHeaderLoadFailed: "Failed to load the wine list title: {error}",
    wineListHeaderSaveFailed: "Failed to save the wine list title: {error}",
    wineListLanguageLabel: "Wine list language",
    wineListA4PdfPrint: "A4 PDF / Print",
    wineListA4PdfHint: "Compact two-column A4 portrait layout with tighter heading spacing while keeping the wine text size. Choose “Save as PDF”.",
    wineListPrintWindowBlocked: "Unable to open the print window. Please allow pop-ups for this application.",

    inventoryEdit: "Edit",
    inventoryEditTitle: "Edit wine / Adjust inventory",
    inventoryEditCurrentQty: "Current stock",
    inventoryEditNewQty: "New stock",
    inventoryEditDifference: "Difference",
    inventoryEditNote: "Reason / Note",
    inventoryEditNotePlaceholder: "e.g. physical count, breakage, correction...",
    inventoryEditSave: "Save",
    inventoryEditCancel: "Cancel",
    inventoryEditSaving: "Saving...",
    inventoryEditSaved: "Wine and inventory updated.",
    inventoryEditInvalidQty: "Enter a valid stock quantity of 0 or more.",
    inventoryEditUnavailable: "Unable to retrieve wine information.",
    inventoryEditSaveFailed: "Failed to edit inventory: {error}",
    inventoryEditReasonLabel: "Adjustment reason",
    inventoryEditReasonSelect: "Select a reason",
    inventoryReasonInventoryCount: "Inventory count",
    inventoryReasonSaleCorrection: "Sale correction",
    inventoryReasonBreakage: "Breakage",
    inventoryReasonLoss: "Loss",
    inventoryReasonTasting: "Tasting / service",
    inventoryReasonPurchaseCorrection: "Purchase correction",
    inventoryReasonOther: "Other",
    inventoryEditUnsavedBadge: "Unsaved",
    inventoryEditConfirmQtyChange:
      "{wine}\nChange stock from {from} to {to} bottle(s)?",
    inventoryEditConfirmReasonLine: "Reason: {reason}",
    inventoryEditConfirmNoteLine: "Note: {note}",
    inventoryEditReasonRequired:
      "Please select an adjustment reason when changing the stock quantity.",
    inventoryEditOtherNoteRequired:
      "Please enter a note when selecting “Other”.",
    inventoryEditRequiredLabel: "*",
    inventorySortLabel: "Sort",
    inventorySortProducerAsc: "Producer A→Z",
    inventorySortVintageDesc: "Vintage new→old",
    inventorySortVintageAsc: "Vintage old→new",
    inventorySortQtyAsc: "Stock low→high",
    inventorySortQtyDesc: "Stock high→low",
    inventorySortCostDesc: "Cost high→low",
    inventorySortCostAsc: "Cost low→high",
    inventoryFilterLabel: "Stock filter",
    inventoryFilterAll: "All",
    inventoryFilterInStock: "In stock",
    inventoryFilterZero: "Out of stock (0)",
    inventoryFilterOne: "Stock = 1",
    inventoryFilterTwoOrFewer: "Stock ≤ 2",
    inventoryShowZeroStock: "Show zero-stock wines",
    inventoryHideChecked: "Hide checked wines",
    inventoryStocktakeMarkChecked: "Checked",
    inventoryStocktakeUndoCheck: "Undo check",
    inventoryStocktakeCheckedBadge: "Checked on {date}",
    inventoryStocktakeUncheckedCount: "Unchecked {count}",
    inventoryStocktakeCheckedCount: "Checked {count}",
    inventoryStocktakeSaveFailed:
      "Failed to save the stock check.\n{error}",
    inventoryStocktakeResetAll: "Reset all checks",
    inventoryStocktakeResetAllConfirm:
      "All stock checks for this company will be cleared.\nStock quantities and movement history will not be changed.\nContinue?",
    inventoryStocktakeResetAllFailed:
      "Failed to reset the stock checks.\n{error}",
    wineReviewTitle: "Needs review / unclassified",
    wineReviewSummary:
      "{count} wines in stock have no region or category. They do not appear in the region / category filters.",
    wineReviewAutoClassify: "Auto-classify unclassified",
    wineReviewClassifying: "Classifying... {done}/{total}",
    wineReviewClassified:
      "Suggestions ready: {total} wines. Review, correct, then save.",
    wineReviewAiFailed:
      "AI classification failed for some wines; only the colour / keyword rules were used for them.\n{error}",
    wineReviewRegion: "Region",
    wineReviewCategory: "Category",
    wineReviewSource: "Source",
    wineReviewSourceColor: "Colour",
    wineReviewSourceRule: "Rule",
    wineReviewSourceAi: "AI",
    wineReviewSourceExisting: "Existing",
    wineReviewSourceNone: "—",
    wineReviewExistingRow: "Existing classification",
    wineReviewIncomplete: "Region and category required",
    wineReviewSelectAll: "Select all",
    wineReviewSaveSelected: "Save selected ({count})",
    wineReviewDiscard: "Discard suggestions",
    wineReviewSaveConfirm:
      "Save the classification for {count} checked wines?\nPrices, listing status and stock quantities will not be changed.",
    wineReviewSaveFailed:
      "Failed to save the classification.\n{error}",
    wineReviewSaved: "Saved classification for {count} wines.",
    winePricingTitle: "Price not set",
    winePricingSummary:
      "Classified, in-stock wines without a sale price: {count}. Only the price is saved; listing status is not changed.",
    winePricingRuleHint:
      "Rule: cost excl. VAT × 1.2 × 2 (= ×2.4), rounded up to the next €5.",
    winePricingLoading: "Checking active wines...",
    winePricingOnlyUnpriced: "Price not set only",
    winePricingListingAll: "Listing: all",
    winePricingListingListed: "Listed only",
    winePricingListingUnlisted: "Unlisted only",
    winePricingRegionAll: "All regions",
    winePricingCategoryAll: "All categories",
    winePricingStock: "Stock",
    winePricingCost: "Cost excl. VAT",
    winePricingCurrentPrice: "Current price",
    winePricingRecommended: "Sale price",
    winePricingRatio: "Ratio",
    winePricingListing: "Listing",
    winePricingListed: "Listed",
    winePricingUnlisted: "Unlisted",
    winePricingNeedsReview: "Needs review",
    winePricingSelectAll: "Select all",
    winePricingDeselectAll: "Deselect all",
    winePricingRecalculate: "Recalculate suggested prices",
    winePricingSaveSelected: "Save selected ({count})",
    winePricingNoRows: "No wines match the filters.",
    winePricingSaveConfirm:
      "Save the sale price for {count} checked wines?\nListing status will not be changed.",
    winePricingSaved: "Saved sale prices for {count} wines.",
    winePricingSavePartial:
      "Saved {saved} / failed {failed}.\n{error}",

    section8Title: "8. Deduct sold bottles from photos (AI)",
    section8Description: "Photograph bottles sold after service. AI reads the labels and proposes matching wines from current inventory. Always verify the match before deducting stock.",
    soldBottleSelect: "Select / Photograph sold bottles",
    soldBottleAnalyze: "Analyze bottles with AI",
    soldBottleAnalyzing: "Analyzing bottles...",
    soldBottleNoFiles: "Select at least one photo.",
    soldBottleNoInventory: "Inventory is empty. Refresh inventory first.",
    soldBottleAiFailed: "Bottle photo analysis failed: {error}",
    soldBottleDetected: "Analysis complete: {total} wine(s) detected. Verify matches before deducting stock.",
    soldBottleAiRead: "AI reading",
    soldBottleMatchedInventory: "Matching inventory wine",
    soldBottleNoMatch: "Select an inventory match",
    soldBottleQty: "Bottles sold",
    soldBottleStock: "Stock",
    soldBottleConfidence: "AI confidence",
    soldBottleApplyAll: "Deduct confirmed bottles",
    soldBottleApplying: "Updating inventory...",
    soldBottleNeedMatch: "Select an inventory wine for every line to be deducted.",
    soldBottleInvalidQty: "Sold quantity must be at least 1.",
    soldBottleOverStock: "The quantity to deduct exceeds stock for {wine}: stock {stock}, requested {qty}.",
    soldBottleConfirm: "Deduct {qty} bottle(s) from inventory across {lines} confirmed line(s)?",
    soldBottleApplied: "Inventory updated: {qty} bottle(s) deducted.",
    soldBottleSaleNote: "Sale detected from AI bottle photo",
    soldBottleClear: "Clear results",
    soldBottleSearchLabel: "Search inventory",
    soldBottleSearchPlaceholder: "e.g. chambertin 1972",
    soldBottleSearchNoResults: "No matching wine found.",
    soldBottleSearchSelected: "Selected via search",
    soldBottleConfirmedCount: "Confirmed",
    soldBottleUnconfirmedCount: "Unconfirmed",
    soldBottleAllConfirmed: "All confirmed",
    soldBottleConfirmRemaining: "Confirm {count} wine(s)",
    soldBottleConfirmedBadge: "Confirmed",
    soldBottleUnconfirmedBadge: "Unconfirmed",

    stockHistoryTitle: "9. Inventory movement history",
    stockHistoryDescription:
      "Review sales, adjustments, purchases, and reversals. A wrongly entered sale or adjustment can be safely reversed with an offsetting entry, without ever deleting the original history.",
    stockHistorySearchPlaceholder:
      "e.g. roumier 2019, chambertin 1972, breakage...",
    stockHistoryDate: "Date",
    stockHistoryType: "Type",
    stockHistoryWine: "Wine",
    stockHistoryQuantity: "Quantity",
    stockHistoryCost: "Cost (excl. tax)",
    stockHistoryNotes: "Notes",
    stockHistoryAction: "Action",
    stockMovementPurchase: "Purchase",
    stockMovementSale: "Sale",
    stockMovementAdjustment: "Adjustment",
    stockMovementReversal: "Reversal",
    stockHistoryTypeFilterLabel: "Movement type",
    stockHistoryDateFilterLabel: "Period",
    stockHistoryDateAll: "All",
    stockHistoryDateToday: "Today",
    stockHistoryDate7d: "Last 7 days",
    stockHistoryDate30d: "Last 30 days",
    stockHistoryAll: "All",
    stockHistoryLoadMore: "Show 100 more",
    stockHistoryLoading: "Loading...",
    stockHistoryNoResults:
      "No matching inventory movements.",
    stockHistoryUndo: "Reverse",
    stockHistoryUndoing: "Reversing...",
    stockHistoryUndone: "Reversed",
    stockHistoryAlreadyUndone:
      "This movement has already been reversed.",
    stockHistoryUndoConfirm:
      "{wine}\nReverse {type} {qty} bottle(s)?\n\nStock:\n{from} → {to}\n\nConfirm?",
    stockHistoryUndoSuccess:
      "Inventory movement reversed.",
    stockHistoryUndoFailed:
      "Failed to reverse: {error}",
    stockHistoryUndoNegativeStock:
      "This reversal would make inventory negative and cannot be applied.",
    stockHistoryReversalOfLabel:
      "↳ Reversal of {type} {qty}",
    stockHistoryReversalOfSale:
      "Reversal of sale {qty}",
    stockHistoryReversalOfAdjustment:
      "Reversal of adjustment {qty}",
    stockHistoryReversalGeneric:
      "Inventory movement reversal",
    stockHistoryOriginalNote:
      "Original note: {note}",
    stockHistoryNotReversible:
      "Not reversible here",
    todaySales: "Today's sales",
    todayAdjustments: "Today's adjustments",
    todayReversals: "Today's reversals",

    initialImportTitle:
      "10. Initial inventory import (admin only)",
    initialImportDescription:
      "Import the Excel/CSV inventory a new customer already uses, with no need to rewrite it into a template. Nothing is written to the database until the final import is confirmed.",
    initialImportTargetCompany:
      "Target company",
    initialImportSelectCompanyPlaceholder:
      "Select a company...",
    initialImportSelectFile:
      "Customer's Excel / CSV file",
    initialImportFileInfo: "{name} ({size})",
    initialImportAnalyze: "Analyze file",
    initialImportAnalyzing: "Analyzing...",
    initialImportSelectCompanyFirst:
      "Please select a target company first.",
    initialImportSelectFileFirst:
      "Please select a file first.",
    initialImportAnalyzeFailed:
      "Failed to analyze the file.",
    initialImportSourceRows: "Source rows",
    initialImportRecognizedWines:
      "Recognized wines",
    initialImportUniqueWines: "Unique wines",
    initialImportTotalBottles:
      "Total bottles",
    initialImportCardHint:
      "Click a card to show matching rows.",
    initialImportReady: "Ready",
    initialImportReview: "Review",
    initialImportDuplicate: "Duplicate",
    initialImportInvalid: "Invalid",
    initialImportSkip: "Skipped",
    initialImportBillableUnits:
      "Billable candidate references (unique wines): {count}",
    initialImportExistingMatch:
      "Existing wine",
    initialImportNewWine: "New wine",
    initialImportClearMatch:
      "Save as new wine",
    initialImportImportButton:
      "Import initial inventory",
    initialImportExistingInventoryWarning:
      "{company} already has {count} bottle(s) in stock. This import will add to the existing quantities.",
    initialImportConfirmExistingInventory:
      "I confirm adding to the existing inventory",
    initialImportConfirm:
      "Company:\n{company}\n\nFile:\n{filename}\n\nWines to register:\n{wineCount}\n\nTotal bottles:\n{totalBottles}\n\nImport this initial inventory?",
    initialImportSuccess:
      "Initial inventory imported successfully.",
    initialImportCommitFailed:
      "Failed to import the initial inventory.",
    initialImportNoReadyRows:
      "No \"Ready\" rows to import.",
    initialImportUnresolvedRows:
      "{count} row(s) still need review / are duplicates / invalid. Resolve them before importing.",
    initialImportMustAcknowledgeExisting:
      "Please confirm adding to the existing inventory before continuing.",
    initialImportRowInvalid:
      "This row needs a wine name and a positive integer quantity before it can become \"Ready\".",
    initialImportAlreadyImported:
      "This file has already been imported for this company.",
    initialImportLoadCompaniesFailed:
      "Failed to load the company list.",
    initialImportPreviewTitle:
      "Preview ({count} row(s))",
    initialImportSearchPlaceholder:
      "Search producer, wine, vintage...",
    initialImportStatusFilterLabel:
      "Filter by status",
    initialImportStatusAll: "All",
    initialImportColProducer: "Producer",
    initialImportColWineName: "Wine",
    initialImportColCuvee: "Cuvée",
    initialImportColVintage: "Vintage",
    initialImportColColor: "Color",
    initialImportColSize: "Size",
    initialImportColQuantity: "Quantity",
    initialImportColCost: "Cost (excl. tax)",
    initialImportColConfidence: "Confidence",
    initialImportColWarnings: "Warnings",
    initialImportColMatch:
      "Existing wine match",
    initialImportColAction: "Action",
    initialImportMarkReady: "Mark \"Ready\"",
    initialImportExportCsv:
      "Export import report (CSV)",
    initialImportResultTitle:
      "Import complete",
    initialImportResultBatch: "Batch",
    initialImportResultCompany: "Company",
    initialImportResultWineCount:
      "Wines registered",
    initialImportResultTotalBottles:
      "Total bottles",
    initialImportResultFile: "File",

    customerAdminTitle:
      "11. Customer company management (admin only)",
    customerAdminDescription:
      "Create new customer companies and track their onboarding, contract status, and initial import here. There is no way to delete a company from this screen; end a contract by setting its status to Cancelled.",
    customerLoadFailed:
      "Failed to load customer companies.",
    customerNoResults:
      "No matching customer companies.",
    customerNameRequired:
      "Company name is required.",
    customerCompanyName: "Company name",
    customerCompanyNamePlaceholder:
      "New company name",
    customerCreateButton: "Create company",
    customerCreating: "Creating...",
    customerCreateSuccess:
      "Customer company created.",
    customerCreateFailed:
      "Failed to create the customer company.",
    customerDuplicateWarningTitle:
      "A company with this name already exists",
    customerDuplicateWarningBody:
      "Existing companies with the same name: {names}",
    customerConfirmCreateDuplicate:
      "Create anyway",
    customerCancelDuplicate: "Cancel",
    customerSearchPlaceholder:
      "Search by company name",
    customerContractFilterLabel:
      "Contract status",
    customerOnboardingFilterLabel:
      "Onboarding status",
    customerFilterAll: "All",
    customerContractProspect: "Prospect",
    customerContractTrial: "Trial",
    customerContractActive: "Active",
    customerContractPaused: "Paused",
    customerContractCancelled: "Cancelled",
    customerOnboardingNew: "New",
    customerOnboardingWaitingExcel:
      "Waiting for Excel",
    customerOnboardingExcelReceived:
      "Excel received",
    customerOnboardingAnalyzing: "Analyzing",
    customerOnboardingReadyToImport:
      "Ready to import",
    customerOnboardingImported: "Imported",
    customerOnboardingActive: "Active",
    customerColCompany: "Company",
    customerColContractStatus:
      "Contract status",
    customerColOnboardingStatus:
      "Onboarding status",
    customerColWineCount: "Wines",
    customerColBottleCount: "Bottles",
    customerColImportCount: "Imports",
    customerColLatestImport:
      "Latest import",
    customerColCreatedAt: "Created",
    customerColActions: "Actions",
    customerWineCount: "Wine types",
    customerBottleCount: "Current bottles",
    customerImportCount:
      "Initial import count",
    customerLatestImport: "Latest import",
    customerLatestImportNone: "None yet",
    customerChargeableWineCount:
      "Chargeable wine count: {count}",
    customerCreatedAt: "Created at",
    customerDetails: "Details",
    customerDetailsTitle:
      "Customer company details",
    customerCompanyId: "Company ID",
    customerCurrentStock: "Current stock",
    customerImportHistory:
      "Initial import history",
    customerNoImportHistory:
      "No initial import yet.",
    customerOnboardingStatusLabel:
      "Onboarding status",
    customerContractStatusLabel:
      "Contract status",
    customerPlan: "Plan",
    customerInitialFee: "Initial fee (€)",
    customerMonthlyFee: "Monthly fee (€)",
    customerInternalNotes:
      "Internal notes",
    customerSave: "Save",
    customerSaving: "Saving...",
    customerSaveSuccess:
      "Customer company updated.",
    customerSaveFailed:
      "Failed to update the customer company.",
    customerNoDeleteNotice:
      "Companies cannot be deleted here. To end a contract, set its status to Cancelled.",
    customerClose: "Close",
    customerInitialImportDoneBadge:
      "Initial stock imported",

    customerUsersTitle:
      "12. Customer user management & invitations (admin only)",
    customerUsersDescription:
      "Select a company to see its users and invite new ones by email. A Supabase invite email is sent; no password is created here.",
    customerUsersCompany: "Company",
    customerUsersSelectCompanyPlaceholder:
      "Select a company...",
    customerUsersSelectCompanyPrompt:
      "Select a company to view its users.",
    customerUsersInviteEmail:
      "Email address to invite",
    customerUsersInviteHeading:
      "Invite a user to {company}",
    customerUsersInviteButton: "Invite",
    customerUsersInviting: "Sending...",
    customerUsersSelectCompanyFirst:
      "Please select a company first.",
    customerUsersInvalidEmail:
      "Please enter a valid email address.",
    customerUsersInviteFailed:
      "Failed to invite the user.",
    customerUsersInviteSuccess:
      "Invite email sent.",
    customerUsersAlreadyMember:
      "This user already belongs to this company.",
    customerUsersOtherCompany:
      "This email address belongs to a different company.",
    customerUsersNoProfileRow:
      "This user exists in Supabase Auth, but no profiles row was found. Manual review is required.",
    customerUsersInvitedNotLinked:
      "The invite email was sent, but assigning the company failed. Please check manually.",
    customerUsersLoadFailed:
      "Failed to load users.",
    customerUsersNoUsers:
      "This company has no users yet.",
    customerUsersColEmail: "Email",
    customerUsersColCreatedAt: "Created",
    customerUsersColEmailConfirmed:
      "Email confirmed",
    customerUsersColLastSignIn:
      "Last sign-in",
    customerUsersColStatus: "Status",
    customerUsersColAction: "Action",
    customerUsersActive: "Active",
    customerUsersInvited: "Invited",
    customerUsersUnconfirmed:
      "Unconfirmed",
    customerUsersUnknownStatus: "Unknown",
    customerUsersNever: "Never",
    customerUsersYes: "Yes",
    customerUsersNo: "No",
    customerUsersResendInvite:
      "Resend invite",
    customerUsersResending: "Sending...",
    customerUsersResendSuccess:
      "Invite email resent.",
    customerUsersResendFailed:
      "Failed to resend the invite.",
    customerUsersAlreadyConfirmed:
      "This user has already confirmed their email; the invite cannot be resent.",
    customerUsersSendPasswordSetup:
      "Send password setup link",
    customerUsersSendingPasswordSetup:
      "Sending...",
    customerUsersPasswordSetupSuccess:
      "Password setup email sent.",
    customerUsersPasswordSetupFailed:
      "Failed to send the password setup email.",
    customerUsersColRole: "Role",
    customerUsersInviteRoleLabel: "Role",
    customerUsersRoleOwner: "Owner",
    customerUsersRoleStaff: "Staff",
    customerUsersRoleViewer: "Viewer",
    customerUsersRoleUpdateSuccess:
      "Role updated.",
    customerUsersRoleUpdateFailed:
      "Failed to update the role.",
    customerUsersLastOwnerProtection:
      "Cannot change this role: they are the only owner of this company.",
    viewerReadOnlyAction:
      "Your role (viewer) does not allow this action.",
    ownerOnlyAction:
      "Only the company owner can perform this action.",
    viewerBanner:
      "Read only: this account cannot modify data.",

    section16Title: "16. Data Backup / Export",
    section16Description:
      "Export current inventory and stock movement history to Excel/CSV at any time. This is a read-only feature available to owner, staff and viewer alike, and it never includes another company's data.",
    exportCurrentInventoryExcel: "Current Inventory Excel",
    exportCurrentInventoryCsv: "Current Inventory CSV",
    exportFullBackupExcel: "Full Backup Excel",
    exportRunning: "Exporting...",
    exportCompanyMissing:
      "Unable to retrieve company information. Please reload the page and try again.",
    exportInventoryFetchFailed:
      "Failed to load current inventory: {error}",
    exportMovementsFetchFailed:
      "Failed to load stock movement history: {error}",
    exportBuildFailed:
      "Failed to build the file: {error}",
    exportNoInventoryData:
      "No inventory data to export (all stock is at 0).",
    exportNoMovementsData:
      "No stock movement history to export.",
    exportInventorySuccess:
      "Current inventory Excel exported ({count} rows).",
    exportInventoryCsvSuccess:
      "Current inventory CSV exported ({count} rows).",
    exportFullBackupSuccess:
      "Full backup Excel exported (inventory: {inventoryCount} / movements: {movementCount}).",

    section17Title: "17. Stock Alerts / Reorder",
    section17Description:
      "See out-of-stock and low-stock wines at a glance. Every active (non-merged) wine in the company is covered; minimum stock and target stock are optional and set per wine. A wine with no settings never triggers an alert.",
    alertSummaryOutOfStock: "Out of stock",
    alertSummaryLowStock: "Low stock",
    alertSummaryConfigured: "Alerts configured",
    alertSummaryRecommendedOrder: "Bottles to reorder",
    alertColProducer: "Producer",
    alertColWine: "Wine",
    alertColCuvee: "Cuvée",
    alertColVintage: "Vintage",
    alertColCurrentStock: "Current Stock",
    alertColMinStock: "Minimum Stock",
    alertColTargetStock: "Target Stock",
    alertColStatus: "Status",
    alertColRecommendedOrder: "Recommended Order",
    alertColAlert: "Alert",
    alertColSave: "Save",
    alertStatusNotSet: "Not set",
    alertStatusOff: "OFF",
    alertStatusOutOfStock: "Out of stock",
    alertStatusLowStock: "Low stock",
    alertStatusOk: "OK",
    alertFilterLabel: "Filter",
    alertFilterAll: "All",
    alertFilterNeedsAction: "Needs action",
    alertFilterOutOfStock: "Out of stock",
    alertFilterLowStock: "Low stock",
    alertFilterOk: "OK",
    alertFilterNotSet: "Not set",
    alertFilterAlertEnabled: "Alerts configured",
    alertFilterReorder: "Reorder needed",
    alertSearchPlaceholder: "e.g. chablis 2022",
    alertSearchNoResults: "No matching wine found.",
    alertRecommendedOrderNotSet: "—",
    alertMinQuantityLabel: "Minimum stock",
    alertTargetQuantityLabel: "Target stock (optional)",
    alertEnabledLabel: "Enable alert",
    alertSaveButton: "Save",
    alertSaving: "Saving...",
    alertSaveSuccess: "Saved: {producer} {vintage}",
    alertSaveFailed: "Failed to save: {error}",
    alertInvalidMinQuantity:
      "Minimum stock must be a number of 0 or more.",
    alertInvalidTargetQuantity:
      "Target stock must be a number of 0 or more, or left blank.",
    alertTargetLessThanMin:
      "Target stock must be greater than or equal to minimum stock.",
    alertCompanyMissing:
      "Unable to retrieve company information. Please reload the page and try again.",
    alertWinesFetchFailed:
      "Failed to load wines: {error}",
    alertInventoryFetchFailed:
      "Failed to load current stock: {error}",
    alertSettingsFetchFailed:
      "Failed to load alert settings: {error}",
    alertLoading: "Loading...",
    alertNoResults: "No wines match this filter.",
    alertRefresh: "Refresh",
  },
} as const;

type ExtraUiI18nKey = keyof (typeof EXTRA_UI_I18N)["JA"];
type ExtraUiParams = Record<string, string | number>;

function extraUiText(
  lang: AppLanguage,
  key: ExtraUiI18nKey,
  params?: ExtraUiParams
) {
  let text: string = EXTRA_UI_I18N[lang][key];
  if (!params) return text;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

type AppI18nKey =
  keyof (typeof APP_I18N)["JA"];

type AppMessageParams = Record<
  string,
  string | number
>;

type AppMessage = {
  key: AppI18nKey;
  params?: AppMessageParams;
};

/*
 * 初回利用時、保存済みの言語設定が無い場合に
 * ブラウザの言語からアプリの初期言語を推測する。
 *
 * fr-* -> Français
 * ja-* -> 日本語
 * それ以外 -> English
 */
function detectBrowserAppLanguage(): AppLanguage {
  if (typeof navigator === "undefined") {
    return "EN";
  }

  const candidates =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language || ""];

  for (const raw of candidates) {
    const lang = String(raw || "").toLowerCase();
    if (lang.startsWith("fr")) return "FR";
    if (lang.startsWith("ja")) return "JA";
  }

  return "EN";
}

function loadStoredAppLanguage(): AppLanguage | null {
  try {
    const stored = localStorage.getItem(
      APP_LANGUAGE_STORAGE_KEY
    );

    if (
      stored === "FR" ||
      stored === "JA" ||
      stored === "EN"
    ) {
      return stored;
    }
  } catch {
    // localStorageが使えない環境（プライベートモード等）は無視して既定値を使う
  }

  return null;
}

type Item = {
  wineId?: string;
  status: StatusCode;
  date: string;  invoiceNo: string;
  supplier: string;
  customer: string;
  producer: string;
  cuvee: string;
  raw: string;
  color: string;
  vintage: string;
  size: number;
  alcohol: string;
  qty: number;
  unit: number;
  amount: number;
  confidence: number;
  memo: string;
};

type AIResult = {
  supplier: string;
  customer: string;
  invoice_no: string;
  invoice_date: string;
  currency: string;
  items: any[];
  shipping_ht: number;
  total_ht: number;
  tva: number;
  total_ttc: number;
  warnings: string[];
};

type WineClassification = {
  wine_id: string;
  country: string;
  region: string;
  subregion: string;
  appellation: string;
  climat: string;
  cru_level:
    | "GRAND_CRU"
    | "PREMIER_CRU"
    | "VILLAGE"
    | "REGIONAL"
    | "NONE"
    | "UNKNOWN";
  category: "SPARKLING" | "WHITE" | "ROSE" | "RED" | "SPIRIT" | "UNKNOWN";
   confidence: number;
  notes: string;
};

type EditableWineClassificationKey = Exclude<
  keyof WineClassification,
  "wine_id" | "confidence"
>;

type CuveeSuggestion = {
  wine_id: string;
  cuvee: string;
  confidence: number;
  notes: string;
};

type PreviewFile = { name: string; type: string; url: string };

type WineListRow = {
  company_id: string;
  wine_id: string;

  producer: string;
  wine_name: string;
  cuvee: string;
  vintage: string;
  bottle_size_cl: number;
  current_quantity: number;
  avg_cost_ht: number;

  country: string;
  region: string;
  subregion: string;
  appellation: string;
  climat: string;
  cru_level:
    | "GRAND_CRU"
    | "PREMIER_CRU"
    | "VILLAGE"
    | "REGIONAL"
    | "NONE"
    | "UNKNOWN";

  category:
    | "SPARKLING"
    | "WHITE"
    | "ROSE"
    | "RED"
    | "SPIRIT"
    | "UNKNOWN";

  sale_price: number | null;
  manual_price: boolean;
  is_listed: boolean;
  list_notes: string | null;

  /*
   * Section 7 MANAGEモード専用のフラグ。
   * CUSTOMERモード(wine_list_view由来)は常にINNER JOINで
   * 両方揃っている行しか来ないため、常にtrueにする。
   * MANAGEモードはinventory_viewを母体に
   * wine_classification_memory/wine_list_settingsを
   * LEFT JOIN相当でmergeするため、行が無い場合はfalseになる。
   * DBへplaceholder行をINSERTすることはない
   * （falseのままUI表示だけで安全なデフォルトを使う）。
   */
  hasClassification: boolean;
  hasListSettings: boolean;
};

/*
 * Section 7「要確認 / 未分類」の自動判定候補。
 * DBへは「一括保存」でチェックされた行だけを書き込む
 * （判定直後はUI stateのみで、DBは一切変更しない）。
 */
type WineReviewCandidate = WineClassification & {
  producer: string;
  wine_name: string;
  cuvee: string;
  vintage: string;
  color: string;
  hadClassification: boolean;
  regionSource: "RULE" | "AI" | "EXISTING" | "NONE";
  categorySource:
    | "COLOR"
    | "RULE"
    | "AI"
    | "EXISTING"
    | "NONE";
  edited: boolean;
  selected: boolean;
};

/*
 * 分類ルール判定用の比較テキスト正規化
 * （アクセント・大文字小文字・記号の違いを吸収。DB値は変更しない）。
 */
function normalizeWineRuleText(value: unknown) {
  return ` ${String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, " ")
    .trim()} `;
}

/*
 * region空欄・"Unknown"相当を「未設定」とみなす。
 */
function isUnknownWineRegion(region: unknown) {
  const text = normalizeWineRuleText(region).trim();

  return (
    !text ||
    text === "unknown" ||
    text === "inconnu" ||
    text === "inconnue" ||
    text === "不明" ||
    text === "n a"
  );
}

/*
 * 在庫のcolorからcategoryを判定する（最優先ルール）。
 * 判定できない場合はnull。
 */
function wineCategoryFromColor(
  color: unknown
): WineClassification["category"] | null {
  const text = normalizeWineRuleText(color);

  if (
    /\b(sparkling|champagne|cremant|petillant|mousseux|effervescent)\b/.test(text) ||
    text.includes("泡")
  ) {
    return "SPARKLING";
  }

  if (/\b(rose|rosado|rosato)\b/.test(text) || text.includes("ロゼ")) {
    return "ROSE";
  }

  if (/\b(white|blanc|blanche|bianco|blanco)\b/.test(text) || text.includes("白")) {
    return "WHITE";
  }

  if (/\b(red|rouge|rosso|tinto)\b/.test(text) || text.includes("赤")) {
    return "RED";
  }

  return null;
}

/*
 * Champagne / Crémant は色情報より優先してSPARKLING
 * （/api/classify-winesの既存ルールと同じ扱い）。
 */
function isSparklingByName(text: string) {
  return (
    /\b(champagne|cremant)\b/.test(text) &&
    !isSpiritByName(text)
  );
}

/*
 * Cognac / Armagnac（例：Fine Champagne Cognac）は
 * キーワードルールの対象外にしてAI判定に任せる。
 */
function isSpiritByName(text: string) {
  return /\b(cognac|armagnac)\b/.test(text);
}

/*
 * producer / wine_name / cuvee に含まれるアペラシオン等の
 * キーワードからregionを判定する。regionの表記は
 * /api/classify-winesのプロンプト例（Bourgogne, Rhone等）に揃える。
 * 上から順に評価し、最初に一致したものを採用する。
 */
const WINE_REGION_KEYWORD_RULES: {
  region: string;
  keywords: string[];
}[] = [
  { region: "Champagne", keywords: ["champagne"] },
  {
    region: "Beaujolais",
    keywords: [
      "beaujolais", "morgon", "fleurie", "moulin a vent", "julienas",
      "chenas", "chiroubles", "brouilly", "regnie", "saint amour",
      "st amour",
    ],
  },
  {
    region: "Loire",
    keywords: [
      "sancerre", "pouilly fume", "vouvray", "chinon", "bourgueil",
      "saumur", "muscadet", "savennieres", "montlouis", "menetou salon",
      "quincy", "reuilly", "anjou", "touraine", "cheverny",
    ],
  },
  {
    region: "Bourgogne",
    keywords: [
      "chablis", "bourgogne", "meursault", "puligny", "chassagne",
      "gevrey", "chambertin", "vosne", "nuits saint georges",
      "nuits st georges", "volnay", "pommard", "beaune", "corton",
      "montrachet", "santenay", "savigny", "marsannay", "fixin",
      "morey saint denis", "chambolle", "musigny", "vougeot",
      "echezeaux", "aloxe", "pernand", "monthelie", "auxey",
      "saint aubin", "saint romain", "rully", "mercurey", "givry",
      "montagny", "macon", "pouilly fuisse", "saint veran",
      "vire clesse", "irancy", "maranges", "ladoix", "bouzeron",
      "st aubin", "st romain", "st veran",
    ],
  },
  {
    region: "Rhone",
    keywords: [
      "chateauneuf du pape", "crozes hermitage", "hermitage",
      "cote rotie", "condrieu", "cornas", "saint joseph", "gigondas",
      "vacqueyras", "cotes du rhone", "cote du rhone", "lirac", "tavel",
      "rasteau", "cairanne", "st joseph",
    ],
  },
  {
    region: "Bordeaux",
    keywords: [
      "bordeaux", "pauillac", "margaux", "saint julien", "saint estephe",
      "pomerol", "saint emilion", "pessac", "sauternes", "barsac",
      "medoc", "fronsac", "st julien", "st estephe", "st emilion",
    ],
  },
  { region: "Alsace", keywords: ["alsace"] },
  { region: "Jura", keywords: ["jura", "arbois", "chateau chalon"] },
];

/*
 * Section 7「価格未設定」の推奨販売価格ルール。
 * 常に 原価HT × 1.2 × 2（= ×2.4）とし、5€単位へ切り上げる
 * （価格帯ごとの倍率分岐は無し）。
 * 例：33.60 × 2.4 = 80.64 → 85€ / 150 × 2.4 = 360 → 360€
 * 原価が0・null・不正値の場合はnull（自動価格を出さず要確認）。
 */
const WINE_SALE_PRICE_MULTIPLIER = 1.2 * 2;

function recommendedSalePriceFromCost(
  cost: unknown
): { multiplier: number; price: number } | null {
  const value = Number(cost);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const multiplier = WINE_SALE_PRICE_MULTIPLIER;

  // 浮動小数誤差(例: 90.0000001)で余計に5€上がらないよう、
  // いったんセント単位に丸めてから切り上げる。
  const raw = Math.round(value * multiplier * 100) / 100;

  return {
    multiplier,
    price: Math.ceil(raw / 5) * 5,
  };
}

function wineRegionFromKeywords(text: string): string | null {
  if (isSpiritByName(text)) {
    return null;
  }

  for (const rule of WINE_REGION_KEYWORD_RULES) {
    if (
      rule.keywords.some((keyword) =>
        text.includes(` ${keyword} `)
      )
    ) {
      return rule.region;
    }
  }

  return null;
}

type InventoryEditDraft = {
  producer: string;
  wineName: string;
  cuvee: string;
  vintage: string;
  color: string;
  size: string;
  alcohol: string;
  quantity: string;
  reason: string;
  note: string;
};

type SoldBottleAiItem = {
  producer: string;
  wine_name: string;
  cuvee: string;
  vintage: string;
  bottle_size_cl: number | null;
  quantity: number;
  confidence: number;
  notes: string;
};

type SoldBottleCandidate = {
  wineId: string;
  score: number;
  producerScore: number;
  stock: number;
  label: string;
};

type SoldBottleDetection = SoldBottleAiItem & {
  id: string;
  candidates: SoldBottleCandidate[];
  selectedWineId: string;
  searchQuery: string;
};

/*
 * Section 9「在庫移動履歴」用の型。
 * stock_movementsの行そのまま + created_atは
 * 存在する場合だけ入る（無ければundefined）。
 */
type StockMovementRow = {
  id: string;
  wine_id: string;
  movement_type: string;
  quantity: number;
  unit_cost_ht: number | null;
  movement_date: string;
  created_at?: string | null;
  notes: string | null;
};

/*
 * Section 17「在庫アラート / 補充候補」用の型。
 *
 * NOT_SET : wine_stock_alert_settings行が無い（未設定）。
 * OFF     : 行はあるがalert_enabled=false。
 * OUT_OF_STOCK / LOW_STOCK / OK : alert_enabled=trueの場合だけ判定する。
 *
 * settings行が無いwineをいきなり警告状態にしないため、
 * NOT_SET/OFFのどちらもOUT_OF_STOCK/LOW_STOCKには絶対にならない。
 */
type StockAlertStatus =
  | "NOT_SET"
  | "OFF"
  | "OUT_OF_STOCK"
  | "LOW_STOCK"
  | "OK";

type StockAlertRow = {
  wineId: string;
  producer: string;
  wineName: string;
  cuvee: string;
  vintage: string;
  currentQuantity: number;
  hasSettings: boolean;
  minQuantity: number;
  targetQuantity: number | null;
  alertEnabled: boolean;
  status: StockAlertStatus;
  // target_quantity未設定、またはalert_enabled=falseの場合はnull
  // （min_quantityとの差を代わりに使わない。表示は「未設定」）。
  recommendedOrderQuantity: number | null;
};

/*
 * 一覧の各行が保持する編集中ドラフト値。保存ボタンを押すまでは
 * DBへ反映しない。文字列で保持し、保存時にバリデーション・変換する
 * （数値inputの一時的な空文字・不正値をそのまま許容するため）。
 */
type StockAlertDraft = {
  minQuantity: string;
  targetQuantity: string;
  alertEnabled: boolean;
};

type StockHistoryWineInfo = {
  producer: string;
  wineName: string;
  cuvee: string;
  vintage: string;
  size: number;
  color: string;
};

/*
 * Section 11「顧客会社管理」用の型。
 * /api/admin/customers が admin_customer_summary_view から
 * そのまま返す形にあわせている。
 */
type CustomerSummaryRow = {
  company_id: string;
  company_name: string;
  company_created_at: string;
  wine_count: number;
  current_bottles: number;
  last_stock_movement_date: string | null;
  initial_import_batch_count: number;
  latest_initial_import_at: string | null;
  latest_initial_import_filename: string | null;
  latest_initial_import_unique_wines: number | null;
  latest_initial_import_total_bottles: number | null;
  onboarding_status: string;
  contract_status: string;
  plan_name: string | null;
  initial_fee_eur: number | null;
  monthly_fee_eur: number | null;
  internal_notes: string | null;
  metadata_updated_at: string | null;
};

/*
 * Section 12「顧客ユーザー管理・招待」用の型。
 * /api/admin/company-users がそのまま返す形にあわせている。
 */
type CompanyUserRow = {
  userId: string;
  role: string;
  email: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  status: "ACTIVE" | "INVITED" | "UNCONFIRMED" | "UNKNOWN";
};

function normalizeSoldBottleText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\b(CHATEAU|DOMAINE|MAISON|EARL|SCEA|SARL|SAS)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/*
 * 4桁の実Vintageだけを数値として扱う。
 * NVや空欄はnullを返し、並び替えでは常に最後に置く。
 */
function parseVintageYear(
  value: unknown
): number | null {
  const text = String(value || "").trim();

  if (!/^\d{4}$/.test(text)) {
    return null;
  }

  return Number(text);
}

function soldBottleTokenSimilarity(
  a: unknown,
  b: unknown
) {
  const aTokens = new Set(
    normalizeSoldBottleText(a)
      .split(" ")
      .filter(Boolean)
  );

  const bTokens = new Set(
    normalizeSoldBottleText(b)
      .split(" ")
      .filter(Boolean)
  );

  if (
    aTokens.size === 0 ||
    bTokens.size === 0
  ) {
    return 0;
  }

  const intersection =
    Array.from(aTokens).filter((token) =>
      bTokens.has(token)
    ).length;

  const union =
    new Set([
      ...Array.from(aTokens),
      ...Array.from(bTokens),
    ]).size;

  return union === 0
    ? 0
    : intersection / union;
}

/*
 * producer類似度だけを取り出したスコア。
 *
 * 候補のランキングには他要素と合わせて使うが、
 * 「AIだけでの自動選択」を許可するかどうかの
 * 安全ゲートとしても別途使う（producerが弱いのに
 * 自動確定してしまうのを防ぐ）。
 */
function soldBottleProducerScore(
  detected: SoldBottleAiItem,
  row: Item
) {
  return soldBottleTokenSimilarity(
    detected.producer,
    row.producer
  );
}

function scoreSoldBottleInventoryMatch(
  detected: SoldBottleAiItem,
  row: Item
) {
  const detectedProducer =
    normalizeSoldBottleText(
      detected.producer
    );

  const rowProducer =
    normalizeSoldBottleText(
      row.producer
    );

  const detectedWineText =
    `${detected.wine_name || ""} ${
      detected.cuvee || ""
    }`;

  const rowWineText =
    `${row.raw || ""} ${row.cuvee || ""}`;

  let score =
    soldBottleProducerScore(
      detected,
      row
    ) * 0.48 +
    soldBottleTokenSimilarity(
      detectedWineText,
      rowWineText
    ) * 0.34;

  if (
    detectedProducer &&
    rowProducer &&
    detectedProducer === rowProducer
  ) {
    score += 0.12;
  }

  const detectedVintage =
    String(
      detected.vintage || ""
    ).trim();

  const rowVintage =
    String(row.vintage || "").trim();

  /*
   * Vintageが明確に一致する場合は、
   * producerの誤読（古酒でよくある）に負けないよう
   * 強めに評価する。空欄同士・片方空欄は
   * ペナルティなし（従来通り）。
   */
  if (
    detectedVintage &&
    rowVintage
  ) {
    score +=
      detectedVintage === rowVintage
        ? 0.25
        : -0.12;
  }

  const detectedSize =
    Number(
      detected.bottle_size_cl || 0
    );

  const rowSize =
    Number(row.size || 75);

  if (
    detectedSize > 0 &&
    rowSize > 0
  ) {
    score +=
      detectedSize === rowSize
        ? 0.05
        : -0.03;
  }

  return Math.max(
    0,
    Math.min(1, score)
  );
}

function today() { return new Date().toISOString().slice(0, 10); }

/*
 * Section 16のExportファイル名用に、会社名をファイル名に安全な
 * セグメントへ変換する（英数字・アンダースコア以外は"_"に置換し、
 * 連続する"_"・先頭末尾の"_"を圧縮する）。空になった場合や
 * 会社名が未取得の場合は呼び出し側で"BON_PINARD"へfallbackする
 * （既存のtUi("inventoryFileBase")と同じ、アプリ名によるfallback）。
 */
function sanitizeExportFilenameSegment(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function statusLabel(status: StatusCode) {
  if (status === "CONFIRMED") return "確認済";
  if (status === "NEEDS_CHECK") return "要確認";
  return "手入力";
}

function cruLevelLabel(level: WineClassification["cru_level"]) {
  if (level === "GRAND_CRU") return "Grand Cru";
  if (level === "PREMIER_CRU") return "1er Cru";
  if (level === "VILLAGE") return "Village";
  if (level === "REGIONAL") return "Régional";
  if (level === "NONE") return "";
  return "要確認";
}

function normalizeDate(s: string) {  if (!s) return "";
  const m = String(s).match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  const m2 = String(s).match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m2) return `${m2[3]}-${String(m2[2]).padStart(2, "0")}-${String(m2[1]).padStart(2, "0")}`;
  return "";
}

function wineKey(r: Item) {
  return [(r.producer || "").trim().toUpperCase(), (r.raw || r.cuvee || "").trim().toUpperCase(), (r.vintage || "").trim(), String(r.size || 75)].join(" | ");
}

function supplierKey(name: string) { return (name || "UNKNOWN SUPPLIER").trim().toUpperCase(); }

function getStoredJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

/*
 * マルチテナント対応：Section 1周りのcompany固有localStorageを
 * companyIdでキー分離するための共通ヘルパー。RLSはlocalStorageを
 * 保護できないため、同じブラウザで別companyへログインした場合に
 * 前のcompanyのキャッシュが見えてしまわないよう、client側で
 * companyIdをキーへ含める。
 *
 * companyId未確定(null)の間はnullを返す。呼び出し側はnullの場合、
 * company固有データの読み書きを一切行わない
 * （company_id不明のグローバルキーへ書き込む・そこから読むことを
 * 避けるため）。companyNameではなくcompanyIdを使う
 * （会社名変更でキーが変わらないようにするため）。
 */
function companyScopedStorageKey(
  baseKey: string,
  companyId: string | null
): string | null {
  return companyId ? `${baseKey}:${companyId}` : null;
}

/*
 * companyIdが未確定の場合は何もしない
 * （company_id不明のままグローバルキーへ書き込むと、後で
 * company別キーへ正しく仕分けできなくなるため）。
 */
function saveMastersFromInventory(
  rows: Item[],
  companyId: string | null
) {
  const supplierMasterKey = companyScopedStorageKey(
    "bon_pinard_supplier_master",
    companyId
  );
  const wineMasterKey = companyScopedStorageKey(
    "bon_pinard_wine_master",
    companyId
  );
  const priceHistoryKey = companyScopedStorageKey(
    "bon_pinard_price_history",
    companyId
  );

  if (!supplierMasterKey || !wineMasterKey || !priceHistoryKey) {
    return;
  }

  const suppliers = getStoredJson<Record<string, any>>(supplierMasterKey, {});
  const wines = getStoredJson<Record<string, any>>(wineMasterKey, {});
  const priceHistory = getStoredJson<any[]>(priceHistoryKey, []);

  rows.forEach((r) => {
    suppliers[supplierKey(r.supplier)] = { name: r.supplier || "UNKNOWN SUPPLIER", lastUsedAt: new Date().toISOString() };
    wines[wineKey(r)] = {
      producer: r.producer, wineName: r.raw, cuvee: r.cuvee, color: r.color,
      vintage: r.vintage, bottleSizeCl: r.size, alcohol: r.alcohol, lastUpdatedAt: new Date().toISOString()
    };
    if (r.unit || r.amount) {
      priceHistory.push({
        date: r.date, invoiceNo: r.invoiceNo, supplier: r.supplier, producer: r.producer,
        wineName: r.raw, cuvee: r.cuvee, vintage: r.vintage, bottleSizeCl: r.size,
        quantity: r.qty, unitPriceHT: r.unit, amountHT: r.amount, recordedAt: new Date().toISOString()
      });
    }
  });

  localStorage.setItem(supplierMasterKey, JSON.stringify(suppliers));
  localStorage.setItem(wineMasterKey, JSON.stringify(wines));
  localStorage.setItem(priceHistoryKey, JSON.stringify(priceHistory.slice(-2000)));
}

function findDuplicateWarnings(existing: Item[], incoming: Item[], language: AppLanguage) {
  const existingSet = new Set(existing.map((r) => `${r.invoiceNo} | ${wineKey(r)}`));
  const warnings: string[] = [];
  incoming.forEach((r) => {
    const key = `${r.invoiceNo} | ${wineKey(r)}`;
    if (existingSet.has(key)) {
      warnings.push(
        extraUiText(language, "duplicateWarning", {
          invoice: r.invoiceNo,
          producer: r.producer,
          wine: r.raw || r.cuvee,
          vintage: r.vintage,
        })
      );
    }
  });
  return warnings;
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<PreviewFile | null>(null);
  const [supplier, setSupplier] = useState("UNKNOWN SUPPLIER");
  /*
   * 自社(customer)の初期値。ハードコードした特定company名を
   * 出さないよう空文字から開始し、currentCompanyName取得後に
   * 一度だけ初期値として反映する（下のuseEffect参照）。
   * localStorage復元・AI解析結果・手動編集で既に値が入っている
   * 場合はそれを優先し、上書きしない。
   */
  const [customer, setCustomer] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [inventory, setInventory] = useState<Item[]>([]);
const [allInventory, setAllInventory] = useState<Item[]>([]);
const [inventorySearch, setInventorySearch] = useState("");

const [inventorySortMode, setInventorySortMode] =
  useState<
    | "PRODUCER_ASC"
    | "VINTAGE_DESC"
    | "VINTAGE_ASC"
    | "QTY_ASC"
    | "QTY_DESC"
    | "COST_DESC"
    | "COST_ASC"
  >("PRODUCER_ASC");

const [inventoryStockFilter, setInventoryStockFilter] =
  useState<
    | "ALL"
    | "IN_STOCK"
    | "ZERO"
    | "ONE"
    | "TWO_OR_FEWER"
  >("ALL");

/*
 * Section 4「0在庫も表示」トグル。
 *
 * OFF（既定）: 従来通りloadCloudInventory()は
 * inventory_view側でcurrent_quantity<>0のみ取得する
 * （挙動は完全に維持）。
 * ON: wines(is_active=true, merged_into_wine_id is null)を
 * 母体にし、inventory_viewをwine_idキーでLEFT JOIN相当にmergeして
 * current_quantity=0のwineも含めて取得する（Section 17の
 * loadStockAlertData()と同じ考え方）。
 *
 * allInventoryをそのまま差し替えるため、検索(inventorySearchTokens)・
 * 既存の在庫フィルター(inventoryStockFilter「在庫0」等)・数量編集
 * (saveInventoryEdit)は無改修でそのまま動作する。
 */
const [
  showZeroStockInventory,
  setShowZeroStockInventory,
] = useState(false);

/*
 * Section 4「在庫確認済み（棚卸確認）」。
 *
 * inventory_stocktake_checks（1 company × 1 wine = 最新の確認状態1件）
 * をwine_id → checked_atのmapとして保持する。行がある=確認済み。
 * 数量調整(stock_movements)とは独立した明示操作でのみ更新する。
 *
 * hideCheckedInventory: 「確認済みを非表示」トグル（既定OFF）。
 * 表示切り替えのみのためviewerも操作可能。
 */
const [
  stocktakeCheckedAtByWineId,
  setStocktakeCheckedAtByWineId,
] = useState<Record<string, string>>({});

const [
  hideCheckedInventory,
  setHideCheckedInventory,
] = useState(false);

const [
  savingStocktakeWineId,
  setSavingStocktakeWineId,
] = useState<string | null>(null);

const [
  resettingStocktakeChecks,
  setResettingStocktakeChecks,
] = useState(false);

const [
  editingInventoryWineId,
  setEditingInventoryWineId,
] = useState<string | null>(null);

const [
  inventoryEditDraft,
  setInventoryEditDraft,
] = useState<InventoryEditDraft | null>(null);

/*
 * 編集開始時点のスナップショット。
 * これとinventoryEditDraftを比較して
 * 「未保存の変更があるか」を判定する。
 */
const [
  inventoryEditOriginalDraft,
  setInventoryEditOriginalDraft,
] = useState<InventoryEditDraft | null>(null);

const [
  savingInventoryEdit,
  setSavingInventoryEdit,
] = useState(false);

/*
 * 数量変更時に調整理由が未選択、または
 * OTHER選択時にメモが空のまま保存を押した場合に
 * trueにして、該当フィールドを赤枠で示す。
 */
const [
  inventoryEditReasonError,
  setInventoryEditReasonError,
] = useState(false);

const [
  soldBottleFiles,
  setSoldBottleFiles,
] = useState<File[]>([]);

const [
  soldBottlePreviews,
  setSoldBottlePreviews,
] = useState<PreviewFile[]>([]);

const [
  soldBottleDetections,
  setSoldBottleDetections,
] = useState<SoldBottleDetection[]>([]);

const [
  soldBottleStatus,
  setSoldBottleStatus,
] = useState("");

const [
  analyzingSoldBottles,
  setAnalyzingSoldBottles,
] = useState(false);

const [
  applyingSoldBottles,
  setApplyingSoldBottles,
] = useState(false);

const [wineClassifications, setWineClassifications] =
  useState<WineClassification[]>([]);

const [classifyingWines, setClassifyingWines] = useState(false);

const [
  classificationStatus,
  setClassificationStatus,
] = useState<AppMessage | null>(
  null
);

const [manuallyEditedWineIds, setManuallyEditedWineIds] =
  useState<string[]>([]);

const [confirmedWineIds, setConfirmedWineIds] =
  useState<string[]>([]);

const [memoryMatchedWineIds, setMemoryMatchedWineIds] =
  useState<string[]>([]);

const [savingClassificationWineIds, setSavingClassificationWineIds] =
  useState<string[]>([]);

const [cuveeSuggestions, setCuveeSuggestions] =
  useState<CuveeSuggestion[]>([]);

const [extractingCuvee, setExtractingCuvee] =
  useState(false);

const [cuveeStatus, setCuveeStatus] =
  useState("");

const [manuallyEditedCuveeWineIds, setManuallyEditedCuveeWineIds] =
  useState<string[]>([]);

const [confirmedCuveeWineIds, setConfirmedCuveeWineIds] =
  useState<string[]>([]);

const [savingCuveeWineIds, setSavingCuveeWineIds] =
  useState<string[]>([]);

const [duplicateResolutions, setDuplicateResolutions] =
  useState<Record<string, "PENDING" | "SAME" | "DIFFERENT">>({});

const [
  savedDifferentDuplicatePairs,
  setSavedDifferentDuplicatePairs,
] = useState<Record<string, true>>({});

const [duplicateViewFilter, setDuplicateViewFilter] =
  useState<"ALL" | "EXACT" | "HIGH" | "REVIEW">("ALL");

const [exactDuplicateReviewMode, setExactDuplicateReviewMode] =
  useState(false);

const [mergingWineIds, setMergingWineIds] =
  useState<string[]>([]);

const [mergeStatus, setMergeStatus] =
  useState("");

const [wineList, setWineList] =
  useState<WineListRow[]>([]);

const [wineReviewCandidates, setWineReviewCandidates] =
  useState<WineReviewCandidate[]>([]);

const [wineReviewClassifying, setWineReviewClassifying] =
  useState(false);

const [wineReviewSaving, setWineReviewSaving] =
  useState(false);

const [wineReviewStatus, setWineReviewStatus] =
  useState("");

/*
 * Section 7「価格未設定」パネル。
 *
 * pricingActiveWineIds: inventory_viewにはis_active/merged条件が
 * 無いため、候補wine_idのうち wines(is_active=true,
 * merged_into_wine_id is null) のものだけを別途取得して保持する
 * （null=未取得）。
 * pricingDrafts / pricingSelected: wine_idごとの入力値・チェック。
 * 未設定(undefined)の場合は推奨価格・既定チェックを使う。
 */
const [pricingActiveWineIds, setPricingActiveWineIds] =
  useState<Set<string> | null>(null);

const [pricingDrafts, setPricingDrafts] =
  useState<Record<string, string>>({});

const [pricingSelected, setPricingSelected] =
  useState<Record<string, boolean>>({});

const [pricingOnlyUnpriced, setPricingOnlyUnpriced] =
  useState(true);

const [pricingListingFilter, setPricingListingFilter] =
  useState<"ALL" | "LISTED" | "UNLISTED">("ALL");

const [pricingRegionFilter, setPricingRegionFilter] =
  useState("ALL");

const [pricingCategoryFilter, setPricingCategoryFilter] =
  useState<WineListRow["category"] | "ALL">("ALL");

const [pricingSaving, setPricingSaving] =
  useState(false);

const [pricingStatus, setPricingStatus] =
  useState("");


const [wineListLoading, setWineListLoading] =
  useState(false);

const [wineListStatus, setWineListStatus] =
  useState("");

/*
 * お客様向けワインリストのヘッダー。
 * UI言語とは独立した自由入力テキストとしてSupabaseへ保存する。
 * タイトルの初期値はハードコードした特定company名にはせず、
 * 空文字から開始する（DBに保存済みタイトルが無い場合だけ、
 * currentCompanyNameを初期値として反映する。下のuseEffect参照）。
 */
const [wineListHeaderTitle, setWineListHeaderTitle] =
  useState("");

const [wineListHeaderSubtitle, setWineListHeaderSubtitle] =
  useState("Carte des vins");

/*
 * Supabaseにそのcompany用の保存済みタイトル行が存在するかどうか。
 * null=未確認、true=保存済みあり(既にtitleへ反映済み)、
 * false=保存済みなし(company名フォールバックの対象)。
 * 保存済みタイトルを絶対に上書きしないためのガードとして使う。
 */
const [wineListHeaderHasSavedRow, setWineListHeaderHasSavedRow] =
  useState<boolean | null>(null);

const [wineListHeaderSaving, setWineListHeaderSaving] =
  useState(false);

const [wineListHeaderStatus, setWineListHeaderStatus] =
  useState("");

const [winePriceDrafts, setWinePriceDrafts] =
  useState<Record<string, string>>({});

const [savingWinePriceIds, setSavingWinePriceIds] =
  useState<string[]>([]);

const [savingWineListingIds, setSavingWineListingIds] =
  useState<string[]>([]);

const [wineListViewMode, setWineListViewMode] =
  useState<"LISTED" | "UNLISTED" | "ALL">("LISTED");

const [wineListCategoryFilter, setWineListCategoryFilter] =
  useState<WineListRow["category"] | "ALL">("ALL");

const [wineListRegionFilter, setWineListRegionFilter] =
  useState("ALL");

const [wineListDisplayMode, setWineListDisplayMode] =
  useState<"MANAGE" | "CUSTOMER">("MANAGE");

/*
 * 価格未設定パネル用に、候補wine（分類済み・在庫>0）のうち
 * active かつ 未mergeのwine_idを取得する。
 * MANAGEモードのwineListが変わるたびに取り直す（読み取りのみ）。
 */
const pricingCandidateIdsKey =
  wineListDisplayMode === "MANAGE"
    ? wineList
        .filter(
          (row) =>
            row.wine_id &&
            row.hasClassification &&
            Number(row.current_quantity || 0) > 0
        )
        .map((row) => row.wine_id)
        .sort()
        .join(",")
    : "";

useEffect(() => {
  if (!pricingCandidateIdsKey) {
    setPricingActiveWineIds(new Set());
    return;
  }

  let cancelled = false;
  const ids = pricingCandidateIdsKey.split(",");
  const companyId = wineList[0]?.company_id;

  setPricingActiveWineIds(null);

  (async () => {
    const active = new Set<string>();

    for (let i = 0; i < ids.length; i += 100) {
      let query = supabase
        .from("wines")
        .select("id")
        .eq("is_active", true)
        .is("merged_into_wine_id", null)
        .in("id", ids.slice(i, i + 100));

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("価格未設定パネル: 有効wine取得失敗", error);
        if (!cancelled) {
          setPricingActiveWineIds(new Set());
        }
        return;
      }

      (data || []).forEach((w: any) => active.add(w.id));
    }

    if (!cancelled) {
      setPricingActiveWineIds(active);
    }
  })();

  return () => {
    cancelled = true;
  };
  // wineListの参照ではなく候補wine_idの集合が変わった時だけ取り直す
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pricingCandidateIdsKey]);

/*
 * wineListDisplayModeが変わるたびに、そのモードに対応する
 * wineListViewModeへ切り替える。
 *   MANAGE   → "ALL"（未掲載・未分類のwineも含めて全て表示する。
 *              管理者が初期インポート直後のwine等を確実に
 *              確認できるようにするため）
 *   CUSTOMER → "LISTED"（既存の顧客向け表示・PDF仕様を維持）
 *
 * wineListDisplayModeの初期値は"MANAGE"のため、Section 7を
 * 最初に開いた時点（ボタンをまだクリックしていない状態）でも
 * このeffectが一度実行され、wineListViewModeが"ALL"になる。
 * これにより初回表示から未掲載のwineがテーブルに表示される。
 *
 * setWineListViewModeの呼び出しをこのeffect1箇所へ集約し、
 * 各切替ボタン側では重複して呼ばない（不要な副作用を避けるため）。
 */
useEffect(() => {
  setWineListViewMode(
    wineListDisplayMode === "MANAGE"
      ? "ALL"
      : "LISTED"
  );
}, [wineListDisplayMode]);

const [wineListLayoutMode, setWineListLayoutMode] =
  useState<"REGION" | "PRODUCER" | "SIMPLE">("REGION");

const [wineListSortMode, setWineListSortMode] =
  useState<
    | "DEFAULT"
    | "PRODUCER_ASC"
    | "VINTAGE_DESC"
    | "VINTAGE_ASC"
    | "PRICE_ASC"
    | "PRICE_DESC"
  >("DEFAULT");

const [appLanguage, setAppLanguageState] =
  useState<AppLanguage>("FR");

/*
 * Section 14: ログイン中の顧客ユーザー自身のrole
 * （owner/staff/viewer、未取得時はnull）。
 * 運営者Admin(isAdmin/ADMIN_EMAILS)とは別概念。
 */
const [currentCustomerRole, setCurrentCustomerRole] =
  useState<string | null>(null);

/*
 * ログイン中ユーザーが所属するcompanyの表示名。
 * ページ上部タイトルカードに「BON PINARD SAS」を
 * ハードコードしていたのをやめ、profiles.company_idに対応する
 * companies.nameを表示するために追加。取得できるまではnull
 * （その間は空表示にする。ハードコードした社名へはフォールバック
 * しない）。
 */
const [currentCompanyName, setCurrentCompanyName] =
  useState<string | null>(null);

/*
 * ログイン中ユーザーが所属するcompanyのID。
 * Section 1のAI解析キャッシュ等、company固有のlocalStorageキーを
 * 会社ごとに分離するために使う（RLSはlocalStorageを保護できない
 * ため、client側でcompany_idをキーへ含めて分離する）。
 * 取得できるまではnull。company固有localStorageは
 * currentCompanyIdがnullの間は一切読み書きしない。
 */
const [currentCompanyId, setCurrentCompanyId] =
  useState<string | null>(null);

const [wineListLanguage, setWineListLanguage] =
  useState<AppLanguage>("FR");

const [
  wineListLanguageManuallySet,
  setWineListLanguageManuallySet,
] = useState(false);

/*
 * Section 9「在庫移動履歴」用の状態。
 * stockMovementsは読み込み済みの全件（ページ単位で追加していく）。
 * 検索・filter・二重取消判定はこの配列全体から算出する。
 */
const STOCK_HISTORY_PAGE_SIZE = 100;

const [stockMovements, setStockMovements] =
  useState<StockMovementRow[]>([]);

const [
  stockMovementsLoading,
  setStockMovementsLoading,
] = useState(false);

const [
  stockMovementsHasMore,
  setStockMovementsHasMore,
] = useState(true);

/*
 * stock_movementsにcreated_at列があるかどうか。
 * nullは「まだ判定していない」。判定後にtrue/falseへ確定する。
 */
const [
  stockMovementsHasCreatedAt,
  setStockMovementsHasCreatedAt,
] = useState<boolean | null>(null);

const [
  wineLookupForHistory,
  setWineLookupForHistory,
] = useState<
  Record<string, StockHistoryWineInfo>
>({});

const [stockHistorySearch, setStockHistorySearch] =
  useState("");

const [
  stockHistoryTypeFilter,
  setStockHistoryTypeFilter,
] = useState<
  "ALL" | "PURCHASE" | "SALE" | "ADJUSTMENT" | "REVERSAL"
>("ALL");

const [
  stockHistoryDateFilter,
  setStockHistoryDateFilter,
] = useState<"ALL" | "TODAY" | "7D" | "30D">(
  "ALL"
);

const [
  reversingMovementId,
  setReversingMovementId,
] = useState<string | null>(null);

/*
 * Section 16「データバックアップ / エクスポート」用の状態。
 * 読み取り専用機能のため、実行中フラグ以外の状態は持たない
 * （取得したデータはファイル生成後に破棄し、stateへは保持しない）。
 * exportRunningは実行中のボタン種別をそのまま入れ、他のボタンも
 * 同時実行できないようまとめてdisabledにする。
 */
const [exportRunning, setExportRunning] = useState<
  "inventory_excel" | "inventory_csv" | "full_backup" | null
>(null);

/*
 * Section 17「在庫アラート / 補充候補」用の状態。
 *
 * stockAlertRows: wines(active/unmerged)を母体に、inventory_view・
 * wine_stock_alert_settingsをクライアント側でmergeした一覧。
 * stockAlertDrafts: 行ごとの編集中ドラフト（保存ボタンで確定するまで
 * DBへは反映しない）。wine_idをキーにする。
 */
const [stockAlertRows, setStockAlertRows] = useState<
  StockAlertRow[]
>([]);

const [
  stockAlertDrafts,
  setStockAlertDrafts,
] = useState<Record<string, StockAlertDraft>>({});

const [stockAlertLoading, setStockAlertLoading] =
  useState(false);

const [stockAlertLoaded, setStockAlertLoaded] =
  useState(false);

const [stockAlertLoadError, setStockAlertLoadError] =
  useState<string>("");

const [stockAlertSavingWineId, setStockAlertSavingWineId] =
  useState<string | null>(null);

const [stockAlertSearch, setStockAlertSearch] =
  useState("");

const [stockAlertFilter, setStockAlertFilter] = useState<
  | "ALL"
  | "NEEDS_ACTION"
  | "OUT_OF_STOCK"
  | "LOW_STOCK"
  | "OK"
  | "NOT_SET"
  | "ALERT_ENABLED"
  | "REORDER"
>("ALL");

/*
 * Section 10「初期在庫インポート（運営者専用）」用の状態。
 *
 * isAdmin=null は「まだ /api/admin/status を確認していない」状態。
 * trueにならない限りSection 10自体を一切renderしない
 * （CSSでの非表示ではなく、コンポーネントを丸ごと出さない）。
 */
const [isAdmin, setIsAdmin] = useState<
  boolean | null
>(null);

const [adminCompanies, setAdminCompanies] =
  useState<Array<{ id: string; name: string }>>(
    []
  );

const [
  importTargetCompanyId,
  setImportTargetCompanyId,
] = useState("");

const [importFile, setImportFile] =
  useState<File | null>(null);

const [importAnalyzing, setImportAnalyzing] =
  useState(false);

const [importRows, setImportRows] = useState<
  InitialInventoryImportRow[]
>([]);

const [importSummary, setImportSummary] =
  useState<InitialImportSummary | null>(null);

const [importFileHash, setImportFileHash] =
  useState("");

const [importSheets, setImportSheets] = useState<
  Array<{ name: string; rowCount: number }>
>([]);

const [
  importExistingInventory,
  setImportExistingInventory,
] = useState<{
  companyName: string;
  existingBottleCount: number;
} | null>(null);

const [importSearch, setImportSearch] =
  useState("");

const [importStatusFilter, setImportStatusFilter] =
  useState<InitialImportRowStatus | "ALL">("ALL");

const [
  importAcknowledgeExisting,
  setImportAcknowledgeExisting,
] = useState(false);

const [importCommitting, setImportCommitting] =
  useState(false);

const [importError, setImportError] =
  useState("");

const [importResult, setImportResult] = useState<{
  batchId: string;
  wineCount: number;
  totalBottles: number;
  companyName: string;
  filename: string;
} | null>(null);

/*
 * Section 11「顧客会社管理（運営者専用）」用の状態。
 * Section 10と同じisAdmin判定を再利用し、Adminでなければ
 * 一切render/APIを呼び出さない。
 */
const [customers, setCustomers] = useState<
  CustomerSummaryRow[]
>([]);

const [customersLoading, setCustomersLoading] =
  useState(false);

const [customersError, setCustomersError] =
  useState("");

const [customerSearch, setCustomerSearch] =
  useState("");

const [
  customerContractFilter,
  setCustomerContractFilter,
] = useState<
  | "ALL"
  | "PROSPECT"
  | "TRIAL"
  | "ACTIVE"
  | "PAUSED"
  | "CANCELLED"
>("ALL");

const [
  customerOnboardingFilter,
  setCustomerOnboardingFilter,
] = useState<
  | "ALL"
  | "NEW"
  | "WAITING_EXCEL"
  | "EXCEL_RECEIVED"
  | "ANALYZING"
  | "READY_TO_IMPORT"
  | "IMPORTED"
  | "ACTIVE"
>("ALL");

const [
  selectedCustomerCompanyId,
  setSelectedCustomerCompanyId,
] = useState<string | null>(null);

const [customerEditDraft, setCustomerEditDraft] =
  useState<{
    companyName: string;
    onboardingStatus: string;
    contractStatus: string;
    planName: string;
    initialFeeEur: string;
    monthlyFeeEur: string;
    internalNotes: string;
  } | null>(null);

const [customerSaving, setCustomerSaving] =
  useState(false);

const [newCustomerName, setNewCustomerName] =
  useState("");

const [newCustomerPlanName, setNewCustomerPlanName] =
  useState("");

const [
  newCustomerInitialFee,
  setNewCustomerInitialFee,
] = useState("");

const [
  newCustomerMonthlyFee,
  setNewCustomerMonthlyFee,
] = useState("");

const [newCustomerNotes, setNewCustomerNotes] =
  useState("");

const [customerCreating, setCustomerCreating] =
  useState(false);

const [
  customerDuplicateWarning,
  setCustomerDuplicateWarning,
] = useState<Array<{
  id: string;
  name: string;
}> | null>(null);

/*
 * Section 12「顧客ユーザー管理・招待（運営者専用）」用の状態。
 * 会社一覧はSection 10と同じadminCompaniesを再利用する
 * （新しいstateへ複製しない）。選択中の会社だけ独立させる。
 */
const [
  companyUsersSelectedCompanyId,
  setCompanyUsersSelectedCompanyId,
] = useState("");

const [companyUsers, setCompanyUsers] = useState<
  CompanyUserRow[]
>([]);

const [
  companyUsersLoading,
  setCompanyUsersLoading,
] = useState(false);

const [companyUsersError, setCompanyUsersError] =
  useState("");

const [inviteEmail, setInviteEmail] = useState("");

const [inviteSending, setInviteSending] =
  useState(false);

const [inviteResultMessage, setInviteResultMessage] =
  useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

const [resendingUserId, setResendingUserId] =
  useState<string | null>(null);

const [
  sendingPasswordSetupUserId,
  setSendingPasswordSetupUserId,
] = useState<string | null>(null);

/*
 * Section 14: 招待時に選択するrole（既定はDBのDEFAULTと同じstaff）。
 */
const [newCustomerInviteRole, setNewCustomerInviteRole] =
  useState<"owner" | "staff" | "viewer">(
    "staff"
  );

const [updatingRoleUserId, setUpdatingRoleUserId] =
  useState<string | null>(null);

/*
 * appLanguageの変更をUIから呼び出す入口。
 * 同時にlocalStorageへ保存する（第1段階の永続化）。
 */
function setAppLanguage(lang: AppLanguage) {
  setAppLanguageState(lang);

  /*
   * お客様ワインリスト言語は、
   * 人が手動で個別選択するまでシステム言語に追従する。
   * （現時点ではSection 7のみが翻訳対象のため、
   *   ここで連動させないと最上部の言語ボタンが
   *   見た目上まったく変化しないように見えてしまう）
   */
  if (!wineListLanguageManuallySet) {
    setWineListLanguage(lang);
  }

  try {
    localStorage.setItem(
      APP_LANGUAGE_STORAGE_KEY,
      lang
    );
  } catch {
    // 保存できなくても画面上の言語切替自体は継続する
  }
}

/*
 * お客様ワインリスト言語をユーザーが手動で選んだ場合は、
 * 以後appLanguageが変わっても自動追従させない。
 */
function selectWineListLanguage(lang: AppLanguage) {
  setWineListLanguage(lang);
  setWineListLanguageManuallySet(true);
}

/*
 * 起動時に一度だけ、保存済み言語 → ブラウザ言語の順で
 * appLanguageを決定し、wineListLanguageの初期値にも反映する。
 */
useEffect(() => {
  const stored = loadStoredAppLanguage();
  const resolved = stored || detectBrowserAppLanguage();

  setAppLanguageState(resolved);

  if (!wineListLanguageManuallySet) {
    setWineListLanguage(resolved);
  }

  if (!stored) {
    try {
      localStorage.setItem(
        APP_LANGUAGE_STORAGE_KEY,
        resolved
      );
    } catch {
      // 保存できない環境ではブラウザ検出結果をそのまま使う
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const tApp = (
  key: AppI18nKey,
  params?: AppMessageParams
) => {
  let text: string =
    APP_I18N[appLanguage][key];

  if (!params) {
    return text;
  }

  for (
    const [name, value] of
    Object.entries(params)
  ) {
    text = text.replaceAll(
      `{${name}}`,
      String(value)
    );
  }

  return text;
};

const tUi = (
  key: ExtraUiI18nKey,
  params?: ExtraUiParams
) => extraUiText(appLanguage, key, params);

/*
 * お客様向けワインリストをA4印刷/PDF保存する。
 *
 * 現在画面に表示されているワインリストだけを別ウィンドウへ複製し、
 * A4縦・印刷専用CSSを適用してブラウザの印刷画面を開く。
 *
 * Chrome / Edgeでは印刷先に「PDFに保存」を選べば、
 * 文字を画像化せずにA4 PDFとして保存できる。
 */
function printWineListA4() {
  if (typeof window === "undefined") {
    return;
  }

  const printWindow = window.open(
    "",
    "_blank",
    "width=1000,height=1200"
  );

  if (!printWindow) {
    alert(tUi("wineListPrintWindowBlocked"));
    return;
  }

  const escapeHtml = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };

        return entities[char] || char;
      }
    );

  const rows = [...displayedWineList];

  const printTitle =
    wineListHeaderTitle.trim() ||
    currentCompanyName ||
    "";

  const printSubtitle =
    wineListHeaderSubtitle.trim();

  const otherLabel = tWine("other");
  const unknownProducerLabel =
    tWine("unknownProducer");

  const languageCode =
    wineListLanguage === "FR"
      ? "fr"
      : wineListLanguage === "JA"
        ? "ja"
        : "en";

  /*
   * 印刷用価格表記。
   * FRでは小数点をカンマにし、JA/ENでは従来どおりピリオド。
   * 整数価格は小数を付けない。
   */
  const formatPrintWinePrice = (
    value: number | null
  ) => {
    if (
      value === null ||
      !Number.isFinite(value)
    ) {
      return "—";
    }

    const rounded =
      Math.round(value * 100) / 100;

    if (Number.isInteger(rounded)) {
      return `${rounded.toFixed(0)} €`;
    }

    const fixed = rounded.toFixed(2);

    return `${
      wineListLanguage === "FR"
        ? fixed.replace(".", ",")
        : fixed
    } €`;
  };

  /*
   * A4印刷は画面表示をそのままコピーせず、
   * 印刷専用のコンパクトな2段組レイアウトを生成する。
   *
   * 750本前後の大きなリストでも、
   * 1ページあたりの情報量を増やしつつ
   * 生産者・ワイン・価格の対応を読みやすく保つ。
   */
  const countries = Array.from(
    new Set(
      rows.map(
        (row) =>
          String(row.country || "").trim() ||
          otherLabel
      )
    )
  );

  const contentHtml = countries
    .map((country) => {
      const countryRows = rows.filter(
        (row) =>
          (String(row.country || "").trim() ||
            otherLabel) === country
      );

      const regions = Array.from(
        new Set(
          countryRows.map(
            (row) =>
              String(row.region || "").trim() ||
              otherLabel
          )
        )
      );

      const regionsHtml = regions
        .map((region) => {
          const regionRows =
            countryRows.filter(
              (row) =>
                (String(row.region || "").trim() ||
                  otherLabel) === region
            );

          const categories =
            wineCategoryOrder.filter(
              (category) =>
                regionRows.some(
                  (row) =>
                    row.category === category
                )
            );

          const categoriesHtml = categories
            .map((category) => {
              const categoryRows =
                regionRows.filter(
                  (row) =>
                    row.category === category
                );

              const producers = Array.from(
                new Set(
                  categoryRows.map(
                    (row) =>
                      String(
                        row.producer || ""
                      ).trim() ||
                      unknownProducerLabel
                  )
                )
              );

              const producerHtml = producers
                .map((producer) => {
                  const producerRows =
                    categoryRows.filter(
                      (row) =>
                        (String(
                          row.producer || ""
                        ).trim() ||
                          unknownProducerLabel) ===
                        producer
                    );

                  const wineRowsHtml =
                    producerRows
                      .map((row) => {
                        const vintage =
                          String(
                            row.vintage || ""
                          ).trim() || "NV";

                        const mainName =
                          String(
                            row.appellation ||
                              row.cuvee ||
                              row.wine_name ||
                              "—"
                          ).trim();

                        const climat =
                          String(
                            row.climat || ""
                          ).trim();

                        const showCuvee =
                          shouldShowCustomerCuvee(
                            row
                          );

                        const cuvee =
                          showCuvee
                            ? String(
                                row.cuvee || ""
                              ).trim()
                            : "";

                        const size =
                          Number(
                            row.bottle_size_cl
                          ) > 0 &&
                          Number(
                            row.bottle_size_cl
                          ) !== 75
                            ? `${Number(
                                row.bottle_size_cl
                              )} cl`
                            : "";

                        const price =
                          formatPrintWinePrice(
                            row.sale_price
                          );

                        return `
<div class="wine-row">
  <div class="vintage">${escapeHtml(vintage)}</div>
  <div class="wine-description">
    <div class="wine-main">
      <span class="wine-name">${escapeHtml(mainName)}${
                          climat
                            ? `<span class="climat"> / ${escapeHtml(
                                climat
                              )}</span>`
                            : ""
                        }</span>
      <span class="leader"></span>
    </div>
    ${
      cuvee || size
        ? `<div class="wine-meta">${
            cuvee
              ? `<span class="cuvee">${escapeHtml(
                  cuvee
                )}</span>`
              : ""
          }${
            cuvee && size ? " · " : ""
          }${
            size
              ? `<span>${escapeHtml(
                  size
                )}</span>`
              : ""
          }</div>`
        : ""
    }
  </div>
  <div class="price">${escapeHtml(price)}</div>
</div>`;
                      })
                      .join("");

                  return `
<section class="producer-group">
  <h5>${escapeHtml(producer)}</h5>
  ${wineRowsHtml}
</section>`;
                })
                .join("");

              return `
<section class="category-group">
  <h4><span>${escapeHtml(
    wineCategoryLabel(category)
  )}</span></h4>
  ${producerHtml}
</section>`;
            })
            .join("");

          return `
<section class="region-group">
  <h3>${escapeHtml(region)}</h3>
  ${categoriesHtml}
</section>`;
        })
        .join("");

      return `
<section class="country-group">
  <h2>${escapeHtml(country)}</h2>
  ${regionsHtml}
</section>`;
    })
    .join("");

  printWindow.document.open();

  printWindow.document.write(`<!doctype html>
<html lang="${languageCode}">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <title>${escapeHtml(printTitle)} - A4</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 7mm 7mm 8mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1c1917;
    }

    body {
      font-family:
        Georgia,
        "Times New Roman",
        "Noto Serif",
        serif;
      font-size: 9pt;
      line-height: 1.14;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .print-sheet {
      width: 100%;
    }

    .print-header {
      margin: 0 0 2.0mm;
      padding: 0 0 1.3mm;
      border-bottom: 0.3pt solid #bdb7ae;
      text-align: center;
    }

    .print-header h1 {
      margin: 0;
      font-size: 16pt;
      line-height: 0.96;
      font-weight: 700;
      letter-spacing: 0.15em;
    }

    .print-header .subtitle {
      margin-top: 0.55mm;
      font-size: 8.4pt;
      line-height: 1;
      font-style: italic;
      color: #57534e;
    }

    .print-columns {
      column-count: 2;
      column-gap: 7mm;
      column-rule: 0.25pt solid #e7e2dc;
    }

    .country-group {
      break-inside: auto;
    }

    .country-group h2 {
      column-span: all;
      margin: 0 0 0.8mm;
      padding: 0.45mm 0 0.45mm;
      border-bottom: 0.5pt solid #aaa39b;
      font-size: 12.5pt;
      line-height: 1;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      break-after: avoid;
      page-break-after: avoid;
    }

    .region-group {
      break-inside: auto;
    }

    .region-group h3 {
      column-span: all;
      margin: 0.85mm 0 0.4mm;
      font-size: 12pt;
      line-height: 1;
      text-align: center;
      font-weight: 700;
      break-after: avoid;
      page-break-after: avoid;
    }

    .category-group h4 {
      column-span: all;
      margin: 0.4mm 0 0.65mm;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      font-size: 8pt;
      line-height: 1;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      color: #57534e;
      break-after: avoid;
      page-break-after: avoid;
    }

    /*
     * h4自体はcolumn-span: allのblockのまま維持し、
     * 内側のspanだけinline-blockにして文字幅ぶんの細い下線を引く。
     * padding-leftは末尾のletter-spacing分と釣り合わせ、
     * 下線と文字を中央に揃えるため。
     */
    .category-group h4 span {
      display: inline-block;
      padding: 0 0 0.35mm 0.22em;
      border-bottom: 1px solid currentColor;
    }

    .producer-group {
      margin: 0 0 1.35mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .producer-group h5 {
      margin: 0 0 0.35mm;
      font-size: 9.2pt;
      line-height: 1.02;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .wine-row {
      display: grid;
      grid-template-columns:
        9mm minmax(0, 1fr) auto;
      align-items: baseline;
      gap: 1.4mm;
      min-height: 3.8mm;
      margin: 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .vintage {
      font-size: 7.7pt;
      color: #78716c;
      text-align: right;
      white-space: nowrap;
    }

    .wine-description {
      min-width: 0;
    }

    .wine-main {
      display: flex;
      min-width: 0;
      align-items: baseline;
      gap: 1.5mm;
    }

    .wine-name {
      min-width: 0;
      font-size: 8.7pt;
      white-space: normal;
    }

    .climat {
      font-style: italic;
      color: #57534e;
    }

    .leader {
      min-width: 5mm;
      flex: 1;
      border-bottom: 0.35pt dotted #c9c4bd;
      transform: translateY(-0.8mm);
    }

    .price {
      font-size: 8.5pt;
      font-weight: 600;
      white-space: nowrap;
      text-align: right;
    }

    .wine-meta {
      margin-top: -0.15mm;
      font-size: 6.2pt;
      line-height: 1;
      font-style: italic;
      color: #8a827a;
    }

    @media print {
      .print-header,
      .country-group h2,
      .region-group h3,
      .category-group h4,
      .producer-group h5,
      .wine-row {
        orphans: 2;
        widows: 2;
      }
    }
  </style>
</head>
<body>
  <main class="print-sheet">
    <header class="print-header">
      <h1>${escapeHtml(printTitle)}</h1>
      ${
        printSubtitle
          ? `<div class="subtitle">${escapeHtml(
              printSubtitle
            )}</div>`
          : ""
      }
    </header>

    <div class="print-columns">
      ${contentHtml}
    </div>
  </main>
</body>
</html>`);

  printWindow.document.close();

  const runPrint = async () => {
    try {
      if (printWindow.document.fonts?.ready) {
        await printWindow.document.fonts.ready;
      }
    } catch {
      // フォント待機に失敗しても印刷自体は続行する
    }

    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (
    printWindow.document.readyState ===
    "complete"
  ) {
    void runPrint();
  } else {
    printWindow.addEventListener(
      "load",
      () => void runPrint(),
      { once: true }
    );
  }
}

/*
 * 動的なステータスメッセージは、
 * 翻訳済み文章ではなく
 * 「翻訳キー + パラメータ」で保存する。
 *
 * これにより、処理完了後でも
 * appLanguageを変更した瞬間に
 * 現在の言語で再描画できる。
 */
const setClassificationMessage = (
  key: AppI18nKey,
  params?: AppMessageParams
) => {
  setClassificationStatus({
    key,
    params,
  });
};

const [wineListSearch, setWineListSearch] =
  useState("");const [warnings, setWarnings] = useState<string[]>([]);  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

/*
 * Section 1のAI解析キャッシュ(localStorage)の復元。
 *
 * マルチテナント対応：currentCompanyId(profiles.company_id経由で
 * 確定)が取得できるまでは一切復元しない
 * （company_id不明のまま、どこかのcompanyのキャッシュを誤って
 * 表示することを避けるため）。currentCompanyNameも合わせて
 * 待つのは、下の「旧グローバルキーからの一度きりの移行」判定に
 * company名が必要なため（判定を誤ってタイミング次第で移行漏れ・
 * 誤爆させないように、両方揃うまで待つ）。
 *
 * 旧データ移行：この会社専用キーがまだ存在せず、かつ
 * ログイン中companyがBON PINARD SASの場合だけ、
 * multi-tenant化以前の共通キー(bon_pinard_ai_inventory_server、
 * および同様の3つのmasterキー)の内容を一度だけ新しい
 * company別キーへコピーする。他company(TESTなど)には
 * 絶対にこの旧データを持ち込まない。company name比較は
 * この一度きりの旧データ移行専用の限定処理であり、
 * company_idをハードコードするものではない
 * （company_idは今後も一切ハードコードしない）。
 * 旧グローバルキー自体は削除せず残す（誤って失わないための
 * 安全側の判断。移行は冪等＝一度移行済みなら再実行されない）。
 */
const aiInventoryRestoredRef = useRef(false);

useEffect(() => {
  if (
    aiInventoryRestoredRef.current ||
    !currentCompanyId ||
    currentCompanyName === null
  ) {
    return;
  }

  aiInventoryRestoredRef.current = true;

  const isLegacyBonPinardCompany =
    currentCompanyName === "BON PINARD SAS";

  const legacyKeyPairs: Array<[string, string]> = [
    [
      "bon_pinard_ai_inventory_server",
      companyScopedStorageKey(
        "bon_pinard_ai_inventory_server",
        currentCompanyId
      )!,
    ],
    [
      "bon_pinard_supplier_master",
      companyScopedStorageKey(
        "bon_pinard_supplier_master",
        currentCompanyId
      )!,
    ],
    [
      "bon_pinard_wine_master",
      companyScopedStorageKey(
        "bon_pinard_wine_master",
        currentCompanyId
      )!,
    ],
    [
      "bon_pinard_price_history",
      companyScopedStorageKey(
        "bon_pinard_price_history",
        currentCompanyId
      )!,
    ],
  ];

  if (isLegacyBonPinardCompany) {
    try {
      legacyKeyPairs.forEach(([legacyKey, scopedKey]) => {
        if (localStorage.getItem(scopedKey)) {
          // 既にこの会社専用キーへ移行済み。再移行しない。
          return;
        }

        const legacyValue = localStorage.getItem(legacyKey);

        if (legacyValue) {
          localStorage.setItem(scopedKey, legacyValue);
        }
      });
    } catch {}
  }

  const scopedInventoryKey = companyScopedStorageKey(
    "bon_pinard_ai_inventory_server",
    currentCompanyId
  );

  if (!scopedInventoryKey) {
    return;
  }

  try {
    const saved = localStorage.getItem(scopedInventoryKey);

    if (saved) {
      const data = JSON.parse(saved);
      setInventory(data.inventory || []);
      if (data.header) {
        setSupplier(data.header.supplier || "UNKNOWN SUPPLIER");
        setCustomer(data.header.customer || "");
        setInvoiceNo(data.header.invoiceNo || "");
        setInvoiceDate(data.header.invoiceDate || today());
      }
    }
  } catch {}
}, [currentCompanyId, currentCompanyName]);

/*
 * 自社(customer)の初期値フォールバック。
 * currentCompanyNameが取得できた時点で一度だけ、まだ何も
 * 設定されていない(customerが空文字のままの)場合に限り
 * ログイン中companyの名前を初期値として反映する。
 * localStorage復元・AI解析結果・ユーザーの手動入力が既にある
 * 場合はcustomerが空文字ではないため、このfallbackは発火しない。
 * 一度適用したら（customerFallbackAppliedRefで）再適用しない。
 */
const customerFallbackAppliedRef = useRef(false);

useEffect(() => {
  if (
    customerFallbackAppliedRef.current ||
    !currentCompanyName
  ) {
    return;
  }

  customerFallbackAppliedRef.current = true;
  setCustomer((prev) => prev || currentCompanyName);
}, [currentCompanyName]);

/*
 * ワインリストのメインタイトルの初期値フォールバック。
 * Supabaseにそのcompany用の保存済みタイトルが無い
 * (wineListHeaderHasSavedRow === false)と確認できた場合だけ、
 * currentCompanyNameを初期タイトルとして反映する。
 * 保存済みタイトルがある場合(true)は絶対に上書きしない。
 * 一度適用したら再適用しない。
 */
const wineListHeaderFallbackAppliedRef = useRef(false);

useEffect(() => {
  if (
    wineListHeaderFallbackAppliedRef.current ||
    wineListHeaderHasSavedRow !== false ||
    !currentCompanyName
  ) {
    return;
  }

  wineListHeaderFallbackAppliedRef.current = true;
  setWineListHeaderTitle(
    (prev) => prev || currentCompanyName
  );
}, [wineListHeaderHasSavedRow, currentCompanyName]);

async function loadCloudInventory() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("ログインユーザー取得失敗", userError);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    console.error("company_id取得失敗", profileError);
    return;
  }

  console.log("Supabase company_id:", profile.company_id);

  const companyId = profile.company_id;

  /*
   * 在庫確認済み状態は在庫一覧とは独立に取得する（awaitしない）。
   * 取得に失敗しても在庫一覧の表示は妨げない。
   */
  void loadStocktakeChecks(companyId);

  /*
   * 0在庫表示トグルがONの場合は、wines(active/unmerged)を母体に
   * inventory_viewをwine_idキーでLEFT JOIN相当にmergeする
   * （Section 17のloadStockAlertData()と同じ2クエリ・N+1無しの方式）。
   * OFFの場合は既存通りinventory_view側でcurrent_quantity<>0のみ
   * 取得する（挙動を完全に維持する）。
   */
  if (showZeroStockInventory) {
    const [winesResult, inventoryResult] = await Promise.all([
      supabase
        .from("wines")
        .select(
          "id, producer, wine_name, cuvee, color, vintage, bottle_size_cl, alcohol_percent"
        )
        .eq("company_id", companyId)
        .eq("is_active", true)
        .is("merged_into_wine_id", null),

      supabase
        .from("inventory_view")
        .select("*")
        .eq("company_id", companyId),
    ]);

    if (winesResult.error) {
      console.error(
        "wines取得失敗(0在庫表示)",
        winesResult.error
      );
      return;
    }

    if (inventoryResult.error) {
      console.error(
        "Supabase在庫取得失敗(0在庫表示)",
        inventoryResult.error
      );
      return;
    }

    const inventoryByWineId: Record<string, any> = {};
    (inventoryResult.data || []).forEach((r: any) => {
      inventoryByWineId[r.wine_id] = r;
    });

    const convertedInventory: Item[] = (
      winesResult.data || []
    ).map((w: any) => {
      const inv = inventoryByWineId[w.id];
      const quantity = Number(
        inv?.current_quantity || 0
      );
      const avgCostHt = Number(
        inv?.avg_cost_ht || 0
      );

      return {
        wineId: w.id,
        status: "CONFIRMED",
        date: inv?.last_movement_date || today(),
        invoiceNo: "",
        supplier: "",
        customer: currentCompanyName || "",

        producer: w.producer || "",
        cuvee: w.cuvee || "",
        raw: w.wine_name || "",
        color: w.color || "",
        vintage: w.vintage || "",
        size: Number(w.bottle_size_cl || 75),
        alcohol: w.alcohol_percent || "",

        qty: quantity,
        unit: avgCostHt,
        amount:
          Math.round(
            quantity * avgCostHt * 100
          ) / 100,

        confidence: 1,
        memo: "Supabase",
      };
    });

    setAllInventory(convertedInventory);
    return;
  }

  const { data: cloudInventory, error: inventoryError } = await supabase
  .from("inventory_view")
  .select("*")
  .eq("company_id", companyId)
  .neq("current_quantity", 0);

  if (inventoryError) {
    console.error("Supabase在庫取得失敗", inventoryError);
    return;
  }

  console.log("Supabase inventory_view:", cloudInventory);

  if (!cloudInventory || cloudInventory.length === 0) {
  console.log("Supabase在庫は0件です");
  setAllInventory([]);
  return;
}

  const convertedInventory: Item[] = cloudInventory.map((r: any) => ({
  wineId: r.wine_id || "",
  status: "CONFIRMED",
    date: r.last_movement_date || today(),
    invoiceNo: "",
    supplier: "",
    customer: currentCompanyName || "",

    producer: r.producer || "",
    cuvee: r.cuvee || "",
    raw: r.wine_name || "",
    color: r.color || "",
    vintage: r.vintage || "",
    size: Number(r.bottle_size_cl || 75),
    alcohol: r.alcohol_percent || "",

    qty: Number(r.current_quantity || 0),
    unit: Number(r.avg_cost_ht || 0),
    amount:
      Math.round(
        Number(r.current_quantity || 0) *
          Number(r.avg_cost_ht || 0) *
          100
      ) / 100,

    confidence: 1,
    memo: "Supabase",
  }));

  console.log("変換後クラウド在庫:", convertedInventory);

  setAllInventory(convertedInventory);
}


async function getCurrentCompanyIdForInventory() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      tApp("loginUserUnavailable")
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile?.company_id
  ) {
    throw new Error(
      tApp("companyInfoUnavailable")
    );
  }

  return profile.company_id as string;
}

/*
 * Section 4: inventory_stocktake_checksを取得し、
 * wine_id → checked_atのmapへ変換する。
 * migration未適用などで失敗した場合は空mapのまま（全wine未確認扱い）。
 */
async function loadStocktakeChecks(companyId: string) {
  const { data, error } = await supabase
    .from("inventory_stocktake_checks")
    .select("wine_id, checked_at")
    .eq("company_id", companyId);

  if (error) {
    console.error("在庫確認済み状態の取得失敗", error);
    setStocktakeCheckedAtByWineId({});
    return;
  }

  const next: Record<string, string> = {};
  (data || []).forEach((r: any) => {
    if (r.wine_id) {
      next[r.wine_id] = r.checked_at || "";
    }
  });

  setStocktakeCheckedAtByWineId(next);
}

/*
 * Section 4: 1 wineの在庫確認済み状態を設定/取消する。
 *
 * checked=true  → upsert（再確認時もDBトリガーがchecked_atをnow()で更新）
 * checked=false → delete
 * checked_at / checked_by / updated_atはDBトリガーで
 * now() / auth.uid() / now()が強制セットされる。
 *
 * 成功時はlocal stateだけ更新する（ページreload不要）。
 * 「確認済みを非表示」ON時はこのstate更新で自動的に一覧から消える。
 *
 * 将来「保存と同時に確認済み」ボタンを追加する場合は、
 * saveInventoryEdit()成功後にこの関数を呼べばよいよう、
 * 戻り値で成否を返す。
 */
async function setInventoryStocktakeChecked(
  wineId: string,
  checked: boolean
): Promise<boolean> {
  if (!wineId || isViewerRole) {
    return false;
  }

  setSavingStocktakeWineId(wineId);

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    if (checked) {
      /*
       * checked_atはDB時刻を正とする（トリガーでnow()が強制セット）。
       * クライアント時刻は送らず、DBが返した確定値だけをstateへ入れる。
       */
      const { data, error } = await supabase
        .from("inventory_stocktake_checks")
        .upsert(
          {
            company_id: companyId,
            wine_id: wineId,
          },
          { onConflict: "company_id,wine_id" }
        )
        .select("wine_id, checked_at")
        .single();

      if (error) {
        throw error;
      }

      const confirmedCheckedAt: string =
        data?.checked_at || "";

      setStocktakeCheckedAtByWineId((prev) => ({
        ...prev,
        [wineId]: confirmedCheckedAt,
      }));
    } else {
      const { error } = await supabase
        .from("inventory_stocktake_checks")
        .delete()
        .eq("company_id", companyId)
        .eq("wine_id", wineId);

      if (error) {
        throw error;
      }

      setStocktakeCheckedAtByWineId((prev) => {
        const next = { ...prev };
        delete next[wineId];
        return next;
      });
    }

    return true;
  } catch (error: any) {
    console.error("在庫確認済み状態の保存失敗", error);
    alert(
      tUi("inventoryStocktakeSaveFailed", {
        error: error?.message || String(error),
      })
    );
    return false;
  } finally {
    setSavingStocktakeWineId(null);
  }
}

/*
 * Section 4: 次回棚卸の開始用に、ログイン中companyの
 * 在庫確認済みマークをすべて解除する。
 *
 * inventory_stocktake_checksのDELETEのみ（company_idで限定）。
 * 在庫数量・stock_movements・winesには一切触れない。
 * DB側でもDELETE policy（同一company かつ owner/staff）で制限される。
 */
async function resetAllInventoryStocktakeChecks() {
  if (isViewerRole || resettingStocktakeChecks) {
    return;
  }

  if (!confirm(tUi("inventoryStocktakeResetAllConfirm"))) {
    return;
  }

  setResettingStocktakeChecks(true);

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    if (!companyId) {
      throw new Error(tApp("companyInfoUnavailable"));
    }

    const { error } = await supabase
      .from("inventory_stocktake_checks")
      .delete()
      .eq("company_id", companyId);

    if (error) {
      throw error;
    }

    setStocktakeCheckedAtByWineId({});
  } catch (error: any) {
    console.error("在庫確認済み状態の一括解除失敗", error);
    alert(
      tUi("inventoryStocktakeResetAllFailed", {
        error: error?.message || String(error),
      })
    );
  } finally {
    setResettingStocktakeChecks(false);
  }
}

/*
 * Section 14: ログイン中の顧客ユーザー自身のrole（owner/staff/viewer）を
 * 取得する。運営者Admin判定(isAdmin/ADMIN_EMAILS)とは完全に別の概念。
 * viewerは書き込み系ボタンを非表示/disabledにするためのUI制御専用で、
 * 実際の安全境界はDB側のRLS(company_id AND current_user_role())。
 */
async function loadCurrentCustomerRole() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentCustomerRole(null);
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile?.role) {
      setCurrentCustomerRole(null);
      return;
    }

    setCurrentCustomerRole(profile.role);
  } catch (error) {
    console.error(
      "自分のrole取得エラー:",
      error
    );
    setCurrentCustomerRole(null);
  }
}

/*
 * ページ上部タイトルカードへ表示する、ログイン中ユーザーの
 * company名を取得する。company_idの取得は既存の
 * getCurrentCompanyIdForInventory()をそのまま再利用し、
 * 新しい会社選択の仕組みは作らない。companiesの参照はSELECTのみ
 * （company_idの書き換えは一切行わない）。
 *
 * Section 1のlocalStorageをcompany別に分離するため、
 * currentCompanyIdもここで同時に確定させる
 * （company_idを取得する経路を増やさず、既存のこの1回の
 * 取得で両方のstateを更新する）。currentCompanyIdが確定するまで
 * company固有localStorageの復元・保存を行わないためのガードとして
 * 使う。
 */
async function loadCurrentCompanyName() {
  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    setCurrentCompanyId(companyId);

    const { data: company, error } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !company?.name) {
      setCurrentCompanyName(null);
      return;
    }

    setCurrentCompanyName(company.name);
  } catch (error) {
    console.error(
      "会社名取得エラー:",
      error
    );
    setCurrentCompanyName(null);
  }
}

/*
 * Section 9用: company内の全ワイン（在庫0を含む）を
 * wine_id → 表示用情報のマップとして取得する。
 *
 * inventory_viewはSection 4側の読み込みで
 * current_quantity != 0の行だけに絞っていることがあるため、
 * 履歴表示・逆仕訳の照合には別途winesテーブルを直接使う。
 */
async function loadWineLookupForHistory() {
  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    const { data, error } = await supabase
      .from("wines")
      .select(
        "id, producer, wine_name, cuvee, vintage, bottle_size_cl, color"
      )
      .eq("company_id", companyId);

    if (error || !data) {
      console.error(
        "wines一覧取得失敗(履歴用):",
        error
      );
      return;
    }

    const lookup: Record<
      string,
      StockHistoryWineInfo
    > = {};

    data.forEach((w: any) => {
      lookup[w.id] = {
        producer: w.producer || "",
        wineName: w.wine_name || "",
        cuvee: w.cuvee || "",
        vintage: w.vintage || "",
        size: Number(w.bottle_size_cl || 75),
        color: w.color || "",
      };
    });

    setWineLookupForHistory(lookup);
  } catch (error) {
    console.error(
      "wine lookup読み込みエラー(履歴用):",
      error
    );
  }
}

/*
 * stock_movementsにcreated_at列が存在するかを判定する。
 * DB schemaは変更しない前提のため、
 * 存在すればそれで並び替え・表示し、無ければmovement_dateを使う。
 * 一度判定した結果はstateにキャッシュして使い回す。
 */
async function detectStockMovementsHasCreatedAt(): Promise<boolean> {
  if (stockMovementsHasCreatedAt !== null) {
    return stockMovementsHasCreatedAt;
  }

  const { error } = await supabase
    .from("stock_movements")
    .select("created_at")
    .limit(1);

  const hasCreatedAt = !error;
  setStockMovementsHasCreatedAt(hasCreatedAt);
  return hasCreatedAt;
}

/*
 * Section 9の在庫移動履歴を読み込む。
 * reset=true: 最初から読み直す（初回表示・取消成功後など）。
 * reset=false: 「さらに読み込む」として続きを追加取得する。
 *
 * created_at（あれば）→ movement_date → id の順で
 * 安定した並び替えキーを作り、新しい順で100件ずつ取得する。
 */
async function loadStockHistoryPage(
  reset: boolean
) {
  if (stockMovementsLoading) return;

  setStockMovementsLoading(true);

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    const hasCreatedAt =
      await detectStockMovementsHasCreatedAt();

    const offset = reset
      ? 0
      : stockMovements.length;

    let query = supabase
      .from("stock_movements")
      .select("*")
      .eq("company_id", companyId);

    query = hasCreatedAt
      ? query.order("created_at", {
          ascending: false,
        })
      : query.order("movement_date", {
          ascending: false,
        });

    const { data, error } = await query
      .order("id", { ascending: false })
      .range(
        offset,
        offset + STOCK_HISTORY_PAGE_SIZE - 1
      );

    if (error) {
      console.error(
        "stock_movements取得失敗:",
        error
      );
      return;
    }

    const rows: StockMovementRow[] = (
      data || []
    ).map((r: any) => ({
      id: r.id,
      wine_id: r.wine_id,
      movement_type: r.movement_type,
      quantity: Number(r.quantity || 0),
      unit_cost_ht:
        r.unit_cost_ht === null ||
        r.unit_cost_ht === undefined
          ? null
          : Number(r.unit_cost_ht),
      movement_date: r.movement_date,
      created_at: r.created_at || null,
      notes: r.notes || null,
    }));

    setStockMovements((prev) =>
      reset ? rows : [...prev, ...rows]
    );

    setStockMovementsHasMore(
      rows.length === STOCK_HISTORY_PAGE_SIZE
    );
  } catch (error) {
    console.error(
      "在庫移動履歴読み込みエラー:",
      error
    );
  } finally {
    setStockMovementsLoading(false);
  }
}

function loadStockHistory() {
  loadWineLookupForHistory();
  loadStockHistoryPage(true);
}

/*
 * SALE / ADJUSTMENT movementを「逆仕訳」で取り消す。
 *
 * 絶対に元行はDELETE/UPDATEしない。REVERSAL行を新規INSERTし、
 * quantityは元movementの符号を反転したものにする。
 *
 * INSERT前に必ず最新の現在庫を取得し、取消後の在庫が
 * マイナスになる場合は中断する（在庫を直接UPDATEすることはない）。
 */
async function reverseStockMovement(
  movement: StockMovementRow
) {
  if (
    movement.movement_type !== "SALE" &&
    movement.movement_type !== "ADJUSTMENT"
  ) {
    return;
  }

  if (reversingMovementId) {
    return;
  }

  if (reversedMovementIds.has(movement.id)) {
    alert(tUi("stockHistoryAlreadyUndone"));
    return;
  }

  const info =
    wineLookupForHistory[movement.wine_id];

  const wineLabel = `${info?.producer || ""} ${
    info?.wineName || info?.cuvee || ""
  } ${info?.vintage || ""}`.trim();

  const typeLabelKey: ExtraUiI18nKey =
    movement.movement_type === "SALE"
      ? "stockMovementSale"
      : "stockMovementAdjustment";

  const originalQuantity = Number(
    movement.quantity || 0
  );

  const reversalQuantity =
    originalQuantity * -1;

  setReversingMovementId(movement.id);

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    /*
     * allInventory(画面state)はcurrent_quantity=0の在庫を
     * 含まないことがあるため、取消直前にinventory_viewへ
     * 直接問い合わせて最新の現在庫を取得する。
     */
    const {
      data: currentRow,
      error: currentError,
    } = await supabase
      .from("inventory_view")
      .select("current_quantity")
      .eq("company_id", companyId)
      .eq("wine_id", movement.wine_id)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    const currentQuantity = Number(
      currentRow?.current_quantity || 0
    );

    const resultQuantity =
      currentQuantity + reversalQuantity;

    if (resultQuantity < 0) {
      alert(
        tUi("stockHistoryUndoNegativeStock")
      );
      return;
    }

    const confirmMessage = tUi(
      "stockHistoryUndoConfirm",
      {
        wine: wineLabel,
        type: tUi(typeLabelKey),
        qty:
          originalQuantity > 0
            ? `+${originalQuantity}`
            : `${originalQuantity}`,
        from: currentQuantity,
        to: resultQuantity,
      }
    );

    const shouldProceed = confirm(
      confirmMessage
    );

    if (!shouldProceed) {
      return;
    }

    const noteSuffix = movement.notes
      ? ` | ${movement.notes}`
      : "";

    const { error: insertError } =
      await supabase
        .from("stock_movements")
        .insert({
          company_id: companyId,
          wine_id: movement.wine_id,
          invoice_id: null,
          movement_type: "REVERSAL",
          quantity: reversalQuantity,
          unit_cost_ht:
            movement.unit_cost_ht,
          movement_date: today(),
          notes: `REVERSAL_OF:${movement.id}${noteSuffix}`,
        });

    if (insertError) {
      throw insertError;
    }

    await loadCloudInventory();
    await loadWineList();
    await loadStockHistoryPage(true);

    alert(tUi("stockHistoryUndoSuccess"));
  } catch (error: any) {
    console.error(
      "在庫移動の取消エラー:",
      error
    );

    alert(
      tUi("stockHistoryUndoFailed", {
        error:
          error?.message ||
          tApp("unknownError"),
      })
    );
  } finally {
    setReversingMovementId(null);
  }
}

/*
 * Section 10「初期在庫インポート（運営者専用）」用の関数群。
 *
 * ここではSupabaseへ直接書き込まない。すべてのDB操作は
 * サーバー側のAdmin API（/api/admin/**）を経由し、
 * Service Role Keyはブラウザへ一切渡らない。
 * 現在ログイン中のSupabase sessionのaccess_tokenだけを
 * Authorization: Bearerとして送る。
 */
async function getAdminAuthToken(): Promise<
  string | null
> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || null;
}

async function checkAdminStatus() {
  try {
    const token = await getAdminAuthToken();

    if (!token) {
      setIsAdmin(false);
      return;
    }

    const res = await fetch(
      "/api/admin/status",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    setIsAdmin(Boolean(data?.isAdmin));
  } catch (error) {
    console.error(
      "Admin status check error:",
      error
    );
    setIsAdmin(false);
  }
}

async function loadAdminCompanies() {
  try {
    const token = await getAdminAuthToken();
    if (!token) return;

    const res = await fetch(
      "/api/admin/companies",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (res.ok) {
      setAdminCompanies(data.companies || []);
    } else {
      setImportError(
        tUi("initialImportLoadCompaniesFailed")
      );
    }
  } catch (error) {
    console.error(
      "Admin companies load error:",
      error
    );
    setImportError(
      tUi("initialImportLoadCompaniesFailed")
    );
  }
}

function handleInitialImportFileSelect(
  file: File | null
) {
  setImportFile(file);
  setImportRows([]);
  setImportSummary(null);
  setImportSheets([]);
  setImportExistingInventory(null);
  setImportFileHash("");
  setImportAcknowledgeExisting(false);
  setImportResult(null);
  setImportError("");
}

async function analyzeInitialImportFile() {
  if (!importTargetCompanyId) {
    alert(
      tUi("initialImportSelectCompanyFirst")
    );
    return;
  }

  if (!importFile) {
    alert(tUi("initialImportSelectFileFirst"));
    return;
  }

  setImportAnalyzing(true);
  setImportError("");

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append(
      "companyId",
      importTargetCompanyId
    );
    formData.append("lang", appLanguage);

    const res = await fetch(
      "/api/admin/inventory-import/analyze",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error ||
          tUi("initialImportAnalyzeFailed")
      );
    }

    setImportRows(data.rows || []);
    setImportSummary(data.summary || null);
    setImportFileHash(data.fileHash || "");
    setImportSheets(data.sheets || []);
    setImportExistingInventory(
      data.existingInventory || null
    );
    setImportAcknowledgeExisting(false);
    setImportResult(null);
  } catch (error: any) {
    console.error(
      "初期在庫インポート解析エラー:",
      error
    );

    setImportError(
      error?.message || tApp("unknownError")
    );

    alert(
      error?.message ||
        tUi("initialImportAnalyzeFailed")
    );
  } finally {
    setImportAnalyzing(false);
  }
}

/*
 * プレビュー行の基本フィールドを編集する。
 * quantityが0未満/非整数ならINVALID、0ならSKIPへ自動的に降格する。
 * READYへの昇格は明示的な markInitialImportRowReady() だけが行う
 * （曖昧なまま自動でREADYへ戻さないための安全策）。
 */
function updateInitialImportRowField(
  rowId: string,
  field:
    | "producer"
    | "wine_name"
    | "cuvee"
    | "vintage"
    | "color"
    | "alcohol_percent",
  value: string
) {
  setImportRows((prev) =>
    prev.map((r) =>
      r.row_id === rowId
        ? { ...r, [field]: value }
        : r
    )
  );
}

function updateInitialImportRowNumberField(
  rowId: string,
  field: "bottle_size_cl" | "unit_cost_ht",
  value: string
) {
  const parsed =
    value.trim() === "" ? null : Number(value);

  setImportRows((prev) =>
    prev.map((r) =>
      r.row_id === rowId
        ? {
            ...r,
            [field]:
              parsed !== null &&
              Number.isFinite(parsed)
                ? parsed
                : null,
          }
        : r
    )
  );
}

function updateInitialImportRowQuantity(
  rowId: string,
  value: string
) {
  setImportRows((prev) =>
    prev.map((r) => {
      if (r.row_id !== rowId) return r;

      if (value.trim() === "") {
        return {
          ...r,
          quantity: null,
          status: "INVALID",
        };
      }

      const parsed = Number(value);

      if (
        !Number.isFinite(parsed) ||
        parsed < 0 ||
        !Number.isInteger(parsed)
      ) {
        return {
          ...r,
          quantity: null,
          status: "INVALID",
        };
      }

      if (parsed === 0) {
        return {
          ...r,
          quantity: 0,
          status: "SKIP",
        };
      }

      return {
        ...r,
        quantity: parsed,
        status:
          r.status === "INVALID" ||
          r.status === "SKIP"
            ? "REVIEW"
            : r.status,
      };
    })
  );
}

function clearInitialImportRowMatch(
  rowId: string
) {
  setImportRows((prev) =>
    prev.map((r) =>
      r.row_id === rowId
        ? {
            ...r,
            matched_wine_id: null,
            matched_wine_label: null,
          }
        : r
    )
  );
}

function isInitialImportRowValid(
  row: InitialInventoryImportRow
): boolean {
  const hasWineName = Boolean(
    row.wine_name.trim() || row.cuvee.trim()
  );

  return Boolean(
    row.quantity !== null &&
      Number.isInteger(row.quantity) &&
      row.quantity > 0 &&
      hasWineName
  );
}

function markInitialImportRowReady(
  rowId: string
) {
  setImportRows((prev) =>
    prev.map((r) => {
      if (r.row_id !== rowId) return r;

      if (!isInitialImportRowValid(r)) {
        alert(
          tUi("initialImportRowInvalid")
        );
        return r;
      }

      return { ...r, status: "READY" };
    })
  );
}

function markInitialImportRowSkip(
  rowId: string
) {
  setImportRows((prev) =>
    prev.map((r) =>
      r.row_id === rowId
        ? { ...r, status: "SKIP" }
        : r
    )
  );
}

/*
 * サマリーカードのクリックで下部プレビューを絞り込む。
 * 下部のstatus filter selectと同じstate(importStatusFilter)を
 * 共有するため、新しいstateは作らない。
 * 既に選択中のstatusを再クリックしたらALLへ戻す。
 */
function toggleInitialImportStatusFilter(
  status: InitialImportRowStatus
) {
  setImportStatusFilter((prev) =>
    prev === status ? "ALL" : status
  );
}

async function commitInitialImportFile() {
  const readyRows = importRows.filter(
    (r) => r.status === "READY"
  );

  const blockingRows = importRows.filter(
    (r) =>
      r.status === "REVIEW" ||
      r.status === "DUPLICATE" ||
      r.status === "INVALID"
  );

  if (readyRows.length === 0) {
    alert(tUi("initialImportNoReadyRows"));
    return;
  }

  if (blockingRows.length > 0) {
    alert(
      tUi("initialImportUnresolvedRows", {
        count: blockingRows.length,
      })
    );
    return;
  }

  if (
    (importExistingInventory
      ?.existingBottleCount || 0) > 0 &&
    !importAcknowledgeExisting
  ) {
    alert(
      tUi(
        "initialImportMustAcknowledgeExisting"
      )
    );
    return;
  }

  const totalBottles = readyRows.reduce(
    (sum, r) => sum + (r.quantity || 0),
    0
  );

  const companyLabel =
    adminCompanies.find(
      (c) => c.id === importTargetCompanyId
    )?.name || importTargetCompanyId;

  const shouldProceed = confirm(
    tUi("initialImportConfirm", {
      company: companyLabel,
      filename: importFile?.name || "",
      wineCount: readyRows.length,
      totalBottles,
    })
  );

  if (!shouldProceed) return;

  setImportCommitting(true);
  setImportError("");

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      "/api/admin/inventory-import/commit",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: importTargetCompanyId,
          sourceFilename:
            importFile?.name || null,
          sourceFileHash:
            importFileHash || null,
          sourceRowCount:
            importSummary?.sourceRowCount || 0,
          recognizedWineCount:
            importSummary
              ?.recognizedWineCount || 0,
          rows: readyRows,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      /*
       * 二重import防止(RPC/unique制約)に引っかかった場合は、
       * サーバーの生エラー文をそのまま出さず、分かりやすい文言にする。
       */
      const rawMessage: string =
        data?.error || "";

      const isDuplicateFile =
        rawMessage
          .toLowerCase()
          .includes("already been imported");

      throw new Error(
        isDuplicateFile
          ? tUi("initialImportAlreadyImported")
          : rawMessage ||
              tUi("initialImportCommitFailed")
      );
    }

    setImportResult({
      batchId: data.batchId,
      wineCount: data.wineCount,
      totalBottles: data.totalBottles,
      companyName: companyLabel,
      filename: importFile?.name || "",
    });

    alert(tUi("initialImportSuccess"));
  } catch (error: any) {
    console.error(
      "初期在庫インポートcommitエラー:",
      error
    );

    setImportError(
      error?.message || tApp("unknownError")
    );

    alert(
      error?.message ||
        tUi("initialImportCommitFailed")
    );
  } finally {
    setImportCommitting(false);
  }
}

/*
 * プレビュー内容をCSVとして書き出す（運営者・顧客への確認用）。
 * この処理はSupabaseへ一切アクセスしない。
 */
function exportInitialImportReportCsv() {
  const headers = [
    "source_sheet",
    "source_rows",
    "producer",
    "wine_name",
    "cuvee",
    "vintage",
    "bottle_size_cl",
    "quantity",
    "unit_cost_ht",
    "status",
    "new_or_existing",
    "wine_id",
    "warnings",
  ];

  const escapeCsvCell = (value: unknown) => {
    const text = String(value ?? "");
    return /["\n,]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };

  const lines = [headers.join(",")];

  for (const r of importRows) {
    lines.push(
      [
        r.source_sheet,
        r.source_rows.join(";"),
        r.producer,
        r.wine_name,
        r.cuvee,
        r.vintage,
        r.bottle_size_cl ?? "",
        r.quantity ?? "",
        r.unit_cost_ht ?? "",
        r.status,
        r.matched_wine_id
          ? "existing"
          : "new",
        r.matched_wine_id || "",
        r.warnings.join("; "),
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const blob = new Blob(
    ["﻿" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `initial_import_report_${
    importFile?.name || "report"
  }.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/*
 * Section 11「顧客会社管理（運営者専用）」用の関数群。
 *
 * Section 10と同じくSupabaseへ直接書き込まず、
 * すべてサーバー側のAdmin API（/api/admin/customers）を経由する。
 * Service Role Keyはブラウザへ一切渡らず、
 * getAdminAuthToken()（Section 10で定義済み）で取得した
 * 現在ログイン中のaccess_tokenだけをBearerとして送る。
 */
async function loadCustomers() {
  setCustomersLoading(true);
  setCustomersError("");

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      "/api/admin/customers",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error ||
          tUi("customerLoadFailed")
      );
    }

    setCustomers(data.customers || []);
  } catch (error: any) {
    console.error(
      "顧客会社一覧取得エラー:",
      error
    );

    setCustomersError(
      error?.message || tUi("customerLoadFailed")
    );
  } finally {
    setCustomersLoading(false);
  }
}

function resetNewCustomerForm() {
  setNewCustomerName("");
  setNewCustomerPlanName("");
  setNewCustomerInitialFee("");
  setNewCustomerMonthlyFee("");
  setNewCustomerNotes("");
  setCustomerDuplicateWarning(null);
}

async function createCustomerCompany(
  confirmDuplicate: boolean = false
) {
  const trimmedName = newCustomerName.trim();

  if (!trimmedName) {
    alert(tUi("customerNameRequired"));
    return;
  }

  setCustomerCreating(true);

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      "/api/admin/customers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: trimmedName,
          planName:
            newCustomerPlanName.trim() || null,
          initialFeeEur:
            newCustomerInitialFee.trim() === ""
              ? null
              : Number(newCustomerInitialFee),
          monthlyFeeEur:
            newCustomerMonthlyFee.trim() === ""
              ? null
              : Number(newCustomerMonthlyFee),
          internalNotes:
            newCustomerNotes.trim() || null,
          confirmDuplicate,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      if (
        res.status === 409 &&
        data?.error === "duplicate_name"
      ) {
        setCustomerDuplicateWarning(
          data.existing || []
        );
        return;
      }

      throw new Error(
        data?.error ||
          tUi("customerCreateFailed")
      );
    }

    resetNewCustomerForm();
    alert(tUi("customerCreateSuccess"));
    await loadCustomers();

    /*
     * Section 10「インポート先会社」プルダウンは
     * Section 11とは別state(adminCompanies)で管理しているため、
     * ここで明示的に再取得しないとページ再読み込みまで
     * 新会社が反映されない。selectの選択中の値(importTargetCompanyId)
     * はここでは一切変更しないので、既存の選択状態は維持される。
     */
    await loadAdminCompanies();
  } catch (error: any) {
    console.error(
      "顧客会社作成エラー:",
      error
    );

    alert(
      error?.message ||
        tUi("customerCreateFailed")
    );
  } finally {
    setCustomerCreating(false);
  }
}

function openCustomerDetail(
  row: CustomerSummaryRow
) {
  setSelectedCustomerCompanyId(row.company_id);
  setCustomerEditDraft({
    companyName: row.company_name,
    onboardingStatus: row.onboarding_status,
    contractStatus: row.contract_status,
    planName: row.plan_name || "",
    initialFeeEur:
      row.initial_fee_eur === null
        ? ""
        : String(row.initial_fee_eur),
    monthlyFeeEur:
      row.monthly_fee_eur === null
        ? ""
        : String(row.monthly_fee_eur),
    internalNotes: row.internal_notes || "",
  });
}

function closeCustomerDetail() {
  setSelectedCustomerCompanyId(null);
  setCustomerEditDraft(null);
}

function updateCustomerDraftField(
  field:
    | "companyName"
    | "onboardingStatus"
    | "contractStatus"
    | "planName"
    | "initialFeeEur"
    | "monthlyFeeEur"
    | "internalNotes",
  value: string
) {
  setCustomerEditDraft((prev) =>
    prev ? { ...prev, [field]: value } : prev
  );
}

async function saveCustomerDetail() {
  if (
    !selectedCustomerCompanyId ||
    !customerEditDraft
  ) {
    return;
  }

  const trimmedName =
    customerEditDraft.companyName.trim();

  if (!trimmedName) {
    alert(tUi("customerNameRequired"));
    return;
  }

  setCustomerSaving(true);

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      `/api/admin/customers/${selectedCustomerCompanyId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: trimmedName,
          onboardingStatus:
            customerEditDraft.onboardingStatus,
          contractStatus:
            customerEditDraft.contractStatus,
          planName:
            customerEditDraft.planName.trim() ||
            null,
          initialFeeEur:
            customerEditDraft.initialFeeEur.trim() ===
            ""
              ? null
              : Number(
                  customerEditDraft.initialFeeEur
                ),
          monthlyFeeEur:
            customerEditDraft.monthlyFeeEur.trim() ===
            ""
              ? null
              : Number(
                  customerEditDraft.monthlyFeeEur
                ),
          internalNotes:
            customerEditDraft.internalNotes.trim() ||
            null,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error ||
          tUi("customerSaveFailed")
      );
    }

    alert(tUi("customerSaveSuccess"));
    closeCustomerDetail();
    await loadCustomers();

    /*
     * 会社名を変更した場合もSection 10のプルダウンへ反映する。
     * importTargetCompanyIdはID(company_id)で保持しており、
     * ここでも変更しないため、選択中の会社があれば
     * 選択状態は維持されたまま表示名だけが更新される。
     */
    await loadAdminCompanies();
  } catch (error: any) {
    console.error(
      "顧客会社更新エラー:",
      error
    );

    alert(
      error?.message ||
        tUi("customerSaveFailed")
    );
  } finally {
    setCustomerSaving(false);
  }
}

/*
 * Section 12「顧客ユーザー管理・招待（運営者専用）」用の関数群。
 *
 * 会社所属の正データは既存のpublic.profiles.company_idのみを使い、
 * 新しいmembershipテーブルは作らない。Supabase Authユーザー操作は
 * すべてサーバー側のAdmin API（/api/admin/company-users*）経由で行い、
 * Service Role Keyはブラウザへ一切渡らない。
 */
async function loadCompanyUsers(companyId: string) {
  if (!companyId) {
    setCompanyUsers([]);
    return;
  }

  setCompanyUsersLoading(true);
  setCompanyUsersError("");

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      `/api/admin/company-users?companyId=${encodeURIComponent(
        companyId
      )}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error ||
          tUi("customerUsersLoadFailed")
      );
    }

    setCompanyUsers(data.users || []);
  } catch (error: any) {
    console.error(
      "顧客ユーザー一覧取得エラー:",
      error
    );

    setCompanyUsersError(
      error?.message ||
        tUi("customerUsersLoadFailed")
    );
  } finally {
    setCompanyUsersLoading(false);
  }
}

function selectCompanyUsersCompany(
  companyId: string
) {
  setCompanyUsersSelectedCompanyId(companyId);
  setInviteResultMessage(null);
  loadCompanyUsers(companyId);
}

async function inviteCompanyUser() {
  const companyId = companyUsersSelectedCompanyId;
  const email = inviteEmail.trim().toLowerCase();

  if (!companyId) {
    alert(tUi("customerUsersSelectCompanyFirst"));
    return;
  }

  const emailFormatRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailFormatRegex.test(email)) {
    alert(tUi("customerUsersInvalidEmail"));
    return;
  }

  setInviteSending(true);
  setInviteResultMessage(null);

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      "/api/admin/company-users/invite",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          email,
          role: newCustomerInviteRole,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      if (data?.status === "other_company") {
        setInviteResultMessage({
          type: "error",
          text: tUi(
            "customerUsersOtherCompany"
          ),
        });
        return;
      }

      throw new Error(
        data?.error ||
          tUi("customerUsersInviteFailed")
      );
    }

    if (data?.status === "already_member") {
      setInviteResultMessage({
        type: "warning",
        text: tUi(
          "customerUsersAlreadyMember"
        ),
      });
      return;
    }

    if (
      data?.status === "invited_but_not_linked"
    ) {
      setInviteResultMessage({
        type: "warning",
        text: tUi(
          "customerUsersInvitedNotLinked"
        ),
      });
      await loadCompanyUsers(companyId);
      return;
    }

    setInviteEmail("");
    setNewCustomerInviteRole("staff");

    setInviteResultMessage({
      type: "success",
      text: tUi("customerUsersInviteSuccess"),
    });

    /*
     * 招待成功後はSection 12のユーザー一覧だけを再読込する。
     * Ctrl+R不要・会社selectはcompanyUsersSelectedCompanyIdの
     * ままなので維持される。
     */
    await loadCompanyUsers(companyId);
  } catch (error: any) {
    console.error(
      "顧客ユーザー招待エラー:",
      error
    );

    setInviteResultMessage({
      type: "error",
      text:
        error?.message ||
        tUi("customerUsersInviteFailed"),
    });
  } finally {
    setInviteSending(false);
  }
}

/*
 * 招待メールの再送。対象はemail_confirmed_atがnullの
 * ユーザーだけ（ボタン自体もその条件でのみ表示する）。
 * profile/company_idの変更、新規profile作成、Auth userの
 * 削除・再作成はいずれも行わない
 * （すべてサーバー側/api/admin/company-users/resend-inviteで
 * 再検証・保証される）。
 */
async function resendCompanyUserInvite(
  userId: string
) {
  const companyId = companyUsersSelectedCompanyId;

  if (!companyId) return;

  setResendingUserId(userId);
  setInviteResultMessage(null);

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      "/api/admin/company-users/resend-invite",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          userId,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      if (data?.status === "other_company") {
        setInviteResultMessage({
          type: "error",
          text: tUi(
            "customerUsersOtherCompany"
          ),
        });
        return;
      }

      if (
        data?.status === "already_confirmed"
      ) {
        setInviteResultMessage({
          type: "warning",
          text: tUi(
            "customerUsersAlreadyConfirmed"
          ),
        });
        return;
      }

      throw new Error(
        data?.error ||
          tUi("customerUsersResendFailed")
      );
    }

    setInviteResultMessage({
      type: "success",
      text: tUi("customerUsersResendSuccess"),
    });

    await loadCompanyUsers(companyId);
  } catch (error: any) {
    console.error(
      "招待再送エラー:",
      error
    );

    setInviteResultMessage({
      type: "error",
      text:
        error?.message ||
        tUi("customerUsersResendFailed"),
    });
  } finally {
    setResendingUserId(null);
  }
}

/*
 * メール確認済みだがpassword設定が未完了の可能性があるユーザーへ、
 * Supabase公式のパスワードリカバリーメール(type=recovery)を送る。
 * Adminがpasswordを指定・生成することはない。
 * profile/company_idの変更、新規profile作成、Auth userの
 * 削除・再作成はいずれも行わない
 * （すべてサーバー側/api/admin/company-users/send-password-setupで
 * 再検証・保証される）。
 */
async function sendPasswordSetupLink(
  userId: string
) {
  const companyId = companyUsersSelectedCompanyId;

  if (!companyId) return;

  setSendingPasswordSetupUserId(userId);
  setInviteResultMessage(null);

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      "/api/admin/company-users/send-password-setup",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          userId,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      if (data?.status === "other_company") {
        setInviteResultMessage({
          type: "error",
          text: tUi(
            "customerUsersOtherCompany"
          ),
        });
        return;
      }

      throw new Error(
        data?.error ||
          tUi(
            "customerUsersPasswordSetupFailed"
          )
      );
    }

    setInviteResultMessage({
      type: "success",
      text: tUi(
        "customerUsersPasswordSetupSuccess"
      ),
    });

    await loadCompanyUsers(companyId);
  } catch (error: any) {
    console.error(
      "パスワード設定リンク送信エラー:",
      error
    );

    setInviteResultMessage({
      type: "error",
      text:
        error?.message ||
        tUi(
          "customerUsersPasswordSetupFailed"
        ),
    });
  } finally {
    setSendingPasswordSetupUserId(null);
  }
}

/*
 * Section 14: 既存ユーザーのrole変更（運営者Admin専用）。
 * company_idは一切変更しない。最後のownerを降格しようとした場合は
 * サーバー側(/api/admin/company-users/[userId]/role)が拒否する。
 */
async function updateCompanyUserRole(
  userId: string,
  role: string
) {
  const companyId = companyUsersSelectedCompanyId;

  if (!companyId) return;

  setUpdatingRoleUserId(userId);
  setInviteResultMessage(null);

  try {
    const token = await getAdminAuthToken();

    if (!token) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const res = await fetch(
      `/api/admin/company-users/${userId}/role`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          role,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      if (data?.status === "last_owner") {
        setInviteResultMessage({
          type: "error",
          text: tUi(
            "customerUsersLastOwnerProtection"
          ),
        });
        return;
      }

      if (data?.status === "other_company") {
        setInviteResultMessage({
          type: "error",
          text: tUi(
            "customerUsersOtherCompany"
          ),
        });
        return;
      }

      throw new Error(
        data?.error ||
          tUi(
            "customerUsersRoleUpdateFailed"
          )
      );
    }

    setInviteResultMessage({
      type: "success",
      text: tUi(
        "customerUsersRoleUpdateSuccess"
      ),
    });

    await loadCompanyUsers(companyId);
  } catch (error: any) {
    console.error(
      "権限更新エラー:",
      error
    );

    setInviteResultMessage({
      type: "error",
      text:
        error?.message ||
        tUi(
          "customerUsersRoleUpdateFailed"
        ),
    });
  } finally {
    setUpdatingRoleUserId(null);
  }
}

function startInventoryEdit(row: Item) {
  if (!row.wineId) {
    alert(tUi("inventoryEditUnavailable"));
    return;
  }

  setEditingInventoryWineId(
    row.wineId
  );

  const initialDraft: InventoryEditDraft = {
    producer: row.producer || "",
    wineName:
      row.raw || row.cuvee || "",
    cuvee: row.cuvee || "",
    vintage: row.vintage || "",
    color: row.color || "",
    size: String(
      Number(row.size || 75)
    ),
    alcohol: row.alcohol || "",
    quantity: String(
      Number(row.qty || 0)
    ),
    reason: "",
    note: "",
  };

  setInventoryEditDraft(initialDraft);
  setInventoryEditOriginalDraft(
    initialDraft
  );
  setInventoryEditReasonError(false);
}

function cancelInventoryEdit() {
  setEditingInventoryWineId(null);
  setInventoryEditDraft(null);
  setInventoryEditOriginalDraft(null);
  setInventoryEditReasonError(false);
}

async function saveInventoryEdit(
  row: Item
) {
  if (
    !row.wineId ||
    !inventoryEditDraft
  ) {
    alert(tUi("inventoryEditUnavailable"));
    return;
  }

  const nextQuantity =
    Number(
      inventoryEditDraft.quantity
    );

  if (
    !Number.isFinite(nextQuantity) ||
    nextQuantity < 0 ||
    !Number.isInteger(nextQuantity)
  ) {
    alert(tUi("inventoryEditInvalidQty"));
    return;
  }

  const quantityWillChange =
    nextQuantity !==
    Number(row.qty || 0);

  const reasonCode =
    inventoryEditDraft.reason.trim();

  const noteText =
    inventoryEditDraft.note.trim();

  /*
   * 在庫数を変更する場合は調整理由を必須にする。
   * マスタ情報だけの修正（在庫数は変わらない）では必須にしない。
   * Enterキー保存もこの関数を通るため、
   * キーボード経由で回避されることはない。
   */
  if (quantityWillChange && !reasonCode) {
    setInventoryEditReasonError(true);
    alert(tUi("inventoryEditReasonRequired"));
    return;
  }

  /*
   * 調整理由が「その他」の場合は、理由・メモの入力も必須にする。
   */
  if (
    quantityWillChange &&
    reasonCode === "OTHER" &&
    !noteText
  ) {
    setInventoryEditReasonError(true);
    alert(tUi("inventoryEditOtherNoteRequired"));
    return;
  }

  setInventoryEditReasonError(false);

  /*
   * 在庫数が変わる場合だけ保存前に確認する。
   * マスタ情報だけの修正では確認ダイアログを出さない。
   */
  if (quantityWillChange) {
    const wineLabel =
      `${row.producer || ""} ${
        row.raw || row.cuvee || ""
      } ${row.vintage || ""}`.trim();

    const reasonLabelByCode: Partial<
      Record<string, ExtraUiI18nKey>
    > = {
      INVENTORY_COUNT:
        "inventoryReasonInventoryCount",
      SALE_CORRECTION:
        "inventoryReasonSaleCorrection",
      BREAKAGE: "inventoryReasonBreakage",
      LOSS: "inventoryReasonLoss",
      TASTING_SERVICE:
        "inventoryReasonTasting",
      PURCHASE_CORRECTION:
        "inventoryReasonPurchaseCorrection",
      OTHER: "inventoryReasonOther",
    };

    const reasonLabelKey =
      reasonLabelByCode[reasonCode];

    let confirmMessage = tUi(
      "inventoryEditConfirmQtyChange",
      {
        wine: wineLabel,
        from: Number(row.qty || 0),
        to: nextQuantity,
      }
    );

    if (reasonLabelKey) {
      confirmMessage +=
        "\n" +
        tUi(
          "inventoryEditConfirmReasonLine",
          {
            reason: tUi(reasonLabelKey),
          }
        );
    }

    if (noteText) {
      confirmMessage +=
        "\n" +
        tUi(
          "inventoryEditConfirmNoteLine",
          {
            note: noteText,
          }
        );
    }

    const shouldProceed = confirm(
      confirmMessage
    );

    if (!shouldProceed) {
      return;
    }
  }

  setSavingInventoryEdit(true);

  const originalWineData = {
    producer: row.producer || "",
    wine_name:
      row.raw || row.cuvee || "",
    cuvee: row.cuvee || null,
    color: row.color || null,
    vintage: row.vintage || null,
    bottle_size_cl:
      Number(row.size || 75),
    alcohol_percent:
      row.alcohol || null,
  };

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    const nextWineData = {
      producer:
        inventoryEditDraft.producer.trim() ||
        "UNKNOWN PRODUCER",
      wine_name:
        inventoryEditDraft.wineName.trim() ||
        inventoryEditDraft.cuvee.trim() ||
        "UNKNOWN WINE",
      cuvee:
        inventoryEditDraft.cuvee.trim() ||
        null,
      color:
        inventoryEditDraft.color.trim() ||
        null,
      vintage:
        inventoryEditDraft.vintage.trim() ||
        null,
      bottle_size_cl:
        Number(
          inventoryEditDraft.size || 75
        ),
      alcohol_percent:
        inventoryEditDraft.alcohol.trim() ||
        null,
    };

    const {
      error: wineUpdateError,
    } = await supabase
      .from("wines")
      .update(nextWineData)
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "id",
        row.wineId
      );

    if (wineUpdateError) {
      throw wineUpdateError;
    }

    const difference =
      nextQuantity -
      Number(row.qty || 0);

    if (difference !== 0) {
      /*
       * reasonCode / noteTextは関数冒頭のvalidationで
       * 既に計算済みのものをそのまま使う
       * （数量変更時は調整理由が必須になっているため、
       * このブロックに来る時点でreasonCodeは
       * 空でないのが通常だが、安全のため
       * フォールバックは残す）。
       *
       * 例: "BREAKAGE: bottle broken"
       * 理由だけ・メモだけの場合にも対応する。
       */
      const movementNotes =
        reasonCode
          ? noteText
            ? `${reasonCode}: ${noteText}`
            : reasonCode
          : noteText ||
            "Manual inventory adjustment";

      const {
        error: movementError,
      } = await supabase
        .from("stock_movements")
        .insert({
          company_id: companyId,
          wine_id: row.wineId,
          invoice_id: null,
          movement_type:
            "ADJUSTMENT",
          quantity: difference,
          unit_cost_ht:
            Number(row.unit || 0),
          movement_date: today(),
          notes: movementNotes,
        });

      if (movementError) {
        /*
         * 数量調整に失敗した場合は、
         * 先に更新したwine masterを可能な限り元へ戻す。
         */
        await supabase
          .from("wines")
          .update(originalWineData)
          .eq(
            "company_id",
            companyId
          )
          .eq(
            "id",
            row.wineId
          );

        throw movementError;
      }
    }

    await loadCloudInventory();
    await loadWineList();

    setEditingInventoryWineId(null);
    setInventoryEditDraft(null);
    setInventoryEditOriginalDraft(null);

    alert(tUi("inventoryEditSaved"));
  } catch (error: any) {
    console.error(
      "在庫編集エラー:",
      error
    );

    alert(
      tUi(
        "inventoryEditSaveFailed",
        {
          error:
            error?.message ||
            tApp("unknownError"),
        }
      )
    );
  } finally {
    setSavingInventoryEdit(false);
  }
}

function handleSoldBottleFiles(
  nextFiles: File[]
) {
  soldBottlePreviews.forEach(
    (preview) => {
      try {
        URL.revokeObjectURL(
          preview.url
        );
      } catch {}
    }
  );

  setSoldBottleFiles(nextFiles);

  setSoldBottlePreviews(
    nextFiles.map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(
        file
      ),
    }))
  );

  setSoldBottleDetections([]);
  setSoldBottleStatus("");
}

function findSoldBottleCandidates(
  detected: SoldBottleAiItem
) {
  return allInventory
    .filter((row) => row.wineId)
    .map((row) => ({
      wineId: row.wineId as string,
      score:
        scoreSoldBottleInventoryMatch(
          detected,
          row
        ),
      producerScore:
        soldBottleProducerScore(
          detected,
          row
        ),
      stock:
        Number(row.qty || 0),
      label:
        `${row.producer || ""} / ${
          row.raw ||
          row.cuvee ||
          ""
        } / ${
          row.vintage || "NV"
        } / ${
          row.size || 75
        } cl`,
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, 8);
}

/*
 * AI候補（上位8件）に正しいワインが入らない場合の救済策。
 *
 * allInventory全体を対象に、生産者・原文・キュヴェ・
 * ヴィンテージ・容量・色を正規化して複数単語のAND検索を行う。
 *
 * ここはユーザーの手動検索専用なので、
 * score / producerScoreは持たせず0のままにしておく
 * （自動選択のゲートには一切関与しない）。
 */
function searchAllInventoryForSoldBottle(
  query: string
): SoldBottleCandidate[] {
  const tokens =
    normalizeSoldBottleText(query)
      .split(" ")
      .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  return allInventory
    .filter((row) => row.wineId)
    .map((row) => ({
      row,
      searchableText:
        normalizeSoldBottleText(
          [
            row.producer,
            row.raw,
            row.cuvee,
            row.vintage,
            row.size,
            "cl",
            row.color,
          ].join(" ")
        ),
    }))
    .filter(({ searchableText }) =>
      tokens.every((token) =>
        searchableText.includes(
          token
        )
      )
    )
    .sort((a, b) =>
      String(a.row.producer || "").localeCompare(
        String(b.row.producer || "")
      )
    )
    .slice(0, 20)
    .map(
      ({ row }): SoldBottleCandidate => ({
        wineId: row.wineId as string,
        score: 0,
        producerScore: 0,
        stock: Number(row.qty || 0),
        label:
          `${row.producer || ""} / ${
            row.raw ||
            row.cuvee ||
            ""
          } / ${
            row.vintage || "NV"
          } / ${
            row.size || 75
          } cl`,
      })
    );
}

/*
 * AIが自動選択できなかった行のために、
 * 「現在庫を検索」欄へ最初からセットする検索語を作る。
 *
 * 原則は wine_name + vintage のみ。
 * Producerは誤読が多いため、ここでは意図的に一切含めない
 * （正解ワインが検索から消えてしまうのを避けるため）。
 *
 * wine_nameとcuveeの両方がある場合は、
 * 「wine_name + vintage」と「wine_name + cuvee + vintage」の
 * 両方で実際に検索してみて、0件にならない範囲でより
 * 絞り込める（結果件数が少ない）方を採用する。
 */
function buildSoldBottleSearchQuery(
  detected: SoldBottleAiItem
): string {
  const wineName = String(
    detected.wine_name || ""
  ).trim();

  const cuvee = String(
    detected.cuvee || ""
  ).trim();

  const vintage = String(
    detected.vintage || ""
  ).trim();

  const size = Number(
    detected.bottle_size_cl || 0
  );

  const sizePart =
    size > 0 && size !== 75
      ? ` ${size}`
      : "";

  const baseText = wineName || cuvee;

  if (!baseText) {
    return "";
  }

  const baseQuery =
    `${baseText}${
      vintage ? ` ${vintage}` : ""
    }${sizePart}`.trim();

  const cuveeAlreadyInWineName =
    !cuvee ||
    !wineName ||
    normalizeSoldBottleText(
      wineName
    ).includes(
      normalizeSoldBottleText(cuvee)
    );

  if (
    !wineName ||
    !cuvee ||
    cuveeAlreadyInWineName
  ) {
    return baseQuery;
  }

  const combinedQuery =
    `${wineName} ${cuvee}${
      vintage ? ` ${vintage}` : ""
    }${sizePart}`.trim();

  const baseResults =
    searchAllInventoryForSoldBottle(
      baseQuery
    );

  const combinedResults =
    searchAllInventoryForSoldBottle(
      combinedQuery
    );

  /*
   * 「絞り込める方」＝0件にならない範囲で、
   * より件数が少ない方を優先する。
   */
  if (
    combinedResults.length > 0 &&
    (baseResults.length === 0 ||
      combinedResults.length <
        baseResults.length)
  ) {
    return combinedQuery;
  }

  if (baseResults.length > 0) {
    return baseQuery;
  }

  // どちらも0件ならcuveeだけの検索語を試す
  return `${cuvee}${
    vintage ? ` ${vintage}` : ""
  }${sizePart}`.trim();
}

async function analyzeSoldBottlePhotos() {
  if (soldBottleFiles.length === 0) {
    alert(tUi("soldBottleNoFiles"));
    return;
  }

  if (allInventory.length === 0) {
    alert(
      tUi("soldBottleNoInventory")
    );
    return;
  }

  setAnalyzingSoldBottles(true);
  setSoldBottleStatus(
    tUi("soldBottleAnalyzing")
  );

  try {
    const formData =
      new FormData();

    soldBottleFiles.forEach(
      (file) =>
        formData.append(
          "files",
          file
        )
    );

    // マルチテナント対応：プロンプト内の説明文をログイン中の
    // companyへ差し替えるため、company名を渡す。
    formData.append(
      "companyName",
      currentCompanyName || ""
    );

    const response =
      await fetch(
        "/api/analyze-sold-bottles",
        {
          method: "POST",
          body: formData,
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "AI analysis failed"
      );
    }

    const items:
      SoldBottleAiItem[] =
      Array.isArray(data?.items)
        ? data.items
        : [];

    const nextDetections =
      items.map(
        (
          detected,
          index
        ): SoldBottleDetection => {
          const candidates =
            findSoldBottleCandidates(
              detected
            );

          const best =
            candidates[0];

          /*
           * 自動選択はscoreだけでなく、
           * producerScoreも一定以上でなければ許可しない。
           *
           * 古酒などでAIがproducerを誤読しても、
           * wine/vintageだけで高得点になった候補を
           * 人の確認なしに確定させないための安全ゲート。
           * （この基準自体は今回変更しない）
           */
          const autoSelectedWineId =
            best &&
            best.score >= 0.38 &&
            best.producerScore >= 0.3
              ? best.wineId
              : "";

          /*
           * 自動選択できなかった行だけ、
           * 「現在庫を検索」欄へ検索語を最初からセットする。
           * 自動選択できた行はあえて空欄のままにする。
           */
          const searchQuery =
            autoSelectedWineId
              ? ""
              : buildSoldBottleSearchQuery(
                  detected
                );

          return {
            ...detected,
            id: `${Date.now()}-${index}`,
            quantity:
              Math.max(
                1,
                Math.round(
                  Number(
                    detected.quantity ||
                    1
                  )
                )
              ),
            candidates,
            searchQuery,
            selectedWineId:
              autoSelectedWineId,
          };
        }
      );

    setSoldBottleDetections(
      nextDetections
    );

    setSoldBottleStatus(
      tUi("soldBottleDetected", {
        total:
          nextDetections.length,
      })
    );
  } catch (error: any) {
    console.error(
      "売れたボトル写真AI判定エラー:",
      error
    );

    setSoldBottleStatus(
      tUi(
        "soldBottleAiFailed",
        {
          error:
            error?.message ||
            tApp("unknownError"),
        }
      )
    );
  } finally {
    setAnalyzingSoldBottles(false);
  }
}

function updateSoldBottleDetection(
  id: string,
  patch: Partial<
    SoldBottleDetection
  >
) {
  setSoldBottleDetections(
    (prev) =>
      prev.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
              }
            : item
      )
  );
}

function clearSoldBottleResults() {
  soldBottlePreviews.forEach(
    (preview) => {
      try {
        URL.revokeObjectURL(
          preview.url
        );
      } catch {}
    }
  );

  setSoldBottleFiles([]);
  setSoldBottlePreviews([]);
  setSoldBottleDetections([]);
  setSoldBottleStatus("");
}

async function applySoldBottleSales() {
  if (
    soldBottleDetections.length === 0
  ) {
    return;
  }

  const usable =
    soldBottleDetections.filter(
      (item) =>
        item.selectedWineId
    );

  if (
    usable.length !==
    soldBottleDetections.length
  ) {
    alert(
      tUi("soldBottleNeedMatch")
    );
    return;
  }

  for (const item of usable) {
    if (
      !Number.isInteger(
        Number(item.quantity)
      ) ||
      Number(item.quantity) <= 0
    ) {
      alert(
        tUi("soldBottleInvalidQty")
      );
      return;
    }
  }

  /*
   * 同じワインが複数写真・複数行に出た場合は
   * wine_id単位に販売本数を合算する。
   */
  const quantityByWineId =
    new Map<string, number>();

  usable.forEach((item) => {
    quantityByWineId.set(
      item.selectedWineId,
      (
        quantityByWineId.get(
          item.selectedWineId
        ) || 0
      ) +
        Number(item.quantity)
    );
  });

  for (
    const [
      wineId,
      quantity,
    ] of Array.from(
      quantityByWineId.entries()
    )
  ) {
    const row =
      allInventory.find(
        (inventoryRow) =>
          inventoryRow.wineId ===
          wineId
      );

    if (!row) {
      alert(
        tUi(
          "inventoryEditUnavailable"
        )
      );
      return;
    }

    if (
      quantity >
      Number(row.qty || 0)
    ) {
      alert(
        tUi(
          "soldBottleOverStock",
          {
            wine:
              `${row.producer} ${
                row.cuvee ||
                row.raw
              }`.trim(),
            stock:
              Number(
                row.qty || 0
              ),
            qty: quantity,
          }
        )
      );
      return;
    }
  }

  const totalQuantity =
    Array.from(
      quantityByWineId.values()
    ).reduce(
      (sum, quantity) =>
        sum + quantity,
      0
    );

  const shouldApply =
    confirm(
      tUi(
        "soldBottleConfirm",
        {
          qty: totalQuantity,
          lines:
            quantityByWineId.size,
        }
      )
    );

  if (!shouldApply) {
    return;
  }

  setApplyingSoldBottles(true);

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    const movements =
      Array.from(
        quantityByWineId.entries()
      ).map(
        ([wineId, quantity]) => {
          const row =
            allInventory.find(
              (inventoryRow) =>
                inventoryRow.wineId ===
                wineId
            );

          return {
            company_id:
              companyId,
            wine_id: wineId,
            invoice_id: null,
            movement_type:
              "SALE",
            quantity:
              -Math.abs(quantity),
            unit_cost_ht:
              Number(
                row?.unit || 0
              ),
            movement_date: today(),
            notes:
              `${tUi(
                "soldBottleSaleNote"
              )}: ${
                row?.producer || ""
              } ${
                row?.cuvee ||
                row?.raw ||
                ""
              }`.trim(),
          };
        }
      );

    const {
      error: movementError,
    } = await supabase
      .from("stock_movements")
      .insert(movements);

    if (movementError) {
      throw movementError;
    }

    await loadCloudInventory();
    await loadWineList();

    setSoldBottleStatus(
      tUi(
        "soldBottleApplied",
        {
          qty: totalQuantity,
        }
      )
    );

    setSoldBottleDetections([]);
    setSoldBottleFiles([]);

    soldBottlePreviews.forEach(
      (preview) => {
        try {
          URL.revokeObjectURL(
            preview.url
          );
        } catch {}
      }
    );

    setSoldBottlePreviews([]);
  } catch (error: any) {
    console.error(
      "販売在庫減算エラー:",
      error
    );

    alert(
      tUi(
        "inventoryEditSaveFailed",
        {
          error:
            error?.message ||
            tApp("unknownError"),
        }
      )
    );
  } finally {
    setApplyingSoldBottles(false);
  }
}

async function loadWineListHeaderSettings() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(tApp("loginUserUnavailable"));
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error(tApp("companyInfoUnavailable"));
    }

    const { data, error } = await supabase
      .from("wine_list_display_settings")
      .select("title,subtitle")
      .eq("company_id", profile.company_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    /*
     * まだSupabaseに設定行が無い会社では、保存済みタイトルは
     * 無い扱いにする（wineListHeaderHasSavedRow=false）。
     * この場合だけ、別のuseEffectがcurrentCompanyNameを
     * 初期タイトルとして反映する。Subtitleの初期値
     * "Carte des vins"は今回変更しない。
     */
    if (data) {
      setWineListHeaderTitle(String(data.title ?? ""));
      setWineListHeaderSubtitle(String(data.subtitle ?? ""));
      setWineListHeaderHasSavedRow(true);
    } else {
      setWineListHeaderHasSavedRow(false);
    }
  } catch (error: any) {
    console.error("wine list header load error:", error);
    setWineListHeaderStatus(
      tUi("wineListHeaderLoadFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  }
}

async function saveWineListHeaderSettings() {
  if (wineListHeaderSaving) {
    return;
  }

  setWineListHeaderSaving(true);
  setWineListHeaderStatus("");

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(tApp("loginUserUnavailable"));
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error(tApp("companyInfoUnavailable"));
    }

    const { error } = await supabase
      .from("wine_list_display_settings")
      .upsert(
        {
          company_id: profile.company_id,
          title: wineListHeaderTitle,
          subtitle: wineListHeaderSubtitle,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    if (error) {
      throw new Error(error.message);
    }

    setWineListHeaderStatus(tUi("wineListHeaderSaved"));
  } catch (error: any) {
    console.error("wine list header save error:", error);
    setWineListHeaderStatus(
      tUi("wineListHeaderSaveFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setWineListHeaderSaving(false);
  }
}

/*
 * Section 7 CUSTOMERモード（既存）：wine_list_viewをそのまま使う。
 * wine_classification_memory / wine_list_settings の両方が
 * INNER JOINされているため、返ってくる行は常に両方揃っている
 * （＝hasClassification/hasListSettingsは常にtrue）。
 * VIEW定義・取得条件・PDF出力への影響を避けるため、この関数の
 * クエリ・マッピングロジックは一切変更しない。
 */
async function fetchCustomerWineListRows(
  companyId: string
): Promise<WineListRow[]> {
  const { data, error } = await supabase
    .from("wine_list_view")
    .select("*")
    .eq("company_id", companyId);

  if (error) {
    throw new Error(
      tUi("wineListFetchFailed", { error: error.message })
    );
  }

  return (data || []).map((row: any) => ({
    company_id: row.company_id || "",
    wine_id: row.wine_id || "",
    producer: row.producer || "",
    wine_name: row.wine_name || "",
    cuvee: row.cuvee || "",
    vintage: row.vintage || "",
    bottle_size_cl: Number(row.bottle_size_cl || 75),
    current_quantity: Number(row.current_quantity || 0),
    avg_cost_ht: Number(row.avg_cost_ht || 0),
    country: row.country || "",
    region: row.region || "",
    subregion: row.subregion || "",
    appellation: row.appellation || "",
    climat: row.climat || "",
    cru_level: row.cru_level || "UNKNOWN",
    category: row.category || "UNKNOWN",
    sale_price:
      row.sale_price === null
        ? null
        : Number(row.sale_price),
    manual_price: Boolean(row.manual_price),
    is_listed: Boolean(row.is_listed),
    list_notes: row.list_notes || null,
    // wine_list_viewはINNER JOINのため、返る行は常に
    // classification/settingsの両方が揃っている。
    hasClassification: true,
    hasListSettings: true,
  }));
}

/*
 * Section 7 MANAGEモード（新設）：inventory_viewを母体にし、
 * wine_classification_memory / wine_list_settings をcompany_id単位で
 * 個別取得して、クライアント側でwine_idをキーにLEFT JOIN相当に
 * mergeする。classification/settingsが存在しないwineも、
 * 在庫があれば必ずこの一覧に含まれる（INITIAL_IMPORT直後の
 * ワイン等が、管理画面から見えなくなる問題への対応）。
 *
 * - N+1を避けるため、wineごとの個別SELECTは行わず、3回の
 *   company_idスコープのクエリだけで完結させる。
 * - 3クエリとも同じcompanyIdでフィルタ済みのため、Mapのキーは
 *   wine_idのみで安全（他companyのデータが混ざることはない）。
 * - classification/settingsが無い場合でも、DBへplaceholder行を
 *   INSERTすることは絶対にしない。UI表示用の安全なデフォルト値
 *   （country等は空文字、is_listed=false、sale_price=null）を
 *   その場で補うだけ。
 */
async function fetchManageWineListRows(
  companyId: string
): Promise<WineListRow[]> {
  const [
    inventoryResult,
    classificationResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("inventory_view")
      .select(
        "company_id, wine_id, producer, wine_name, cuvee, vintage, bottle_size_cl, current_quantity, avg_cost_ht"
      )
      .eq("company_id", companyId)
      .neq("current_quantity", 0),

    supabase
      .from("wine_classification_memory")
      .select(
        "company_id, wine_id, country, region, subregion, appellation, climat, cru_level, category"
      )
      .eq("company_id", companyId),

    supabase
      .from("wine_list_settings")
      .select(
        "company_id, wine_id, sale_price, manual_price, is_listed, notes"
      )
      .eq("company_id", companyId),
  ]);

  if (inventoryResult.error) {
    throw new Error(
      tUi("wineListFetchFailed", {
        error: inventoryResult.error.message,
      })
    );
  }

  if (classificationResult.error) {
    throw new Error(
      tUi("wineListFetchFailed", {
        error: classificationResult.error.message,
      })
    );
  }

  if (settingsResult.error) {
    throw new Error(
      tUi("wineListFetchFailed", {
        error: settingsResult.error.message,
      })
    );
  }

  const classificationByWineId = new Map(
    (classificationResult.data || []).map(
      (c: any) => [c.wine_id, c]
    )
  );

  const settingsByWineId = new Map(
    (settingsResult.data || []).map(
      (s: any) => [s.wine_id, s]
    )
  );

  return (inventoryResult.data || []).map(
    (inv: any) => {
      const classification =
        classificationByWineId.get(inv.wine_id);

      const settings = settingsByWineId.get(
        inv.wine_id
      );

      return {
        company_id: inv.company_id || "",
        wine_id: inv.wine_id || "",
        producer: inv.producer || "",
        wine_name: inv.wine_name || "",
        cuvee: inv.cuvee || "",
        vintage: inv.vintage || "",
        bottle_size_cl: Number(
          inv.bottle_size_cl || 75
        ),
        current_quantity: Number(
          inv.current_quantity || 0
        ),
        avg_cost_ht: Number(
          inv.avg_cost_ht || 0
        ),

        country: classification?.country || "",
        region: classification?.region || "",
        subregion:
          classification?.subregion || "",
        appellation:
          classification?.appellation || "",
        climat: classification?.climat || "",
        cru_level:
          classification?.cru_level ||
          "UNKNOWN",
        category:
          classification?.category ||
          "UNKNOWN",

        sale_price: settings
          ? settings.sale_price === null
            ? null
            : Number(settings.sale_price)
          : null,
        manual_price: settings
          ? Boolean(settings.manual_price)
          : false,
        // DBのDEFAULT is_listed=trueには絶対に依存しない。
        // settings行が無い場合は必ずfalseとして扱う。
        is_listed: settings
          ? Boolean(settings.is_listed)
          : false,
        list_notes: settings
          ? settings.notes || null
          : null,

        hasClassification: Boolean(classification),
        hasListSettings: Boolean(settings),
      };
    }
  );
}

/*
 * modeOverride省略時は現在のwineListDisplayModeを使う。
 * MANAGE⇔CUSTOMERの切替ボタンは、setWineListDisplayMode()直後の
 * stateを待たずに済むよう、切替先のmodeを明示的にこの引数へ渡す
 * （useStateの更新はこの関数呼び出し内では反映されないため）。
 */
/*
 * Section 7「要確認 / 未分類」の対象判定。
 * MANAGEモードの行のうち、classification行が無い、
 * またはregionが空/Unknown相当、またはcategory=UNKNOWNのもの。
 */
function isWineListRowNeedingReview(row: WineListRow) {
  return (
    !row.hasClassification ||
    row.category === "UNKNOWN" ||
    isUnknownWineRegion(row.region)
  );
}

/*
 * Section 7「未分類を自動判定」。
 *
 * - 判定結果はwineReviewCandidates（UI state）へ入れるだけで、
 *   DBには一切書き込まない。保存は saveWineReviewCandidates() で
 *   ユーザーがチェックした行だけを対象に行う。
 * - category：Champagne/Crémant名 > 在庫color > 既存分類 > AI
 * - region  ：キーワードルール(Chablis→Bourgogne等) > 既存分類 > AI
 * - AIは既存の /api/classify-wines（1回20件まで）をそのまま再利用する。
 *   AIが失敗してもルールだけで候補を作る。
 */
async function autoClassifyWineReviewTargets() {
  if (
    isViewerRole ||
    wineReviewClassifying ||
    wineReviewSaving
  ) {
    return;
  }

  const targets = wineList.filter(
    (row) =>
      Boolean(row.wine_id) &&
      isWineListRowNeedingReview(row)
  );

  if (targets.length === 0) {
    return;
  }

  setWineReviewClassifying(true);
  setWineReviewStatus(
    tUi("wineReviewClassifying", {
      done: 0,
      total: targets.length,
    })
  );

  try {
    const companyId =
      await getCurrentCompanyIdForInventory();

    /*
     * colorはwine_list用の行に含まれないため、winesから取得する
     * （URL長を抑えるため100件ずつ）。
     */
    const wineInfoById = new Map<string, any>();
    const targetIds = targets.map((row) => row.wine_id);

    for (let i = 0; i < targetIds.length; i += 100) {
      const { data, error } = await supabase
        .from("wines")
        .select("id, producer, wine_name, cuvee, color, vintage")
        .eq("company_id", companyId)
        .in("id", targetIds.slice(i, i + 100));

      if (error) {
        throw error;
      }

      (data || []).forEach((w: any) => {
        wineInfoById.set(w.id, w);
      });
    }

    /*
     * AI判定（20件ずつ）。失敗したバッチはルールのみで判定する。
     */
    const aiById = new Map<string, WineClassification>();
    let aiErrorMessage = "";

    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20);

      try {
        const response = await fetch("/api/classify-wines", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wines: batch.map((row) => {
              const info = wineInfoById.get(row.wine_id);

              return {
                wine_id: row.wine_id,
                producer: info?.producer || row.producer || "",
                wine_name:
                  info?.wine_name ||
                  row.wine_name ||
                  row.cuvee ||
                  "",
                cuvee: info?.cuvee || row.cuvee || "",
                color: info?.color || "unknown",
                vintage: info?.vintage || row.vintage || "",
              };
            }),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || `HTTP ${response.status}`
          );
        }

        (Array.isArray(data?.wines) ? data.wines : []).forEach(
          (c: WineClassification) => {
            if (c?.wine_id) {
              aiById.set(c.wine_id, c);
            }
          }
        );
      } catch (error: any) {
        console.error("未分類ワインのAI判定エラー:", error);

        if (!aiErrorMessage) {
          aiErrorMessage =
            error?.message || String(error);
        }
      }

      setWineReviewStatus(
        tUi("wineReviewClassifying", {
          done: Math.min(i + 20, targets.length),
          total: targets.length,
        })
      );
    }

    const candidates: WineReviewCandidate[] = targets.map(
      (row) => {
        const info = wineInfoById.get(row.wine_id);
        const ai = aiById.get(row.wine_id);

        const producer = info?.producer ?? row.producer ?? "";
        const wineName = info?.wine_name ?? row.wine_name ?? "";
        const cuvee = info?.cuvee ?? row.cuvee ?? "";
        const color = info?.color || "";

        const nameText = normalizeWineRuleText(
          [producer, wineName, cuvee].join(" ")
        );

        const existingCategory =
          row.hasClassification &&
          row.category !== "UNKNOWN"
            ? row.category
            : null;

        const existingRegion =
          row.hasClassification &&
          !isUnknownWineRegion(row.region)
            ? row.region.trim()
            : null;

        let category: WineClassification["category"] =
          "UNKNOWN";
        let categorySource: WineReviewCandidate["categorySource"] =
          "NONE";
        const colorCategory = wineCategoryFromColor(color);

        if (isSparklingByName(nameText)) {
          category = "SPARKLING";
          categorySource = "RULE";
        } else if (colorCategory) {
          category = colorCategory;
          categorySource = "COLOR";
        } else if (existingCategory) {
          category = existingCategory;
          categorySource = "EXISTING";
        } else if (ai && ai.category !== "UNKNOWN") {
          category = ai.category;
          categorySource = "AI";
        }

        let region = "";
        let regionSource: WineReviewCandidate["regionSource"] =
          "NONE";
        const ruleRegion = wineRegionFromKeywords(nameText);

        if (ruleRegion) {
          region = ruleRegion;
          regionSource = "RULE";
        } else if (existingRegion) {
          region = existingRegion;
          regionSource = "EXISTING";
        } else if (ai && !isUnknownWineRegion(ai.region)) {
          region = ai.region.trim();
          regionSource = "AI";
        }

        /*
         * region/category以外は、既存分類の値があればそれを優先し、
         * 無ければAIの値を使う（既存の確定値をAIで上書きしない）。
         */
        const pick = (
          existing: string | undefined,
          aiValue: string | undefined
        ) =>
          (row.hasClassification && existing?.trim()) ||
          aiValue ||
          "";

        const country =
          regionSource === "RULE"
            ? "France"
            : pick(row.country, ai?.country) ===
                "Unknown"
              ? ""
              : pick(row.country, ai?.country);

        return {
          wine_id: row.wine_id,
          producer,
          wine_name: wineName,
          cuvee,
          vintage: info?.vintage ?? row.vintage ?? "",
          color,
          hadClassification: row.hasClassification,

          country,
          region,
          subregion: pick(row.subregion, ai?.subregion),
          appellation: pick(
            row.appellation,
            ai?.appellation
          ),
          climat: pick(row.climat, ai?.climat),
          cru_level:
            row.hasClassification &&
            row.cru_level !== "UNKNOWN"
              ? row.cru_level
              : ai?.cru_level || "UNKNOWN",
          category,
          confidence: Number(ai?.confidence || 0),
          notes: ai?.notes || "",

          regionSource,
          categorySource,
          edited: false,
          selected: Boolean(region) && category !== "UNKNOWN",
        };
      }
    );

    setWineReviewCandidates(candidates);

    setWineReviewStatus(
      aiErrorMessage
        ? tUi("wineReviewAiFailed", {
            error: aiErrorMessage,
          })
        : tUi("wineReviewClassified", {
            total: candidates.length,
          })
    );
  } catch (error: any) {
    console.error("未分類ワインの自動判定エラー:", error);
    setWineReviewStatus(
      tUi("wineListFetchFailed", {
        error: error?.message || String(error),
      })
    );
  } finally {
    setWineReviewClassifying(false);
  }
}

function updateWineReviewCandidate(
  wineId: string,
  patch: Partial<
    Pick<
      WineReviewCandidate,
      "region" | "category" | "selected"
    >
  >
) {
  setWineReviewCandidates((prev) =>
    prev.map((c) => {
      if (c.wine_id !== wineId) {
        return c;
      }

      const isValueEdit =
        patch.region !== undefined ||
        patch.category !== undefined;

      return {
        ...c,
        ...patch,
        edited: c.edited || isValueEdit,
      };
    })
  );
}

function isWineReviewCandidateSavable(
  c: WineReviewCandidate
) {
  return (
    !isUnknownWineRegion(c.region) &&
    c.category !== "UNKNOWN"
  );
}

/*
 * チェックされた候補だけをwine_classification_memoryへ保存する。
 *
 * - 保存形式は confirmWineClassification() と同じ
 *   （is_confirmed=true / confirmed_by / confirmed_at / source_*）。
 * - wine_list_settings（価格・掲載/非掲載）には一切触れない。
 *   在庫数・PDF・並び順にも影響しない。
 * - 保存後はSection 7(MANAGE)を再読込する。
 */
async function saveWineReviewCandidates() {
  if (isViewerRole || wineReviewSaving) {
    return;
  }

  const targets = wineReviewCandidates.filter(
    (c) =>
      c.selected &&
      isWineReviewCandidateSavable(c)
  );

  if (targets.length === 0) {
    return;
  }

  if (
    !confirm(
      tUi("wineReviewSaveConfirm", {
        count: targets.length,
      })
    )
  ) {
    return;
  }

  setWineReviewSaving(true);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(tApp("loginUserUnavailable"));
    }

    const companyId =
      await getCurrentCompanyIdForInventory();

    const now = new Date().toISOString();

    const rows = targets.map((c) => {
      const sourceText = c.wine_name || c.cuvee || "";

      const sourceKey = sourceText
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

      return {
        company_id: companyId,
        wine_id: c.wine_id,

        source_producer: c.producer || "",
        source_wine_name: sourceText,
        source_cuvee: c.cuvee || "",
        source_vintage: c.vintage || "",
        source_key: sourceKey,

        country: c.country || "",
        region: c.region.trim(),
        subregion: c.subregion || "",
        appellation: c.appellation || "",
        climat: c.climat || "",
        cru_level: c.cru_level,
        category: c.category,
        confidence: Number(c.confidence || 0),
        notes: c.notes || "",

        classification_source: c.edited
          ? "MANUAL_CONFIRMED"
          : "AI_CONFIRMED",

        manual_corrected: c.edited,
        is_confirmed: true,

        confirmed_by: user.id,
        confirmed_at: now,
        updated_at: now,
      };
    });

    const { error } = await supabase
      .from("wine_classification_memory")
      .upsert(rows, {
        onConflict: "company_id,wine_id",
      });

    if (error) {
      throw error;
    }

    const savedIds = new Set(
      targets.map((c) => c.wine_id)
    );

    setWineReviewCandidates((prev) =>
      prev.filter((c) => !savedIds.has(c.wine_id))
    );

    setWineReviewStatus(
      tUi("wineReviewSaved", {
        count: targets.length,
      })
    );

    await loadWineList("MANAGE");
  } catch (error: any) {
    console.error("未分類ワインの分類保存エラー:", error);
    alert(
      tUi("wineReviewSaveFailed", {
        error: error?.message || String(error),
      })
    );
  } finally {
    setWineReviewSaving(false);
  }
}

/*
 * Section 7「価格未設定」パネルの一括保存。
 *
 * 価格のみを保存し、掲載/非掲載(is_listed)は一切変更しない。
 * - settings行あり：sale_price / manual_price=true / updated_at のみUPDATE
 *   （is_listedは送らない。既存の saveWineListPrice() は分類済みwineの
 *     価格保存時にis_listed=trueにするが、この一括保存では行わない）
 * - settings行なし：is_listed=falseを明示してINSERT
 *   （UI上も行なし=非掲載として扱っているため状態は変わらない。
 *     DBのDEFAULT is_listed=trueには依存しない）
 * 成功した行だけwineListのlocal stateへ反映する（再読込は不要）。
 */
async function saveSelectedWinePrices() {
  if (isViewerRole || pricingSaving) {
    return;
  }

  const targets = pricingSavableSelectedRows.map((row) => ({
    row,
    price: parsePricingDraft(pricingDraftValue(row)) as number,
  }));

  if (targets.length === 0) {
    return;
  }

  if (
    !confirm(
      tUi("winePricingSaveConfirm", {
        count: targets.length,
      })
    )
  ) {
    return;
  }

  setPricingSaving(true);

  const saved = new Map<
    string,
    { sale_price: number; manual_price: boolean; is_listed: boolean }
  >();
  let failedCount = 0;
  let firstError = "";

  const recordError = (error: any) => {
    failedCount += 1;
    if (!firstError) {
      firstError = error?.message || String(error);
    }
  };

  try {
    const now = new Date().toISOString();

    const updates = targets.filter((t) => t.row.hasListSettings);
    const inserts = targets.filter((t) => !t.row.hasListSettings);

    for (let i = 0; i < updates.length; i += 10) {
      await Promise.all(
        updates.slice(i, i + 10).map(async ({ row, price }) => {
          const { data, error } = await supabase
            .from("wine_list_settings")
            .update({
              sale_price: price,
              manual_price: true,
              updated_at: now,
            })
            .eq("company_id", row.company_id)
            .eq("wine_id", row.wine_id)
            .select("sale_price,manual_price,is_listed")
            .single();

          if (error || !data) {
            recordError(
              error || new Error(tUi("salePriceSaveUnavailable"))
            );
            return;
          }

          saved.set(row.wine_id, {
            sale_price: Number(data.sale_price ?? price),
            manual_price: Boolean(data.manual_price),
            is_listed: Boolean(data.is_listed),
          });
        })
      );
    }

    if (inserts.length > 0) {
      const { data, error } = await supabase
        .from("wine_list_settings")
        .insert(
          inserts.map(({ row, price }) => ({
            company_id: row.company_id,
            wine_id: row.wine_id,
            sale_price: price,
            manual_price: true,
            is_listed: false,
            notes: null,
            updated_at: now,
          }))
        )
        .select("wine_id,sale_price,manual_price,is_listed");

      if (error) {
        inserts.forEach(() => recordError(error));
      } else {
        (data || []).forEach((d: any) => {
          saved.set(d.wine_id, {
            sale_price: Number(d.sale_price),
            manual_price: Boolean(d.manual_price),
            is_listed: Boolean(d.is_listed),
          });
        });
      }
    }

    if (saved.size > 0) {
      setWineList((prev) =>
        prev.map((item) => {
          const s = saved.get(item.wine_id);

          return s
            ? {
                ...item,
                sale_price: s.sale_price,
                manual_price: s.manual_price,
                is_listed: s.is_listed,
                hasListSettings: true,
              }
            : item;
        })
      );

      const clearSaved = <T,>(prev: Record<string, T>) => {
        const next = { ...prev };
        saved.forEach((_, wineId) => {
          delete next[wineId];
        });
        return next;
      };

      setPricingDrafts(clearSaved);
      setPricingSelected(clearSaved);
    }

    if (failedCount > 0) {
      setPricingStatus(
        tUi("winePricingSavePartial", {
          saved: saved.size,
          failed: failedCount,
          error: firstError,
        })
      );
      alert(
        tUi("salePriceSaveFailed", {
          error: firstError,
        })
      );
    } else {
      setPricingStatus(
        tUi("winePricingSaved", {
          count: saved.size,
        })
      );
    }
  } catch (error: any) {
    console.error("販売価格の一括保存エラー:", error);
    alert(
      tUi("salePriceSaveFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setPricingSaving(false);
  }
}

async function loadWineList(
  modeOverride?: "MANAGE" | "CUSTOMER"
) {
  setWineListLoading(true);
  setWineListStatus(tUi("wineListLoading"));

  const mode = modeOverride ?? wineListDisplayMode;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.company_id
    ) {
      throw new Error(
        tApp("companyInfoUnavailable")
      );
    }

    const rows: WineListRow[] =
      mode === "MANAGE"
        ? await fetchManageWineListRows(
            profile.company_id
          )
        : await fetchCustomerWineListRows(
            profile.company_id
          );

    setWineList(rows);

    const listedCount =
      rows.filter(
        (row) => row.is_listed
      ).length;

    setWineListStatus(
      tUi("wineListLoaded", {
        total: rows.length,
        listed: listedCount,
      })
    );

    console.log(
      "Supabase wine list rows:",
      mode,
      rows
    );
  } catch (error: any) {
    console.error(
      "ワインリスト取得エラー:",
      error
    );

    setWineList([]);

    setWineListStatus(
      tUi("wineListFetchError", {
        error: error?.message || tApp("unknownError"),
      })
    );
    } finally {
    setWineListLoading(false);
  }
}

async function saveWineListPrice(wineId: string) {
  if (savingWinePriceIds.includes(wineId)) {
    return;
  }

  if (isViewerRole) {
    alert(tUi("viewerReadOnlyAction"));
    return;
  }

  const row = wineList.find(
    (item) => item.wine_id === wineId
  );

  if (!row) {
    alert(tUi("wineInfoUnavailable"));
    return;
  }

  const draftValue =
    winePriceDrafts[wineId] ??
    (row.sale_price === null
      ? ""
      : String(row.sale_price));

  const normalizedValue =
    draftValue
      .replace(",", ".")
      .trim();

  const nextPrice =
    Number(normalizedValue);

  if (
    !normalizedValue ||
    !Number.isFinite(nextPrice) ||
    nextPrice <= 0
  ) {
    alert(tUi("salePricePositive"));
    return;
  }

  const roundedPrice =
    Math.round(nextPrice * 100) / 100;

  setSavingWinePriceIds((prev) =>
    prev.includes(wineId)
      ? prev
      : [...prev, wineId]
  );

  try {
    let savedRow:
      | {
          sale_price: number | null;
          manual_price: boolean;
          is_listed: boolean;
        }
      | null = null;

    if (row.hasListSettings) {
      /*
       * 既存settings行のUPDATE。
       *
       * classification済み（hasClassification=true）のwineは、
       * 価格保存時にis_listed=trueへする既存のBON PINARDの挙動を
       * そのまま維持する（ここを変えると既存顧客の掲載状態が
       * 意図せず変わってしまうため）。
       *
       * 未分類（hasClassification=false）のwineは、settings行が
       * 既に存在する場合（＝以前に価格だけ保存してINSERT済みの
       * ケース）でも、is_listedを絶対にtrueにしない。分類前の
       * wineが価格保存をきっかけに誤って掲載状態になり、後で
       * classification行が作られた瞬間にwine_list_view
       * （INNER JOIN）へ意図せず公開されてしまう事故を防ぐ。
       */
      const {
        data,
        error: saveError,
      } = await supabase
        .from("wine_list_settings")
        .update({
          sale_price: roundedPrice,
          manual_price: true,
          is_listed: row.hasClassification
            ? true
            : false,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "company_id",
          row.company_id
        )
        .eq(
          "wine_id",
          wineId
        )
        .select(
          "sale_price,manual_price,is_listed"
        )
        .single();

      if (saveError || !data) {
        throw new Error(
          saveError?.message ||
            tUi("salePriceSaveUnavailable")
        );
      }

      savedRow = data;
    } else {
      /*
       * settings行がまだ存在しないwine（INITIAL_IMPORT直後等）の
       * 初回保存。安全のため、価格だけの入力ではis_listedを
       * falseのまま作成する（DBのDEFAULT is_listed=trueには
       * 依存しない。掲載ONは別途saveWineListListing()経由で、
       * classification存在チェックを通してから行う）。
       */
      const {
        data,
        error: saveError,
      } = await supabase
        .from("wine_list_settings")
        .insert({
          company_id: row.company_id,
          wine_id: wineId,
          sale_price: roundedPrice,
          manual_price: true,
          is_listed: false,
          notes: null,
          updated_at:
            new Date().toISOString(),
        })
        .select(
          "sale_price,manual_price,is_listed"
        )
        .single();

      if (saveError || !data) {
        throw new Error(
          saveError?.message ||
            tUi("salePriceSaveUnavailable")
        );
      }

      savedRow = data;
    }

    const savedPrice =
      Number(
        savedRow.sale_price ??
          roundedPrice
      );

    setWineList((prev) =>
      prev.map((item) =>
        item.wine_id === wineId
          ? {
              ...item,
              sale_price: savedPrice,
              manual_price:
                Boolean(
                  savedRow!.manual_price
                ),
              is_listed:
                Boolean(
                  savedRow!.is_listed
                ),
              hasListSettings: true,
            }
          : item
      )
    );

    setWinePriceDrafts((prev) => ({
      ...prev,
      [wineId]:
        savedPrice.toFixed(2),
    }));

        setWineListStatus(
      tUi("salePriceSaved", {
        producer: row.producer,
        vintage: row.vintage || "",
        price: savedPrice.toFixed(2),
      })
    );
  } catch (error: any) {
    console.error(
      "販売価格保存エラー:",
      error
    );

    alert(
      tUi("salePriceSaveFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setSavingWinePriceIds((prev) =>
      prev.filter(
        (id) => id !== wineId
      )
    );
  }
}

async function saveWineListListing(
  wineId: string,
  nextIsListed: boolean
) {
  if (savingWineListingIds.includes(wineId)) {
    return;
  }

  if (isViewerRole) {
    alert(tUi("viewerReadOnlyAction"));
    return;
  }

  const row = wineList.find(
    (item) => item.wine_id === wineId
  );

  if (!row) {
    alert(tUi("wineInfoUnavailable"));
    return;
  }

  if (
    nextIsListed &&
    (
      row.sale_price === null ||
      !Number.isFinite(row.sale_price) ||
      row.sale_price <= 0
    )
  ) {
    alert(tUi("listingNeedsPrice"));
    return;
  }

  /*
   * 未分類（wine_classification_memory行が無い）wineは、
   * 安全のため「掲載ON」を許可しない。UI側でもボタンをdisabled
   * にしているが、ここでも二重に防御する。
   */
  if (
    nextIsListed &&
    !row.hasClassification
  ) {
    alert(tUi("listingNeedsClassification"));
    return;
  }

  setSavingWineListingIds((prev) =>
    prev.includes(wineId)
      ? prev
      : [...prev, wineId]
  );

  try {
    let savedRow: { is_listed: boolean } | null = null;

    if (row.hasListSettings) {
      const {
        data,
        error: saveError,
      } = await supabase
        .from("wine_list_settings")
        .update({
          is_listed: nextIsListed,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "company_id",
          row.company_id
        )
        .eq(
          "wine_id",
          wineId
        )
        .select("is_listed")
        .single();

      if (saveError || !data) {
        throw new Error(
          saveError?.message ||
            tUi("listingStateSaveUnavailable")
        );
      }

      savedRow = data;
    } else {
      /*
       * settings行がまだ存在しないwineの初回保存。
       * ここに到達するのはnextIsListed=falseのケースのみの想定
       * （nextIsListed=trueは上のlistingNeedsPriceガードで
       * 必ず先に弾かれるため、settings行未作成のままtrueで
       * INSERTされることは実質的に起こらない。念のため
       * is_listedの値はnextIsListedをそのまま使う）。
       */
      const {
        data,
        error: saveError,
      } = await supabase
        .from("wine_list_settings")
        .insert({
          company_id: row.company_id,
          wine_id: wineId,
          sale_price: null,
          manual_price: false,
          is_listed: nextIsListed,
          notes: null,
          updated_at:
            new Date().toISOString(),
        })
        .select("is_listed")
        .single();

      if (saveError || !data) {
        throw new Error(
          saveError?.message ||
            tUi("listingStateSaveUnavailable")
        );
      }

      savedRow = data;
    }

    const savedIsListed =
      Boolean(savedRow.is_listed);

    setWineList((prev) =>
      prev.map((item) =>
        item.wine_id === wineId
          ? {
              ...item,
              is_listed: savedIsListed,
              hasListSettings: true,
            }
          : item
      )
    );

    setWineListStatus(
      tUi(savedIsListed ? "wineListed" : "wineUnlisted", {
        producer: row.producer,
        vintage: row.vintage || "",
      })
    );
  } catch (error: any) {
    console.error(
      "掲載状態保存エラー:",
      error
    );

    alert(
      tUi("listingStateSaveFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setSavingWineListingIds((prev) =>
      prev.filter(
        (id) => id !== wineId
      )
    );
  }
}

function duplicateDecisionPairKey(
  firstWineId: string,
  secondWineId: string
) {
  const [wineIdA, wineIdB] = [
    firstWineId,
    secondWineId,
  ].sort((a, b) => a.localeCompare(b));

  return `${wineIdA}::${wineIdB}`;
}

async function loadSavedDuplicateDecisions() {
  const { data, error } = await supabase
    .from("wine_duplicate_decisions")
    .select(
      "wine_id_a,wine_id_b"
    )
    .eq(
      "decision",
      "DIFFERENT"
    );

  if (error) {
    console.error(
      "保存済み別ワイン判定の読込失敗",
      error
    );

    return;
  }

  const nextPairs: Record<string, true> =
    {};

  for (const row of data || []) {
    const wineIdA = String(
      row.wine_id_a || ""
    );

    const wineIdB = String(
      row.wine_id_b || ""
    );

    if (!wineIdA || !wineIdB) {
      continue;
    }

    nextPairs[
      duplicateDecisionPairKey(
        wineIdA,
        wineIdB
      )
    ] = true;
  }

  setSavedDifferentDuplicatePairs(
    nextPairs
  );
}

useEffect(() => {
  loadWineList();
  loadWineListHeaderSettings();
  loadSavedDuplicateDecisions();
  loadStockHistory();
  loadStockAlertData();
  checkAdminStatus();
  loadCurrentCustomerRole();
  loadCurrentCompanyName();
}, []);

/*
 * Section 4「0在庫も表示」トグル用。マウント時に一度（既定false）、
 * トグルが変わるたびに再度、loadCloudInventory()を呼び直す。
 * loadCloudInventory()自身はshowZeroStockInventoryをクロージャで
 * 参照するだけなので、常に呼び出し時点の最新state値で動く。
 */
useEffect(() => {
  loadCloudInventory();
}, [showZeroStockInventory]);

/*
 * isAdmin=trueが確認できたときだけ、Section 10用のcompanies一覧と
 * Section 11用の顧客サマリー一覧を取得する。
 * 一般顧客(isAdmin=false)ではこれらのAPIを一切呼び出さない。
 */
useEffect(() => {
  if (isAdmin) {
    loadAdminCompanies();
    loadCustomers();
  }
}, [isAdmin]);

async function classifyInventoryTest() {  if (classifyingWines) return;

  const normalizeTestText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const testTargets = [
  // Champagne
  {
    producer: "ALAIN BAILLY",
    wineName: "CHAMPAGNE NM",
  },
  {
    producer: "BERNARD GAUCHER",
    wineName: "CHAMPAGNE NM",
  },
  {
    producer: "CORNEVIN",
    wineName: "CHAMPAGNE NM",
  },

  // Bordeaux
  {
    producer: "BRANE CANTENAC",
    wineName: "MARGAUX 1974",
  },
  {
    producer: "CANTENAC BROWN",
    wineName: "MARGAUX 1970",
  },
  {
    producer: "CHEVAL BLANC",
    wineName: "SAINT EMILION 1951",
  },

  // Loire
  {
    producer: "CHATEAU YVONNE",
    wineName: "SAUMUR CHAMPIGNY",
    vintage: "2022",
  },
  {
    producer: "CHATEAU YVONNE",
    wineName: "SAUMUR BLANC",
    vintage: "2023",
  },
  {
    producer: "CHIDAINE",
    wineName: "TOURAINE SAUVIGNON",
  },

  // Rhône
  {
    producer: "BERARD",
    wineName: "CHATEAUNEUF DU PAPE 1962",
  },
  {
    producer: "CHANTE FLUTE",
    wineName: "CHATEAUNEUF DU PAPE 1985",
  },
  {
    producer: "DOMAINE DES TOURS",
    wineName: "VDP DE VAUCLUSE CLAIRETTE BLANC 2015",
  },

  // Cognac / Armagnac
  {
    producer: "COURVOISIER",
    wineName: "COGNAC",
  },
  {
    producer: "HENNESSY",
    wineName: "COGNAC NM",
  },
  {
    producer: "LARROZE",
    wineName: "BAS ARMAGNAC 1958",
  },

  // Bourgogne Blanc
  {
    producer: "AMIOT PONSOT",
    wineName: "CHASSAGNE MONTRACHET MACHERELLES 1991",
  },
  {
    producer: "BACHELET RAMONET",
    wineName: "CHASSAGNE MONTRACHET BLANC 2019",
  },
  {
    producer: "BICHOT",
    wineName: "CORTON CHARLEMAGNE 1991",
  },

  // Bourgogne Rouge
  {
    producer: "ARLAUD",
    wineName: "BOURGOGNE ROUGE RONCEVIE 1987",
  },
  {
    producer: "ANDRE PIERRE",
    wineName: "VOSNE ROMANEE 1980",
  },
];

const testWines = testTargets
  .map((target) =>
    allInventory.find((r) => {
      if (!r.wineId) {
        return false;
      }

      const producerText =
        normalizeTestText(r.producer);

      const wineText =
        normalizeTestText(
          `${r.raw || ""} ${r.cuvee || ""}`
        );

      const vintageText =
        normalizeTestText(r.vintage);

      const producerMatches =
        producerText.includes(target.producer);

      const wineMatches =
        wineText.includes(target.wineName);

      const vintageMatches =
        !target.vintage ||
        vintageText === target.vintage;

      return (
        producerMatches &&
        wineMatches &&
        vintageMatches
      );
    })
  )
  .filter((r): r is Item => Boolean(r));

if (testWines.length !== testTargets.length) {
  setClassificationMessage(
    "classificationTestTargetsMissing",
    {
      found: testWines.length,
    }
  );
  return;
}

  setWineClassifications([]);
  setManuallyEditedWineIds([]);
  setConfirmedWineIds([]);
  setMemoryMatchedWineIds([]);
  setSavingClassificationWineIds([]);
  setClassifyingWines(true);

  setClassificationMessage(
    "classificationSearchingConfirmed",
    {
      total: testWines.length,
    }
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error(
        tApp("companyInfoUnavailable")
      );
    }

    const testWineIds = testWines
      .map((r) => r.wineId)
      .filter((id): id is string => Boolean(id));

    const testWineIdSet = new Set(testWineIds);

    /*
     * company内の確認済み分類を取得する。
     *
     * 同じwine_idの再利用だけでなく、
     * 別wine_idの確認済み知識との照合にも使用する。
     */
    const {
      data: savedRows,
      error: savedError,
    } = await supabase
      .from("wine_classification_memory")
      .select(`
        wine_id,
        country,
        region,
        subregion,
        appellation,
        climat,
        cru_level,
        category,
        confidence,
        notes
      `)
      .eq("company_id", profile.company_id)
      .eq("is_confirmed", true);

    if (savedError) {
      throw new Error(
        tApp(
          "confirmedClassificationFetchFailed",
          {
            error: savedError.message,
          }
        )
      );
    }

    const allSavedRows = savedRows || [];

    /*
     * 今回の20件とwine_idが完全一致する確認済みデータ。
     * これはAIを使わず、そのまま確定値を使用する。
     */
    const exactSavedRows = allSavedRows.filter(
      (row: any) =>
        row.wine_id &&
        testWineIdSet.has(row.wine_id)
    );

    const savedClassifications: WineClassification[] =
      exactSavedRows.map((row: any) => ({
        wine_id: row.wine_id,
        country: row.country || "",
        region: row.region || "",
        subregion: row.subregion || "",
        appellation: row.appellation || "",
        climat: row.climat || "",
        cru_level: row.cru_level,
        category: row.category,
        confidence: Number(row.confidence || 0),
        notes: row.notes || "",
      }));

    const savedWineIds = new Set(
      savedClassifications.map((c) => c.wine_id)
    );

    /*
     * wine_idが未確認のものだけAIへ送る。
     */
    const winesForAI = testWines.filter(
      (r) =>
        r.wineId &&
        !savedWineIds.has(r.wineId)
    );

    let aiResults: WineClassification[] = [];

    if (winesForAI.length > 0) {
      setClassificationMessage(
        "classificationAiRunning",
        {
          confirmed:
            savedClassifications.length,
          ai:
            winesForAI.length,
        }
      );

      const response = await fetch("/api/classify-wines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wines: winesForAI.map((r) => ({
            wine_id: r.wineId || "",
            producer: r.producer || "",
            wine_name: r.raw || r.cuvee || "",
            cuvee: r.cuvee || "",
            color: r.color || "unknown",
            vintage: r.vintage || "",
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || `HTTP ${response.status}`
        );
      }

      aiResults = Array.isArray(data?.wines)
        ? data.wines
        : [];
    }

    /*
     * 表記揺れを吸収するための比較専用正規化。
     *
     * 例:
     * Côte de Nuits
     * Cote de Nuits
     *
     * を比較上は同じものとして扱う。
     */
    const normalizeMemoryText = (value: unknown) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    /*
     * 記憶照合の中心キー。
     *
     * Climatだけでは絶対に照合しない。
     *
     * Appellation
     * + cru_level
     * + Climat / Lieu-dit
     *
     * の3要素を必須コンテキストとして使用する。
     */
    const classificationMemoryKey = (row: any) => {
      const appellation =
        normalizeMemoryText(row.appellation);

      const cruLevel =
        String(row.cru_level || "").toUpperCase();

      const climat =
        normalizeMemoryText(row.climat);

      if (!appellation || !cruLevel) {
        return "";
      }

      if (
        cruLevel === "UNKNOWN"
      ) {
        return "";
      }

      return [
        appellation,
        cruLevel,
        climat,
      ].join(" | ");
    };

    /*
     * 同じAppellation + Cru + Climatでも、
     * country / region / subregionに矛盾した確認データが
     * 存在する場合は自動再利用しない。
     */
    const classificationContextKey = (row: any) =>
      [
        normalizeMemoryText(row.country),
        normalizeMemoryText(row.region),
        normalizeMemoryText(row.subregion),
        classificationMemoryKey(row),
      ].join(" | ");

    const memoryMatchedIds: string[] = [];

    /*
     * AI結果を、過去に人間が確認した分類知識と照合する。
     *
     * 完全一致し、確認済み知識同士にも矛盾がない場合だけ
     * 「記憶候補」とする。
     */
    const aiResultsWithMemory =
      aiResults.map((aiClassification) => {
        const aiKey =
          classificationMemoryKey(aiClassification);

        if (!aiKey) {
          return aiClassification;
        }

        const matchingMemoryRows =
          allSavedRows.filter((row: any) => {
            if (
              !row.wine_id ||
              row.wine_id === aiClassification.wine_id
            ) {
              return false;
            }

            return (
              classificationMemoryKey(row) === aiKey
            );
          });

        if (matchingMemoryRows.length === 0) {
          return aiClassification;
        }

        /*
         * 同じ分類キーに複数の確認済み記憶がある場合、
         * 地理情報の内容まで一致しているか確認する。
         */
        const contextKeys = new Set(
          matchingMemoryRows.map((row: any) =>
            classificationContextKey(row)
          )
        );

        /*
         * 過去の確認済みデータ同士に矛盾があれば、
         * 安全のため記憶候補にはしない。
         */
        if (contextKeys.size !== 1) {
          return aiClassification;
        }

        const referenceMemory =
          matchingMemoryRows[0];

        memoryMatchedIds.push(
          aiClassification.wine_id
        );

        /*
         * 確認済み記憶から再利用するのは
         * 地理・格付け情報だけ。
         *
         * categoryは同じAppellationでも
         * RED / WHITEなどが異なる場合があるため
         * AI自身の判定を維持する。
         *
         * confidence / notesも
         * 今回のワイン自身のAI結果を維持する。
         */
        return {
          ...aiClassification,

          country:
            referenceMemory.country ||
            aiClassification.country,

          region:
            referenceMemory.region ||
            aiClassification.region,

          subregion:
            referenceMemory.subregion ||
            aiClassification.subregion,

          appellation:
            referenceMemory.appellation ||
            aiClassification.appellation,

          climat:
            referenceMemory.climat ||
            aiClassification.climat,

          cru_level:
            referenceMemory.cru_level ||
            aiClassification.cru_level,

          category:
            aiClassification.category,

          confidence:
            aiClassification.confidence,

          notes:
            aiClassification.notes,
        } as WineClassification;
      });

    const classificationByWineId = new Map<
      string,
      WineClassification
    >();

    /*
     * 同じwine_idの確認済みデータを最優先する。
     */
    savedClassifications.forEach((c) => {
      classificationByWineId.set(
        c.wine_id,
        c
      );
    });

    /*
     * それ以外には、
     * AI結果または記憶候補結果を使用する。
     */
    aiResultsWithMemory.forEach((c) => {
      classificationByWineId.set(
        c.wine_id,
        c
      );
    });

    /*
     * 元の20件と同じ順番へ戻す。
     */
    const mergedResults = testWines
      .map((r) =>
        r.wineId
          ? classificationByWineId.get(r.wineId)
          : undefined
      )
      .filter(
        (c): c is WineClassification =>
          Boolean(c)
      );

    setWineClassifications(
      mergedResults
    );

    /*
     * 同じwine_idですでに確認済みのもの。
     */
    setConfirmedWineIds(
      savedClassifications.map(
        (c) => c.wine_id
      )
    );

    /*
     * 別wine_idの確認済み知識と一致したもの。
     * まだ確認済みにはせず「記憶候補」とする。
     */
    setMemoryMatchedWineIds(
      Array.from(
        new Set(memoryMatchedIds)
      )
    );

    const memoryMatchedCount =
      new Set(memoryMatchedIds).size;

    const pureAiCount =
      aiResults.length -
      memoryMatchedCount;

    setClassificationMessage(
      "classificationComplete",
      {
        total:
          mergedResults.length,
        confirmed:
          savedClassifications.length,
        memory:
          memoryMatchedCount,
        ai:
          pureAiCount,
      }
    );
  } catch (error: any) {
    console.error(
      "ワインAI分類エラー:",
      error
    );

    setClassificationMessage(
      "classificationError",
      {
        error:
          error?.message ||
          tApp("unknownError"),
      }
    );
   } finally {
    setClassifyingWines(false);
  }
}

async function saveClassificationCandidateBatch(
  companyId: string,
  sourceWines: Item[],
  classifications: WineClassification[]
) {
  const now = new Date().toISOString();

  const sourceWineById = new Map(
    sourceWines
      .filter((r) => r.wineId)
      .map((r) => [r.wineId as string, r])
  );

  const rows = classifications
    .map((classification) => {
      const sourceWine = sourceWineById.get(
        classification.wine_id
      );

      if (!sourceWine) {
        return null;
      }

      const sourceText =
        sourceWine.raw ||
        sourceWine.cuvee ||
        "";

      const sourceKey = sourceText
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

      return {
        company_id: companyId,
        wine_id: classification.wine_id,

        source_producer:
          sourceWine.producer || "",

        source_wine_name:
          sourceWine.raw ||
          sourceWine.cuvee ||
          "",

        source_cuvee:
          sourceWine.cuvee || "",

        source_vintage:
          sourceWine.vintage || "",

        source_key: sourceKey,

        country:
          classification.country || "",

        region:
          classification.region || "",

        subregion:
          classification.subregion || "",

        appellation:
          classification.appellation || "",

        climat:
          classification.climat || "",

        cru_level:
          classification.cru_level,

        category:
          classification.category,

        confidence:
          Number(
            classification.confidence || 0
          ),

        notes:
          classification.notes || "",

        classification_source:
          "AI_CANDIDATE",

        manual_corrected: false,
        is_confirmed: false,

        confirmed_by: null,
        confirmed_at: null,

        updated_at: now,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        Boolean(row)
    );

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("wine_classification_memory")
    .upsert(rows, {
      onConflict: "company_id,wine_id",
    });

  if (error) {
    throw new Error(
      tApp(
        "aiCandidateTempSaveFailed",
        {
          error: error.message,
        }
      )
    );
  }
}

async function classifyAllInventory() {
  if (classifyingWines) return;

  const targetWines = allInventory.filter((r) =>
    Boolean(r.wineId)
  );

  if (targetWines.length === 0) {
    setClassificationMessage(
      "noClassifiableInventory"
    );
    return;
  }

  const shouldStart = confirm(
    tApp("classifyAllConfirm", {
      total: targetWines.length,
    })
  );

  if (!shouldStart) return;

  setWineClassifications([]);
  setManuallyEditedWineIds([]);
  setConfirmedWineIds([]);
  setMemoryMatchedWineIds([]);
  setSavingClassificationWineIds([]);
  setClassifyingWines(true);

  setClassificationMessage(
    "classificationAllSearchingConfirmed",
    {
      total: targetWines.length,
    }
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.company_id
    ) {
      throw new Error(
        tApp("companyInfoUnavailable")
      );
    }

    const targetWineIds = targetWines
      .map((r) => r.wineId)
      .filter(
        (id): id is string =>
          Boolean(id)
      );

    const targetWineIdSet =
      new Set(targetWineIds);

    const {
      data: savedRows,
      error: savedError,
    } = await supabase
      .from("wine_classification_memory")
      .select(`
        wine_id,
        country,
        region,
        subregion,
        appellation,
        climat,
        cru_level,
        category,
        confidence,
        notes
      `)
      .eq(
        "company_id",
        profile.company_id
      )
      .eq("is_confirmed", true);

    if (savedError) {
      throw new Error(
        tApp(
          "confirmedClassificationFetchFailed",
          {
            error: savedError.message,
          }
        )
      );
    }

        const allSavedRows =
      savedRows || [];

    const {
      data: candidateRows,
      error: candidateError,
    } = await supabase
      .from("wine_classification_memory")
      .select(`
        wine_id,
        country,
        region,
        subregion,
        appellation,
        climat,
        cru_level,
        category,
        confidence,
        notes
      `)
      .eq(
        "company_id",
        profile.company_id
      )
      .eq(
        "classification_source",
        "AI_CANDIDATE"
      )
      .eq("is_confirmed", false);

    if (candidateError) {
      throw new Error(
        tApp(
          "savedAiCandidateFetchFailed",
          {
            error:
              candidateError.message,
          }
        )
      );
    }

    const candidateClassifications:
      WineClassification[] =
        (candidateRows || [])
          .filter(
            (row: any) =>
              row.wine_id &&
              targetWineIdSet.has(
                row.wine_id
              )
          )
          .map((row: any) => ({
            wine_id: row.wine_id,
            country: row.country || "",
            region: row.region || "",
            subregion: row.subregion || "",
            appellation:
              row.appellation || "",
            climat: row.climat || "",
            cru_level: row.cru_level,
            category: row.category,
            confidence: Number(
              row.confidence || 0
            ),
            notes: row.notes || "",
          }));

    const candidateWineIds =
      new Set(
        candidateClassifications.map(
          (c) => c.wine_id
        )
      );

    const exactSavedRows =
      allSavedRows.filter(
        (row: any) =>
          row.wine_id &&
          targetWineIdSet.has(
            row.wine_id
          )
      );

    const savedClassifications:
      WineClassification[] =
        exactSavedRows.map(
          (row: any) => ({
            wine_id: row.wine_id,
            country:
              row.country || "",
            region:
              row.region || "",
            subregion:
              row.subregion || "",
            appellation:
              row.appellation || "",
            climat:
              row.climat || "",
            cru_level:
              row.cru_level,
            category:
              row.category,
            confidence:
              Number(
                row.confidence || 0
              ),
            notes:
              row.notes || "",
          })
        );

    const savedWineIds =
      new Set(
        savedClassifications.map(
          (c) => c.wine_id
        )
      );

    /*
     * すでにwine_id単位で確認済みのワインは
     * AIへ送らない。
     */
        const winesForAI =
      targetWines.filter(
        (r) =>
          r.wineId &&
          !savedWineIds.has(
            r.wineId
          ) &&
          !candidateWineIds.has(
            r.wineId
          )
      );

    const normalizeMemoryText = (
      value: unknown
    ) =>
      String(value || "")
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toUpperCase()
        .replace(
          /[^A-Z0-9]+/g,
          " "
        )
        .trim()
        .replace(/\s+/g, " ");

    /*
     * Climatだけでは照合しない。
     *
     * Appellation
     * + cru_level
     * + Climat
     *
     * を記憶照合キーにする。
     */
    const classificationMemoryKey = (
      row: any
    ) => {
      const appellation =
        normalizeMemoryText(
          row.appellation
        );

      const cruLevel =
        String(
          row.cru_level || ""
        ).toUpperCase();

      const climat =
        normalizeMemoryText(
          row.climat
        );

      if (
        !appellation ||
        !cruLevel
      ) {
        return "";
      }

      if (
        cruLevel === "UNKNOWN"
      ) {
        return "";
      }

      return [
        appellation,
        cruLevel,
        climat,
      ].join(" | ");
    };

    const classificationContextKey =
      (row: any) =>
        [
          normalizeMemoryText(
            row.country
          ),
          normalizeMemoryText(
            row.region
          ),
          normalizeMemoryText(
            row.subregion
          ),
          classificationMemoryKey(
            row
          ),
        ].join(" | ");

    const memoryMatchedIds:
      string[] = [];

    const aiResults:
      WineClassification[] = [];

        const aiResultsWithMemory:
      WineClassification[] = [
        ...candidateClassifications,
      ];

    /*
     * 現在までの結果を
     * 元の全在庫順に並べ直す。
     */
    const buildMergedResults =
      () => {
        const classificationByWineId =
          new Map<
            string,
            WineClassification
          >();

        savedClassifications.forEach(
          (c) => {
            classificationByWineId.set(
              c.wine_id,
              c
            );
          }
        );

        aiResultsWithMemory.forEach(
          (c) => {
            classificationByWineId.set(
              c.wine_id,
              c
            );
          }
        );

        return targetWines
          .map((r) =>
            r.wineId
              ? classificationByWineId.get(
                  r.wineId
                )
              : undefined
          )
          .filter(
            (
              c
            ): c is WineClassification =>
              Boolean(c)
          );
      };

    /*
     * すでにwine_id単位で確認済みのものは
     * 最初から確認済みとして表示する。
     */
    setConfirmedWineIds(
      savedClassifications.map(
        (c) => c.wine_id
      )
    );

    setWineClassifications(
      buildMergedResults()
    );

    /*
 * APIは1回最大20件。
 * 20件 × 2リクエストを並列処理するため、
 * 1ラウンド最大40件を処理する。
 */
const batchSize = 40;

    const totalBatches =
      Math.ceil(
        winesForAI.length /
          batchSize
      );

    for (
      let start = 0;
      start <
      winesForAI.length;
      start += batchSize
    ) {
      const batch =
        winesForAI.slice(
          start,
          start + batchSize
        );

      const batchNumber =
        Math.floor(
          start / batchSize
        ) + 1;

      setClassificationMessage(
        "classificationBatchProgress",
        {
          total:
            targetWines.length,
          confirmed:
            savedClassifications.length,
          from:
            start + 1,
          to:
            Math.min(
              start + batch.length,
              winesForAI.length
            ),
          aiTotal:
            winesForAI.length,
          batch:
            batchNumber,
          batches:
            totalBatches,
        }
      );

            const requestBatches = [
        batch.slice(0, 20),
        batch.slice(20, 40),
      ].filter(
        (requestBatch) =>
          requestBatch.length > 0
      );

      const parallelResults =
        await Promise.all(
          requestBatches.map(
            async (
              requestBatch,
              requestIndex
            ) => {
              const response =
                await fetch(
                  "/api/classify-wines",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body:
                      JSON.stringify({
                        wines:
                          requestBatch.map(
                            (r) => ({
                              wine_id:
                                r.wineId ||
                                "",

                              producer:
                                r.producer ||
                                "",

                              wine_name:
                                r.raw ||
                                r.cuvee ||
                                "",

                              cuvee:
                                r.cuvee ||
                                "",

                              color:
                                r.color ||
                                "unknown",

                              vintage:
                                r.vintage ||
                                "",
                            })
                          ),
                      }),
                  }
                );

              const data =
                await response.json();

              if (!response.ok) {
                throw new Error(
                  tApp(
                    "parallelProcessingError",
                    {
                      index:
                        requestIndex + 1,
                      error:
                        data?.error ||
                        `HTTP ${response.status}`,
                    }
                  )
                );
              }

              const results:
                WineClassification[] =
                  Array.isArray(
                    data?.wines
                  )
                    ? data.wines
                    : [];

              if (
                results.length !==
                requestBatch.length
              ) {
                throw new Error(
                  tApp(
                    "parallelResultCountMismatch",
                    {
                      index:
                        requestIndex + 1,
                      input:
                        requestBatch.length,
                      output:
                        results.length,
                    }
                  )
                );
              }

              return results;
            }
          )
        );

      const batchResults:
        WineClassification[] =
          parallelResults.flat();

            /*
       * 今回の最大40件に対して結果件数が違う場合は
       * 安全のため処理を止める。
       */
      if (
        batchResults.length !==
        batch.length
      ) {
        throw new Error(
          tApp(
            "batchResultCountMismatch",
            {
              batch: batchNumber,
              batches: totalBatches,
              input: batch.length,
              output:
                batchResults.length,
            }
          )
        );
      }

      aiResults.push(
        ...batchResults
      );

      /*
       * 各AI結果を確認済み記憶と照合する。
       */
      const adjustedBatchResults =
        batchResults.map(
          (
            aiClassification
          ) => {
            const aiKey =
              classificationMemoryKey(
                aiClassification
              );

            if (!aiKey) {
              return aiClassification;
            }

            const matchingMemoryRows =
              allSavedRows.filter(
                (row: any) => {
                  if (
                    !row.wine_id ||
                    row.wine_id ===
                      aiClassification.wine_id
                  ) {
                    return false;
                  }

                  return (
                    classificationMemoryKey(
                      row
                    ) === aiKey
                  );
                }
              );

            if (
              matchingMemoryRows.length ===
              0
            ) {
              return aiClassification;
            }

            const contextKeys =
              new Set(
                matchingMemoryRows.map(
                  (row: any) =>
                    classificationContextKey(
                      row
                    )
                )
              );

            /*
             * 過去の確認済みデータ同士に
             * 矛盾がある場合は再利用しない。
             */
            if (
              contextKeys.size !== 1
            ) {
              return aiClassification;
            }

            const referenceMemory =
              matchingMemoryRows[0];

            memoryMatchedIds.push(
              aiClassification.wine_id
            );

            /*
             * 地理・格付けだけ記憶を使用。
             *
             * category / confidence / notes は
             * 今回のAI判定を維持する。
             */
            return {
              ...aiClassification,

              country:
                referenceMemory.country ||
                aiClassification.country,

              region:
                referenceMemory.region ||
                aiClassification.region,

              subregion:
                referenceMemory.subregion ||
                aiClassification.subregion,

              appellation:
                referenceMemory.appellation ||
                aiClassification.appellation,

              climat:
                referenceMemory.climat ||
                aiClassification.climat,

              cru_level:
                referenceMemory.cru_level ||
                aiClassification.cru_level,

              category:
                aiClassification.category,

              confidence:
                aiClassification.confidence,

              notes:
                aiClassification.notes,
            } as WineClassification;
          }
        );

           await saveClassificationCandidateBatch(
        profile.company_id,
        batch,
        adjustedBatchResults
      );

      aiResultsWithMemory.push(
        ...adjustedBatchResults
      );

      setMemoryMatchedWineIds(
        Array.from(
          new Set(
            memoryMatchedIds
          )
        )
      );

      /*
       * 20件終わるごとに
       * 途中結果を画面へ表示する。
       */
      const mergedResults =
        buildMergedResults();

      setWineClassifications(
        mergedResults
      );

      setClassificationMessage(
        "classificationProcessing",
        {
          done:
            mergedResults.length,
          total:
            targetWines.length,
          confirmed:
            savedClassifications.length,
          memory:
            new Set(
              memoryMatchedIds
            ).size,
          aiDone:
            aiResults.length,
          aiTotal:
            winesForAI.length,
        }
      );

      /*
       * 連続リクエストを少しだけ間隔を空ける。
       */
      if (
        start + batchSize <
        winesForAI.length
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              300
            )
        );
      }
    }

    const finalMergedResults =
      buildMergedResults();

    const memoryMatchedCount =
      new Set(
        memoryMatchedIds
      ).size;

    const pureAiCount =
      aiResults.length -
      memoryMatchedCount;

    setWineClassifications(
      finalMergedResults
    );

    setMemoryMatchedWineIds(
      Array.from(
        new Set(
          memoryMatchedIds
        )
      )
    );

    setClassificationMessage(
      "classificationAllComplete",
      {
        done:
          finalMergedResults.length,
        total:
          targetWines.length,
        confirmed:
          savedClassifications.length,
        memory:
          memoryMatchedCount,
        ai:
          pureAiCount,
      }
    );
  } catch (error: any) {
    console.error(
      "全在庫ワインAI分類エラー:",
      error
    );

    setClassificationMessage(
      "classificationAllErrorPartial",
      {
        error:
          error?.message ||
          tApp("unknownError"),
      }
    );
  } finally {
    setClassifyingWines(
      false
    );
  }
}

function updateWineClassification(
  wineId: string,
  key: EditableWineClassificationKey,
  value: string
) {
  setWineClassifications((prev) =>
    prev.map((c) =>
      c.wine_id === wineId
        ? ({
            ...c,
            [key]: value,
          } as WineClassification)
        : c
    )
  );

  setManuallyEditedWineIds((prev) =>
    prev.includes(wineId)
      ? prev
      : [...prev, wineId]
  );

  // 確認済みのワインを再編集した場合は、
  // 再確認が必要なので「確認済み」を解除する
  setConfirmedWineIds((prev) =>
    prev.filter((id) => id !== wineId)
  );

  // 記憶候補を人が編集した場合は、
  // 純粋な記憶候補ではなく手動修正として扱う
  setMemoryMatchedWineIds((prev) =>
    prev.filter((id) => id !== wineId)
  );
}async function confirmWineClassification(wineId: string) {
  if (savingClassificationWineIds.includes(wineId)) {
    return;
  }

  const classification = wineClassifications.find(
    (c) => c.wine_id === wineId
  );

  const sourceWine = allInventory.find(
    (r) => r.wineId === wineId
  );

  if (!classification || !sourceWine) {
    alert(
      tApp("classificationWineMissing")
    );
    return;
  }

  setSavingClassificationWineIds((prev) =>
    prev.includes(wineId)
      ? prev
      : [...prev, wineId]
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error(
        tApp("companyInfoUnavailable")
      );
    }

    const manualCorrected =
  manuallyEditedWineIds.includes(wineId);

const memoryMatched =
  memoryMatchedWineIds.includes(wineId);

const sourceText =
  sourceWine.raw ||
  sourceWine.cuvee ||
  "";

const sourceKey = sourceText
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const now = new Date().toISOString();

const classificationData = {
  company_id: profile.company_id,
  wine_id: wineId,

  source_producer: sourceWine.producer || "",
  source_wine_name:
    sourceWine.raw || sourceWine.cuvee || "",
  source_cuvee: sourceWine.cuvee || "",
  source_vintage: sourceWine.vintage || "",
  source_key: sourceKey,

  country: classification.country || "",
  region: classification.region || "",
  subregion: classification.subregion || "",
  appellation: classification.appellation || "",
  climat: classification.climat || "",
  cru_level: classification.cru_level,
  category: classification.category,
  confidence: Number(classification.confidence || 0),
  notes: classification.notes || "",

  classification_source: manualCorrected
    ? "MANUAL_CONFIRMED"
    : memoryMatched
      ? "MEMORY_CONFIRMED"
      : "AI_CONFIRMED",

  manual_corrected: manualCorrected,
  is_confirmed: true,

  confirmed_by: user.id,
  confirmed_at: now,
  updated_at: now,
};
    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("wine_classification_memory")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("wine_id", wineId)
      .limit(1);

    if (existingError) {
      throw new Error(
        tApp(
          "existingClassificationCheckFailed",
          {
            error: existingError.message,
          }
        )
      );
    }

    if (existingRows && existingRows.length > 0) {
      const { error: updateError } = await supabase
        .from("wine_classification_memory")
        .update(classificationData)
        .eq("id", existingRows[0].id);

      if (updateError) {
        throw new Error(
          tApp(
            "classificationUpdateFailed",
            {
              error: updateError.message,
            }
          )
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("wine_classification_memory")
        .insert(classificationData);

      if (insertError) {
        throw new Error(
          tApp(
            "classificationSaveFailed",
            {
              error: insertError.message,
            }
          )
        );
      }
    }

    setConfirmedWineIds((prev) =>
      prev.includes(wineId)
        ? prev
        : [...prev, wineId]
    );

    setClassificationMessage(
      "classificationSavedConfirmed",
      {
        wine: `${
          sourceWine.producer || ""
        } ${
          sourceWine.raw ||
          sourceWine.cuvee ||
          ""
        }`.trim(),
      }
    );
  } catch (error: any) {
    console.error(
      "ワイン分類の確認保存エラー:",
      error
    );

    alert(
      tApp(
        "classificationConfirmedSaveFailed",
        {
          error:
            error?.message ||
            tApp("unknownError"),
        }
      )
    );
  } finally {
    setSavingClassificationWineIds((prev) =>
      prev.filter((id) => id !== wineId)
    );
  }
}

/*
 * 表示中の在庫（検索フィルタ後）を対象に、
 * wine_name原文からAIでキュヴェ名候補を抽出する。
 *
 * 既存のcuveeはOCR由来のノイズを含むことがあるため、
 * ここでの提案はAIが原文から改めて抽出したものであり、
 * 人が確認して初めてwines.cuveeへ反映される。
 */
async function extractCuveeForInventory() {
  if (extractingCuvee) {
    return;
  }

  const targetWines = section5TargetInventory.filter(
    (r) => r.wineId
  );

  if (targetWines.length === 0) {
    alert(tUi("cuveeNoTarget"));
    return;
  }

  setExtractingCuvee(true);

  setCuveeStatus(
    tUi("cuveeExtractProgress", {
      from: 0,
      to: 0,
      total: targetWines.length,
    })
  );

  const batchSize = 20;
  const results: CuveeSuggestion[] = [];

  try {
    for (
      let start = 0;
      start < targetWines.length;
      start += batchSize
    ) {
      const batch = targetWines.slice(
        start,
        start + batchSize
      );

      setCuveeStatus(
        tUi("cuveeExtractProgress", {
          from: start + 1,
          to: Math.min(start + batch.length, targetWines.length),
          total: targetWines.length,
        })
      );

      const response = await fetch("/api/extract-cuvee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wines: batch.map((r) => ({
            wine_id: r.wineId || "",
            producer: r.producer || "",
            wine_name: r.raw || r.cuvee || "",
            cuvee: r.cuvee || "",
            vintage: r.vintage || "",
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || `HTTP ${response.status}`
        );
      }

      const batchResults: CuveeSuggestion[] = Array.isArray(
        data?.wines
      )
        ? data.wines
        : [];

      const normalizeCuveeComparisonText = (
        value: unknown
      ) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, " ")
          .trim()
          .replace(/\s+/g, " ");

      const safeBatchResults =
        batchResults.map((suggestion) => {
          const sourceWine = batch.find(
            (r) =>
              r.wineId === suggestion.wine_id
          );

          if (!sourceWine) {
            return suggestion;
          }

          const producerKey =
            normalizeCuveeComparisonText(
              sourceWine.producer
            );

          const cuveeKey =
            normalizeCuveeComparisonText(
              suggestion.cuvee
            );

          if (
            producerKey &&
            cuveeKey &&
            producerKey === cuveeKey
          ) {
            return {
              ...suggestion,
              cuvee: "",
              notes: [
                suggestion.notes,
                tUi("cuveeProducerSameFilteredNote"),
              ]
                .filter(Boolean)
                .join(" "),
            };
          }

          return suggestion;
        });

      results.push(...safeBatchResults);
    }

    setCuveeSuggestions(results);
    setManuallyEditedCuveeWineIds([]);
    setConfirmedCuveeWineIds([]);

    setCuveeStatus(
      tUi("cuveeExtractComplete", { total: results.length })
    );
  } catch (error: any) {
    console.error("キュヴェ抽出エラー:", error);

    setCuveeStatus(
      tUi("cuveeExtractFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setExtractingCuvee(false);
  }
}

function updateCuveeSuggestion(
  wineId: string,
  value: string
) {
  setCuveeSuggestions((prev) =>
    prev.map((c) =>
      c.wine_id === wineId
        ? { ...c, cuvee: value }
        : c
    )
  );

  setManuallyEditedCuveeWineIds((prev) =>
    prev.includes(wineId) ? prev : [...prev, wineId]
  );

  setConfirmedCuveeWineIds((prev) =>
    prev.filter((id) => id !== wineId)
  );
}

async function confirmCuveeSuggestion(wineId: string) {
  if (savingCuveeWineIds.includes(wineId)) {
    return;
  }

  const suggestion = cuveeSuggestions.find(
    (c) => c.wine_id === wineId
  );

  if (!suggestion) {
    alert(tUi("cuveeSaveInfoMissing"));
    return;
  }

  setSavingCuveeWineIds((prev) =>
    prev.includes(wineId) ? prev : [...prev, wineId]
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(tApp("loginUserUnavailable"));
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error(tApp("companyInfoUnavailable"));
    }

    const { error: updateError } = await supabase
      .from("wines")
      .update({
        cuvee: suggestion.cuvee || null,
      })
      .eq("id", wineId)
      .eq("company_id", profile.company_id);

    if (updateError) {
      throw new Error(
        tUi("cuveeSaveFailed", { error: updateError.message })
      );
    }

    setConfirmedCuveeWineIds((prev) =>
      prev.includes(wineId) ? prev : [...prev, wineId]
    );
  } catch (error: any) {
    console.error("キュヴェ確認保存エラー:", error);

    alert(
      tUi("cuveeSaveFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setSavingCuveeWineIds((prev) =>
      prev.filter((id) => id !== wineId)
    );
  }
}

async function confirmValidCuveeSuggestions() {
  const targets = cuveeSuggestions.filter(
    (suggestion) =>
      suggestion.cuvee.trim() &&
      !confirmedCuveeWineIds.includes(
        suggestion.wine_id
      )
  );

  if (targets.length === 0) {
    alert(tUi("cuveeNoValidSuggestions"));
    return;
  }

  const shouldSave = confirm(
    tUi("cuveeBulkConfirm", { total: targets.length })
  );

  if (!shouldSave) {
    return;
  }

  for (
    let index = 0;
    index < targets.length;
    index += 1
  ) {
    const target = targets[index];

    setCuveeStatus(
      tUi("cuveeBulkSaving", {
        current: index + 1,
        total: targets.length,
      })
    );

    await confirmCuveeSuggestion(
      target.wine_id
    );
  }

  await loadCloudInventory();
  await loadWineList();

  setCuveeStatus(
    tUi("cuveeBulkComplete", { total: targets.length })
  );
}

function markDuplicateResolution(
  wineId: string,
  status: "PENDING" | "SAME" | "DIFFERENT"
) {
  setDuplicateResolutions((prev) => ({
    ...prev,
    [wineId]: status,
  }));
}

async function saveDuplicateDifferentDecision(
  reference: Item,
  candidate: Item,
  makeDifferent: boolean
) {
  if (!reference.wineId || !candidate.wineId) {
    return;
  }

  const candidateWineId = candidate.wineId;

  const [wineIdA, wineIdB] = [
    reference.wineId,
    candidate.wineId,
  ].sort((a, b) => a.localeCompare(b));

  /*
   * 先に画面へ反映する。
   * DB保存に失敗した場合はcatchで元へ戻す。
   */
  markDuplicateResolution(
    candidateWineId,
    makeDifferent ? "DIFFERENT" : "PENDING"
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        tApp("loginUserUnavailable")
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.company_id
    ) {
      throw new Error(
        tApp("companyInfoUnavailable")
      );
    }

    if (makeDifferent) {
      const { error } = await supabase
        .from("wine_duplicate_decisions")
        .insert({
          company_id: profile.company_id,
          wine_id_a: wineIdA,
          wine_id_b: wineIdB,
          decision: "DIFFERENT",
          decided_by: user.id,
        });

      /*
       * 23505 = すでに同じペアが保存済み。
       * その場合は正常扱いにする。
       */
      if (
        error &&
        error.code !== "23505"
      ) {
        throw new Error(
          tUi("duplicateDecisionSaveFailed", { error: error.message })
        );
      }

      setMergeStatus(tUi("duplicateDecisionSaved"));
    } else {
      const { error } = await supabase
        .from("wine_duplicate_decisions")
        .delete()
        .eq(
          "company_id",
          profile.company_id
        )
        .eq("wine_id_a", wineIdA)
        .eq("wine_id_b", wineIdB);

      if (error) {
        throw new Error(
          tUi("duplicateDecisionCancelFailed", { error: error.message })
        );
      }

      setMergeStatus(tUi("duplicateDecisionCancelled"));
    }
  } catch (error: any) {
    console.error(
      "別ワイン判定保存エラー:",
      error
    );

    /*
     * DB保存に失敗したら画面表示も元へ戻す。
     */
    markDuplicateResolution(
      candidateWineId,
      makeDifferent
        ? "PENDING"
        : "DIFFERENT"
    );

    alert(
      error?.message || tUi("duplicateDecisionGenericFailed")
    );
  }
}

/*
 * 重複候補（基準行 reference / 候補行 candidate）を
 * 「同じワイン」として統合する。
 *
 * ここでの判断はすべて最新のDB状態（wine_classification_memory・
 * wine_list_settings）を取り直してから行い、画面上の一時状態には頼らない。
 *
 * - 確認済み分類が両方にあり矛盾する場合は中止する。
 * - 手動価格が両方にあり矛盾する場合は人に確認する。
 * - 実行はSupabase側のmerge_wines()（アトミックなRPC）に一任する。
 */
async function handleMergeDuplicate(
  reference: Item,
  candidate: Item,
  similarity: number,
  confidence: DuplicateConfidence
) {
  if (!reference.wineId || !candidate.wineId) {
    return;
  }

  const candidateWineId = candidate.wineId;

  if (mergingWineIds.includes(candidateWineId)) {
    return;
  }

  setMergingWineIds((prev) => [...prev, candidateWineId]);
  setMergeStatus(tUi("mergeChecking"));

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(tApp("loginUserUnavailable"));
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error(tApp("companyInfoUnavailable"));
    }

    const companyId = profile.company_id;

    // 最新の分類確認状態を取り直す（画面の一時状態には頼らない）
    const { data: memoryRows, error: memoryError } = await supabase
      .from("wine_classification_memory")
      .select(
        "wine_id, country, region, subregion, appellation, climat, cru_level, category, is_confirmed, notes"
      )
      .eq("company_id", companyId)
      .in("wine_id", [reference.wineId, candidateWineId]);

    if (memoryError) {
      throw new Error(
        tUi("classificationFetchFailed", { error: memoryError.message })
      );
    }

    const memoryByWineId = new Map(
      (memoryRows || []).map((row: any) => [row.wine_id, row])
    );

    const refMemory = memoryByWineId.get(reference.wineId);
    const candMemory = memoryByWineId.get(candidateWineId);

    const refListing = wineListByWineId.get(reference.wineId);
    const candListing = wineListByWineId.get(candidateWineId);

    // --- Masterの自動選定（確認済み分類+3／手動価格+2／appellationあり+1／実キュヴェあり+1） ---
    const completenessScore = (
      memory: any,
      listing: WineListRow | undefined
    ) => {
      let s = 0;
      if (memory?.is_confirmed) s += 3;
      if (listing?.manual_price) s += 2;
      if ((memory?.appellation || "").trim()) s += 1;
      if (
        hasRealCuveeText(
          listing?.cuvee,
          memory?.appellation,
          memory?.climat
        )
      )
        s += 1;
      return s;
    };

    const masterIsCandidate =
      completenessScore(candMemory, candListing) >
      completenessScore(refMemory, refListing);

    const master = masterIsCandidate ? candidate : reference;
    const other = masterIsCandidate ? reference : candidate;
    const masterMemory = masterIsCandidate ? candMemory : refMemory;
    const otherMemory = masterIsCandidate ? refMemory : candMemory;
    const masterListing = masterIsCandidate ? candListing : refListing;
    const otherListing = masterIsCandidate ? refListing : candListing;

    if (!master.wineId || !other.wineId) {
      throw new Error(tUi("wineIdUnavailable"));
    }

    // --- 分類の競合チェック ---
    let resolvedClassification:
      | {
          country: string;
          region: string;
          subregion: string;
          appellation: string;
          climat: string;
          cru_level: string;
          category: string;
          notes: string;
        }
      | null = null;

    const masterConfirmed = Boolean(
      masterMemory?.is_confirmed
    );

    const otherConfirmed = Boolean(
      otherMemory?.is_confirmed
    );

    if (masterConfirmed && otherConfirmed) {
      /*
       * 両方とも人間確認済みの場合は、
       * Appellationだけでなく重要分類項目をすべて比較する。
       *
       * 空欄同士・片方だけ空欄は競合扱いにしない。
       * UNKNOWNも未確定値として競合判定から除外する。
       */
      const classificationConflicts: string[] = [];

      const compareTextField = (
        label: string,
        masterValue: unknown,
        otherValue: unknown
      ) => {
        const normalizedMaster =
          normalizeDuplicateKeyText(
            masterValue
          );

        const normalizedOther =
          normalizeDuplicateKeyText(
            otherValue
          );

        if (
          normalizedMaster &&
          normalizedOther &&
          normalizedMaster !== normalizedOther
        ) {
          classificationConflicts.push(
            `${label}: ${
              String(masterValue || "")
            } ↔ ${
              String(otherValue || "")
            }`
          );
        }
      };

      const compareEnumField = (
        label: string,
        masterValue: unknown,
        otherValue: unknown
      ) => {
        const normalizedMaster =
          String(masterValue || "")
            .trim()
            .toUpperCase();

        const normalizedOther =
          String(otherValue || "")
            .trim()
            .toUpperCase();

        if (
          normalizedMaster &&
          normalizedOther &&
          normalizedMaster !== "UNKNOWN" &&
          normalizedOther !== "UNKNOWN" &&
          normalizedMaster !== normalizedOther
        ) {
          classificationConflicts.push(
            `${label}: ${
              String(masterValue || "")
            } ↔ ${
              String(otherValue || "")
            }`
          );
        }
      };

      compareTextField(
        "Country",
        masterMemory.country,
        otherMemory.country
      );

      compareTextField(
        "Region",
        masterMemory.region,
        otherMemory.region
      );

      compareTextField(
        "Subregion",
        masterMemory.subregion,
        otherMemory.subregion
      );

      compareTextField(
        "Appellation",
        masterMemory.appellation,
        otherMemory.appellation
      );

      compareTextField(
        "Climat / Lieu-dit",
        masterMemory.climat,
        otherMemory.climat
      );

      compareEnumField(
        "Cru level",
        masterMemory.cru_level,
        otherMemory.cru_level
      );

      compareEnumField(
        "Category",
        masterMemory.category,
        otherMemory.category
      );

      if (
        classificationConflicts.length > 0
      ) {
        alert(
          tUi("mergeClassificationConflict", {
            conflicts: classificationConflicts.join("\n"),
          })
        );

        return;
      }

      /*
       * 確認済み分類同士に明確な矛盾が無いので、
       * Master側をそのまま維持する。
       */
    } else if (
      otherConfirmed &&
      !masterConfirmed
    ) {
      resolvedClassification = {
        country:
          otherMemory.country || "",

        region:
          otherMemory.region || "",

        subregion:
          otherMemory.subregion || "",

        appellation:
          otherMemory.appellation || "",

        climat:
          otherMemory.climat || "",

        cru_level:
          otherMemory.cru_level ||
          "UNKNOWN",

        category:
          otherMemory.category ||
          "UNKNOWN",

        notes:
          otherMemory.notes || "",
      };
    }

    /*
     * masterConfirmed && !otherConfirmed
     * → Masterの確認済み分類を維持。
     *
     * どちらも未確認
     * → 分類は書き換えず、
     *   後でAI判定・人間確認をやり直す。
     */

    // --- 価格・掲載の競合チェック（手動価格を優先する既存仕様を維持） ---
    let resolvedSalePrice: number | null | undefined;
    let resolvedManualPrice: boolean | undefined;
    let resolvedIsListed: boolean | undefined;

    const masterManual = Boolean(masterListing?.manual_price);
    const otherManual = Boolean(otherListing?.manual_price);

    if (masterManual && otherManual) {
      if (masterListing?.sale_price !== otherListing?.sale_price) {
        const keepOther = confirm(
          tUi("priceConflictPrompt", {
            masterProducer: master.producer,
            masterPrice: masterListing?.sale_price ?? tUi("priceNotSet"),
            otherProducer: other.producer,
            otherPrice: otherListing?.sale_price ?? tUi("priceNotSet"),
          })
        );

        if (keepOther) {
          resolvedSalePrice = otherListing?.sale_price ?? null;
          resolvedManualPrice = true;
        }
      }
    } else if (otherManual && !masterManual) {
      resolvedSalePrice = otherListing?.sale_price ?? null;
      resolvedManualPrice = true;
    }

    if (otherListing?.is_listed && !masterListing?.is_listed) {
      resolvedIsListed = true;
    }

    const summaryLines = [
      tUi("masterKeepLine", {
        producer: master.producer,
        vintage: master.vintage || "",
        wine: master.raw,
      }),
      tUi("mergedLine", {
        producer: other.producer,
        vintage: other.vintage || "",
        wine: other.raw,
      }),
      tUi("similarityLine", {
        similarity:
          confidence === "HIGH"
            ? tUi("duplicateHigh")
            : confidence === "MEDIUM"
              ? tUi("duplicateMedium")
              : tUi("duplicateLow"),
      }),
      resolvedClassification
        ? tUi("classificationInheritLine", {
            producer: other.producer,
            appellation: resolvedClassification.appellation,
          })
        : masterConfirmed
          ? tUi("classificationKeepLine")
          : tUi("classificationNoChangeLine"),
      resolvedSalePrice !== undefined
        ? tUi("priceAdoptLine", {
            price: resolvedSalePrice ?? tUi("priceNotSet"),
          })
        : tUi("priceKeepLine"),
    ];

    const proceed = confirm(
      tUi("mergeConfirm", { summary: summaryLines.join("\n") })
    );

    if (!proceed) {
      setMergeStatus("");
      return;
    }

    setMergeStatus(tUi("mergeRunning"));

    const { data: result, error: rpcError } = await supabase.rpc(
      "merge_wines",
      {
        p_company_id: companyId,
        p_from_wine_id: other.wineId,
        p_to_wine_id: master.wineId,
        p_reason: "duplicate",
        p_similarity: similarity,
        p_resolved_sale_price: resolvedSalePrice ?? null,
        p_resolved_manual_price: resolvedManualPrice ?? null,
        p_resolved_is_listed: resolvedIsListed ?? null,
        p_resolved_country: resolvedClassification?.country ?? null,
        p_resolved_region: resolvedClassification?.region ?? null,
        p_resolved_subregion: resolvedClassification?.subregion ?? null,
        p_resolved_appellation: resolvedClassification?.appellation ?? null,
        p_resolved_climat: resolvedClassification?.climat ?? null,
        p_resolved_cru_level: resolvedClassification?.cru_level ?? null,
        p_resolved_category: resolvedClassification?.category ?? null,
        p_resolved_notes: resolvedClassification?.notes ?? null,
      }
    );

    if (rpcError) {
      throw new Error(tUi("mergeRpcFailed", { error: rpcError.message }));
    }

    const resultRow = Array.isArray(result) ? result[0] : result;

    markDuplicateResolution(candidateWineId, "SAME");

    setMergeStatus(
      resultRow?.qty_ok
        ? tUi("mergeCompleteQty", { qty: resultRow.qty_to_after })
        : tUi("mergeQtyMismatch", {
            before:
              (resultRow?.qty_from_before ?? 0) +
              (resultRow?.qty_to_before ?? 0),
            after: resultRow?.qty_to_after ?? "?",
          })
    );

    await loadCloudInventory();
    await loadWineList();
  } catch (error: any) {
    console.error("ワイン統合エラー:", error);

    alert(
      tUi("mergeFailed", {
        error: error?.message || tApp("unknownError"),
      })
    );
  } finally {
    setMergingWineIds((prev) =>
      prev.filter((id) => id !== candidateWineId)
    );
  }
}

  function handleFiles(selectedFiles: File[]) {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    const nextPreviews = selectedFiles.map((file) => ({
      name: file.name,
      type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*"),
      url: URL.createObjectURL(file),
    }));
    setFiles(selectedFiles);
    setPreviews(nextPreviews);
    setSelectedPreview(nextPreviews[0] || null);
  }

  function saveLocal(show = true) {
    // company_id未確定の間はcompany固有localStorageを書き込まない
    // （company別キー分離が保証できないため）。
    const scopedKey = companyScopedStorageKey(
      "bon_pinard_ai_inventory_server",
      currentCompanyId
    );

    if (!scopedKey) {
      console.warn(
        "saveLocal: currentCompanyId未確定のためスキップしました。"
      );
      return;
    }

    localStorage.setItem(scopedKey, JSON.stringify({ header: { supplier, customer, invoiceNo, invoiceDate }, inventory }));
    saveMastersFromInventory(inventory, currentCompanyId);
    if (show) alert(tUi("savedAndMasterUpdated"));
  }

async function saveInvoiceToSupabase() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    alert(tApp("loginUserUnavailable"));
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    console.error("company_id取得失敗", profileError);
    alert(tApp("companyInfoUnavailable"));
    return;
  }

  const companyId = profile.company_id;

  const totalHT = inventory.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  // すでに同じ伝票番号があるか確認
  const { data: existingInvoices, error: existingError } = await supabase
    .from("purchase_invoices")
    .select("id")
    .eq("company_id", companyId)
    .eq("invoice_no", invoiceNo)
    .limit(1);

  if (existingError) {
    console.error("既存伝票確認失敗", existingError);
    alert(tUi("existingInvoiceCheckFailed"));
    return;
  }

  let invoiceId: string;

  if (existingInvoices && existingInvoices.length > 0) {
    invoiceId = existingInvoices[0].id;
    console.log("既存のpurchase_invoiceを使用:", invoiceId);
  } else {
    const { data: invoice, error: invoiceError } = await supabase
      .from("purchase_invoices")
      .insert({
        company_id: companyId,
        supplier_id: null,
        invoice_no: invoiceNo || null,
        invoice_date: invoiceDate || null,
        currency: "EUR",
        shipping_ht: 0,
        total_ht: totalHT,
        tva: 0,
        total_ttc: totalHT,
        ai_status: "CONFIRMED",
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      console.error("purchase_invoices保存失敗", invoiceError);
      alert(tUi("invoiceSaveFailed"));
      return;
    }

    invoiceId = invoice.id;
  }

  // 同じ伝票に明細がすでに保存されていないか確認
  const { data: existingItems, error: itemCheckError } = await supabase
    .from("purchase_items")
    .select("id")
    .eq("invoice_id", invoiceId)
    .limit(1);

  if (itemCheckError) {
    console.error("purchase_items確認失敗", itemCheckError);
    alert(tUi("itemCheckFailed"));
    return;
  }

  if (existingItems && existingItems.length > 0) {
    alert(tUi("invoiceAlreadySaved"));
    return;
  }

const wineIds: string[] = [];

for (const r of inventory) {
  const producerName = (r.producer || "UNKNOWN PRODUCER").trim();
  const wineName = (r.raw || r.cuvee || "UNKNOWN WINE").trim();
  const vintageValue = (r.vintage || "").trim();
  const bottleSize = Number(r.size || 75);

  /*
   * is_active=trueに限定する理由：
   * soft merge導入後、統合済み(is_active=false)のワインも
   * producer/wine_name/vintage/bottle_size_clの値自体は
   * そのまま残っている。ここでis_activeを見ないと、
   * 統合済みワインを「既存ワイン」として再利用してしまい、
   * 新しい仕入がそこへ紐付いて在庫が復活してしまう
   * （統合の意味が無くなる）。is_active=trueで見つからなければ
   * 下のelse節で新規ワインを作成する（＝正しい挙動）。
   *
   * 重要：このis_active条件は、修復migration
   * (20260906_repair_wine_merge_schema.sql)適用後の
   * wines.is_active列の存在を前提とする。
   * migration未適用の環境へこのコードだけ先に反映すると、
   * 列が存在せずクエリがエラーになり、伝票確定（仕入登録）が
   * 全滅する。必ずmigration適用と同じタイミング（または後）で
   * デプロイすること。
   */
  const { data: existingWines, error: wineSearchError } = await supabase
    .from("wines")
    .select("id")
    .eq("company_id", companyId)
    .eq("producer", producerName)
    .eq("wine_name", wineName)
    .eq("vintage", vintageValue)
    .eq("bottle_size_cl", bottleSize)
    .eq("is_active", true)
    .is("merged_into_wine_id", null)
    .limit(1);

  if (wineSearchError) {
    console.error("ワインマスター検索失敗", wineSearchError);
    alert(tUi("wineMasterSearchFailed"));
    return;
  }

  let wineId: string;

  if (existingWines && existingWines.length > 0) {
    wineId = existingWines[0].id;
  } else {
    const { data: newWine, error: wineInsertError } = await supabase
      .from("wines")
      .insert({
        company_id: companyId,
        producer: producerName,
        wine_name: wineName,
        cuvee: r.cuvee || null,
        color: r.color || null,
        vintage: vintageValue || null,
        bottle_size_cl: bottleSize,
        alcohol_percent: r.alcohol || null,
      })
      .select("id")
      .single();

    if (wineInsertError || !newWine) {
      console.error("ワインマスター登録失敗", wineInsertError);
      alert(tUi("wineMasterInsertFailed"));
      return;
    }

    wineId = newWine.id;
  }

  wineIds.push(wineId);
}
  const purchaseItems = inventory.map((r, index) => ({
    company_id: companyId,
    invoice_id: invoiceId,
    wine_id: wineIds[index],
    raw_name: r.raw || r.cuvee || "",
    quantity: Number(r.qty || 0),
    unit_price_ht: Number(r.unit || 0),
    amount_ht: Number(r.amount || 0),
    confidence: Number(r.confidence || 0),
    notes: r.memo || null,
  }));

  const { error: itemsError } = await supabase
    .from("purchase_items")
    .insert(purchaseItems);

 if (itemsError) {
  console.error("purchase_items保存失敗", itemsError);
  alert(tUi("purchaseItemsSaveFailed"));
  return;
}

// 在庫移動を登録
const stockMovements = inventory.map((r, index) => ({
  company_id: companyId,
  wine_id: wineIds[index],
  invoice_id: invoiceId,
  movement_type: "PURCHASE",
  quantity: Number(r.qty || 0),
  unit_cost_ht: Number(r.unit || 0),
  movement_date: invoiceDate || today(),
  notes: `Purchase invoice ${invoiceNo || ""}`,
}));

const { error: movementError } = await supabase
  .from("stock_movements")
  .insert(stockMovements);

if (movementError) {
  console.error("stock_movements保存失敗", movementError);
  alert(tUi("stockMovementSaveFailed"));
  return;
}

console.log("Supabase保存成功:", {
  invoiceId,
  items: purchaseItems.length,
});

await loadCloudInventory();

alert(
  tUi("supabaseSaved", {
    invoice: invoiceNo,
    items: purchaseItems.length,
  })
);
}
  async function analyze() {
    if (!files.length) { alert(tUi("selectPdfOrPhoto")); return; }
    setLoading(true);
    setStatus(tUi("aiJudging"));
    setWarnings([]);

    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));
    // マルチテナント対応：AIプロンプト側の「自社」をログイン中の
    // companyへ差し替えるため、company名を渡す（未指定時は
    // API側で"BON PINARD SAS"へfallbackする既存動作を維持）。
    fd.append("companyName", currentCompanyName || "");

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tUi("aiAnalysisFailed"));

      const parsed = data as AIResult;
      const nextSupplier = parsed.supplier || "UNKNOWN SUPPLIER";
      // AIが自社名を返さなかった場合のfallbackは、ハードコードした
      // 特定company名ではなく、ログイン中companyの実名を使う。
      const nextCustomer =
        parsed.customer || currentCompanyName || "";
      const nextInvoiceNo = parsed.invoice_no || "";
      const nextInvoiceDate = normalizeDate(parsed.invoice_date) || today();

      setSupplier(nextSupplier);
      setCustomer(nextCustomer);
      setInvoiceNo(nextInvoiceNo);
      setInvoiceDate(nextInvoiceDate);
      setWarnings(parsed.warnings || []);

      const newItems: Item[] = (parsed.items || []).map((x) => {
        const qty = Number(x.quantity_bottles || 0);
        const unit = Number(x.unit_price_ht || 0);
        const amount = Number(x.amount_ht || qty * unit || 0);
        const conf = Number(x.confidence || 0);
        return {
          status: conf < 0.85 ? "NEEDS_CHECK" : "CONFIRMED",
          date: nextInvoiceDate, invoiceNo: nextInvoiceNo, supplier: nextSupplier, customer: nextCustomer,
          producer: x.producer || "", cuvee: x.cuvee_or_appellation || "", raw: x.wine_name_raw || "",
          color: x.color || "", vintage: x.vintage || "", size: Number(x.bottle_size_cl || 75),
          alcohol: x.alcohol_percent || "", qty, unit, amount, confidence: conf, memo: x.notes || ""
        };
      });

      setInventory((prev) => {
  const duplicateWarnings = findDuplicateWarnings(prev, newItems, appLanguage);

  setTimeout(() => {
    // company_id未確定の間はcompany固有localStorageを書き込まない
    // （company別キー分離が保証できないため）。
    const scopedKey = companyScopedStorageKey(
      "bon_pinard_ai_inventory_server",
      currentCompanyId
    );

    if (scopedKey) {
      localStorage.setItem(
        scopedKey,
        JSON.stringify({
          header: {
            supplier: nextSupplier,
            customer: nextCustomer,
            invoiceNo: nextInvoiceNo,
            invoiceDate: nextInvoiceDate,
          },
          inventory: newItems,
        })
      );
    } else {
      console.warn(
        "analyze: currentCompanyId未確定のためlocalStorage保存をスキップしました。"
      );
    }

    saveMastersFromInventory(newItems, currentCompanyId);

    if (duplicateWarnings.length) {
      setWarnings([
        ...(parsed.warnings || []),
        ...duplicateWarnings,
      ]);
    }
  }, 0);

  return newItems;
});
      setStatus(tUi("itemsAutoRegistered", { total: newItems.length }));
    } catch (e: any) {
      setStatus(tUi("genericError", { error: e.message }));
    } finally {
      setLoading(false);
    }
  }

  function addRow() {
    setInventory([...inventory, {
      status: "MANUAL", date: invoiceDate, invoiceNo, supplier, customer,
      producer: "", cuvee: "", raw: "", color: "", vintage: "", size: 75, alcohol: "",
      qty: 1, unit: 0, amount: 0, confidence: 1, memo: ""
    }]);
  }

  function update(i: number, key: keyof Item, value: any) {
    const next = [...inventory];
    const numeric = ["size", "qty", "unit", "amount", "confidence"];
    const v = numeric.includes(key as string) ? Number(value || 0) : value;
    next[i] = { ...next[i], [key]: v };
    if (key === "qty" || key === "unit") next[i].amount = Math.round(Number(next[i].qty || 0) * Number(next[i].unit || 0) * 100) / 100;
    if (key === "confidence") next[i].status = Number(v) < 0.85 ? "NEEDS_CHECK" : "CONFIRMED";
    setInventory(next);
  }

  function removeRow(i: number) { setInventory(inventory.filter((_, idx) => idx !== i)); }

  function stockRows() {
    return inventory.map((r) => ({
      status: r.status === "CONFIRMED" ? tApp("statusConfirmed") : r.status === "NEEDS_CHECK" ? tApp("statusNeedsCheck") : tApp("statusManual"), date: r.date, invoiceNo: r.invoiceNo, supplier: r.supplier,
      customer: r.customer, producer: r.producer, cuvee: r.cuvee, wineNameRaw: r.raw,
      color: r.color, vintage: r.vintage, bottleSizeCl: r.size, alcohol: r.alcohol,
      quantity: r.qty, unitPriceHT: r.unit, amountHT: r.amount, currency: "EUR",
      confidence: r.confidence, memo: r.memo
    }));
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows()), tUi("stockSheetName"));
    XLSX.writeFile(wb, `${tUi("inventoryFileBase")}.xlsx`);
  }

  function exportCSV() {
    const ws = XLSX.utils.json_to_sheet(stockRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tUi("inventoryFileBase")}.csv`;
    a.click();
  }

  function exportMasters() {
    const supplierMasterKey = companyScopedStorageKey(
      "bon_pinard_supplier_master",
      currentCompanyId
    );
    const wineMasterKey = companyScopedStorageKey(
      "bon_pinard_wine_master",
      currentCompanyId
    );
    const priceHistoryKey = companyScopedStorageKey(
      "bon_pinard_price_history",
      currentCompanyId
    );

    const suppliers = supplierMasterKey
      ? Object.values(getStoredJson<Record<string, any>>(supplierMasterKey, {}))
      : [];
    const wines = wineMasterKey
      ? Object.values(getStoredJson<Record<string, any>>(wineMasterKey, {}))
      : [];
    const priceHistory = priceHistoryKey
      ? getStoredJson<any[]>(priceHistoryKey, [])
      : [];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers), tUi("supplierMasterSheet"));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wines), tUi("wineMasterSheet"));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priceHistory), tUi("priceHistorySheet"));
    XLSX.writeFile(wb, `${tUi("masterHistoryFileBase")}.xlsx`);
  }

  /*
   * ============================================================
   * Section 16「データバックアップ / エクスポート」
   *
   * 読み取り専用（SELECTのみ）。DBへのINSERT/UPDATE/DELETEは
   * 一切行わない。migration・RLS変更も不要で、既存のcompany_id
   * スコープのSELECT policyだけに依存する（owner/staff/viewer
   * いずれもこのSectionの全機能を実行できる。書き込みが無いため
   * roleによる出し分けは行わない）。
   *
   * Section 1のexportExcel/exportCSV（今回の伝票AI抽出結果のみが
   * 対象）とは目的が異なるため、それらの処理・出力内容には
   * 一切手を加えない。ここではDB(inventory_view/stock_movements)
   * から改めて取得した「会社の実在庫・全履歴」を対象にする。
   * ============================================================
   */

  /*
   * Section 16: ログインcompanyの現在庫をinventory_viewから取得する。
   * 必ず.eq("company_id", companyId)で絞り込み、他companyの行を
   * まとめて取得してからクライアント側でfilterする設計にはしない。
   */
  async function fetchSection16CurrentInventory(
    companyId: string
  ) {
    const { data, error } = await supabase
      .from("inventory_view")
      .select(
        "wine_id, company_id, producer, wine_name, cuvee, vintage, color, bottle_size_cl, alcohol_percent, current_quantity, avg_cost_ht"
      )
      .eq("company_id", companyId)
      .neq("current_quantity", 0);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((r: any) => {
      const quantity = Number(r.current_quantity || 0);
      const avgCostHt = Number(r.avg_cost_ht || 0);

      return {
        wineId: r.wine_id || "",
        companyId: r.company_id || "",
        producer: r.producer || "",
        wineName: r.wine_name || "",
        cuvee: r.cuvee || "",
        vintage: r.vintage || "",
        color: r.color || "",
        bottleSizeCl: Number(r.bottle_size_cl || 75),
        alcoholPercent: r.alcohol_percent || "",
        currentQuantity: quantity,
        avgCostHt,
        stockValueHt:
          Math.round(quantity * avgCostHt * 100) / 100,
      };
    });
  }

  const SECTION16_MOVEMENTS_PAGE_SIZE = 1000;
  const SECTION16_MOVEMENTS_MAX_PAGES = 200;

  /*
   * Section 16: ログインcompanyの在庫移動履歴を全件取得する。
   * PostgRESTの1リクエストあたりの上限を超えても取りこぼさないよう
   * .range()でページングするが、これは「同じ1つのクエリの続き」で
   * あり、行ごとに個別クエリを投げるN+1とは異なる。
   * ワイン名の解決も、移動件数ぶんの個別SELECTではなく、
   * companyのwinesテーブルへの1回のSELECTだけで行う。
   */
  async function fetchSection16StockMovements(
    companyId: string
  ) {
    const movements: any[] = [];

    for (
      let page = 0;
      page < SECTION16_MOVEMENTS_MAX_PAGES;
      page++
    ) {
      const offset = page * SECTION16_MOVEMENTS_PAGE_SIZE;

      const { data, error } = await supabase
        .from("stock_movements")
        .select(
          "id, wine_id, movement_type, quantity, unit_cost_ht, movement_date, invoice_id, notes"
        )
        .eq("company_id", companyId)
        .order("movement_date", { ascending: true })
        .order("id", { ascending: true })
        .range(
          offset,
          offset + SECTION16_MOVEMENTS_PAGE_SIZE - 1
        );

      if (error) {
        throw new Error(error.message);
      }

      const batch = data || [];
      movements.push(...batch);

      if (batch.length < SECTION16_MOVEMENTS_PAGE_SIZE) {
        break;
      }
    }

    const wineIds = Array.from(
      new Set(
        movements
          .map((m) => m.wine_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const wineLookup: Record<
      string,
      {
        producer: string;
        wineName: string;
        cuvee: string;
        vintage: string;
      }
    > = {};

    if (wineIds.length > 0) {
      const { data: wineRows, error: wineError } =
        await supabase
          .from("wines")
          .select("id, producer, wine_name, cuvee, vintage")
          .eq("company_id", companyId);

      if (wineError) {
        throw new Error(wineError.message);
      }

      (wineRows || []).forEach((w: any) => {
        wineLookup[w.id] = {
          producer: w.producer || "",
          wineName: w.wine_name || "",
          cuvee: w.cuvee || "",
          vintage: w.vintage || "",
        };
      });
    }

    return movements.map((m: any) => {
      const wine = wineLookup[m.wine_id] || {
        producer: "",
        wineName: "",
        cuvee: "",
        vintage: "",
      };

      return {
        movementDate: m.movement_date || "",
        movementType: m.movement_type || "",
        producer: wine.producer,
        wineName: wine.wineName,
        cuvee: wine.cuvee,
        vintage: wine.vintage,
        quantity: Number(m.quantity || 0),
        unitCostHt:
          m.unit_cost_ht === null ||
          m.unit_cost_ht === undefined
            ? null
            : Number(m.unit_cost_ht),
        reference: m.invoice_id || "",
        notes: m.notes || "",
        wineId: m.wine_id || "",
      };
    });
  }

  // Section 16: CURRENT_INVENTORY sheet用の行（wine_id/company_idは含めない）。
  function toSection16InventorySheetRow(r: any) {
    return {
      Producer: r.producer,
      Wine: r.wineName,
      "Cuvée": r.cuvee,
      Vintage: r.vintage,
      Color: r.color,
      "Bottle Size": r.bottleSizeCl,
      Alcohol: r.alcoholPercent,
      "Current Quantity": r.currentQuantity,
      "Average Cost HT": r.avgCostHt,
      "Stock Value HT": r.stockValueHt,
    };
  }

  // Section 16: TECHNICAL_IDS sheet用の行（wine_id/company_idはここへ分離）。
  function toSection16TechnicalIdRow(r: any) {
    return {
      "Wine ID": r.wineId,
      "Company ID": r.companyId,
      Producer: r.producer,
      Wine: r.wineName,
      "Cuvée": r.cuvee,
      Vintage: r.vintage,
    };
  }

  // Section 16: STOCK_MOVEMENTS sheet用の行。
  function toSection16MovementSheetRow(r: any) {
    return {
      "Movement Date": r.movementDate,
      "Movement Type": r.movementType,
      Producer: r.producer,
      Wine: r.wineName,
      "Cuvée": r.cuvee,
      Vintage: r.vintage,
      Quantity: r.quantity,
      "Unit Cost HT": r.unitCostHt,
      Reference: r.reference,
      Notes: r.notes,
      "Wine ID": r.wineId,
    };
  }

  /*
   * Section 16「現在庫Excel」ボタン。
   * inventory_view単体のExcel（CURRENT_INVENTORY + TECHNICAL_IDS）を出力する。
   */
  async function handleExportCurrentInventoryExcel() {
    if (exportRunning) return;
    setExportRunning("inventory_excel");

    try {
      let companyId: string;
      try {
        companyId = await getCurrentCompanyIdForInventory();
      } catch {
        alert(tUi("exportCompanyMissing"));
        return;
      }

      let rows;
      try {
        rows = await fetchSection16CurrentInventory(companyId);
      } catch (error: any) {
        alert(
          tUi("exportInventoryFetchFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      if (rows.length === 0) {
        alert(tUi("exportNoInventoryData"));
        return;
      }

      const filenameBase =
        sanitizeExportFilenameSegment(
          currentCompanyName || ""
        ) || "BON_PINARD";

      try {
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            rows.map(toSection16InventorySheetRow)
          ),
          "CURRENT_INVENTORY"
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            rows.map(toSection16TechnicalIdRow)
          ),
          "TECHNICAL_IDS"
        );

        XLSX.writeFile(
          wb,
          `${filenameBase}_inventory_${today()}.xlsx`
        );
      } catch (error: any) {
        alert(
          tUi("exportBuildFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      alert(
        tUi("exportInventorySuccess", {
          count: rows.length,
        })
      );
    } finally {
      setExportRunning(null);
    }
  }

  /*
   * Section 16「現在庫CSV」ボタン。
   * Excelで開いた際にフランス語/日本語が文字化けしないよう、
   * UTF-8 BOMを先頭に付与する。
   */
  async function handleExportCurrentInventoryCsv() {
    if (exportRunning) return;
    setExportRunning("inventory_csv");

    try {
      let companyId: string;
      try {
        companyId = await getCurrentCompanyIdForInventory();
      } catch {
        alert(tUi("exportCompanyMissing"));
        return;
      }

      let rows;
      try {
        rows = await fetchSection16CurrentInventory(companyId);
      } catch (error: any) {
        alert(
          tUi("exportInventoryFetchFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      if (rows.length === 0) {
        alert(tUi("exportNoInventoryData"));
        return;
      }

      const filenameBase =
        sanitizeExportFilenameSegment(
          currentCompanyName || ""
        ) || "BON_PINARD";

      try {
        const ws = XLSX.utils.json_to_sheet(
          rows.map(toSection16InventorySheetRow)
        );
        // UTF-8 BOMを先頭に付与し、Excelで開いた際に
        // フランス語/日本語が文字化けしないようにする。
        // ソースコード中に見えないBOM文字をそのまま埋め込むのを
        // 避けるため、String.fromCharCode(0xFEFF)で明示する。
        const csv =
          String.fromCharCode(0xfeff) +
          XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], {
          type: "text/csv;charset=utf-8",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${filenameBase}_inventory_${today()}.csv`;
        a.click();
      } catch (error: any) {
        alert(
          tUi("exportBuildFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      alert(
        tUi("exportInventoryCsvSuccess", {
          count: rows.length,
        })
      );
    } finally {
      setExportRunning(null);
    }
  }

  /*
   * Section 16「完全バックアップExcel」ボタン。
   * CURRENT_INVENTORY / STOCK_MOVEMENTS / SUMMARY / TECHNICAL_IDS の
   * 4シート構成で1つのxlsxにまとめる。
   */
  async function handleExportFullBackupExcel() {
    if (exportRunning) return;
    setExportRunning("full_backup");

    try {
      let companyId: string;
      try {
        companyId = await getCurrentCompanyIdForInventory();
      } catch {
        alert(tUi("exportCompanyMissing"));
        return;
      }

      let inventoryRows;
      try {
        inventoryRows =
          await fetchSection16CurrentInventory(companyId);
      } catch (error: any) {
        alert(
          tUi("exportInventoryFetchFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      let movementRows;
      try {
        movementRows = await fetchSection16StockMovements(
          companyId
        );
      } catch (error: any) {
        alert(
          tUi("exportMovementsFetchFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      if (
        inventoryRows.length === 0 &&
        movementRows.length === 0
      ) {
        alert(tUi("exportNoInventoryData"));
        return;
      }

      const filenameBase =
        sanitizeExportFilenameSegment(
          currentCompanyName || ""
        ) || "BON_PINARD";

      try {
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            inventoryRows.map(toSection16InventorySheetRow)
          ),
          "CURRENT_INVENTORY"
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            movementRows.map(toSection16MovementSheetRow)
          ),
          "STOCK_MOVEMENTS"
        );

        const totalBottles = inventoryRows.reduce(
          (sum, r) => sum + r.currentQuantity,
          0
        );
        const totalStockValueHt =
          Math.round(
            inventoryRows.reduce(
              (sum, r) => sum + r.stockValueHt,
              0
            ) * 100
          ) / 100;

        const summaryRows = [
          {
            Field: "Company",
            Value: currentCompanyName || "",
          },
          {
            Field: "Export date/time",
            Value: new Date().toISOString(),
          },
          {
            Field: "Wine types count",
            Value: inventoryRows.length,
          },
          {
            Field: "Total bottles",
            Value: totalBottles,
          },
          {
            Field: "Total stock value HT",
            Value: totalStockValueHt,
          },
          {
            Field: "Movement count",
            Value: movementRows.length,
          },
        ];

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(summaryRows),
          "SUMMARY"
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            inventoryRows.map(toSection16TechnicalIdRow)
          ),
          "TECHNICAL_IDS"
        );

        XLSX.writeFile(
          wb,
          `${filenameBase}_full_backup_${today()}.xlsx`
        );
      } catch (error: any) {
        alert(
          tUi("exportBuildFailed", {
            error: error?.message || String(error),
          })
        );
        return;
      }

      alert(
        tUi("exportFullBackupSuccess", {
          inventoryCount: inventoryRows.length,
          movementCount: movementRows.length,
        })
      );
    } finally {
      setExportRunning(null);
    }
  }

  /*
   * ============================================================
   * Section 17「在庫アラート / 補充候補」
   *
   * 読み取りは wines(active/unmerged) / inventory_view /
   * wine_stock_alert_settings の3クエリをPromise.allで並列取得し、
   * クライアント側でwine_idをキーにLEFT JOIN相当でmergeする
   * （N+1にはならない）。wines を母体にすることで、inventory_view に
   * 万一行が無い wine も current_quantity=0 として安全に扱う。
   *
   * 書き込みは wine_stock_alert_settings への INSERT/UPDATE のみ。
   * 在庫数量・stock_movements・wine_list_settings・
   * wine_classification_memory には一切書き込まない。
   *
   * settings行が無い(NOT_SET)、またはalert_enabled=false(OFF)の
   * wineは、OUT_OF_STOCK/LOW_STOCKのどちらにもならない
   * （新規顧客の全wineがいきなり警告状態になるのを防ぐため）。
   * ============================================================
   */

  function computeStockAlertStatus(
    hasSettings: boolean,
    alertEnabled: boolean,
    minQuantity: number,
    currentQuantity: number
  ): StockAlertStatus {
    if (!hasSettings) return "NOT_SET";
    if (!alertEnabled) return "OFF";
    if (currentQuantity <= 0) return "OUT_OF_STOCK";
    if (currentQuantity <= minQuantity) return "LOW_STOCK";
    return "OK";
  }

  // target_quantity未設定、またはalert無効時はnull（「未設定」表示）。
  // min_quantityとの差を代わりのrecommended orderとして使わない。
  function computeRecommendedOrderQuantity(
    hasSettings: boolean,
    alertEnabled: boolean,
    targetQuantity: number | null,
    currentQuantity: number
  ): number | null {
    if (!hasSettings || !alertEnabled) return null;
    if (targetQuantity === null) return null;
    return Math.max(targetQuantity - currentQuantity, 0);
  }

  async function loadStockAlertData() {
    if (stockAlertLoading) return;

    setStockAlertLoading(true);
    setStockAlertLoadError("");

    try {
      let companyId: string;
      try {
        companyId = await getCurrentCompanyIdForInventory();
      } catch {
        setStockAlertLoadError(tUi("alertCompanyMissing"));
        return;
      }

      // 必ずcompany_idで絞り込んだ3クエリのみ。他companyを含めて
      // 取得してからクライアント側でfilterする設計にはしない。
      const [
        winesResult,
        inventoryResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from("wines")
          .select("id, producer, wine_name, cuvee, vintage")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .is("merged_into_wine_id", null),

        supabase
          .from("inventory_view")
          .select("wine_id, current_quantity")
          .eq("company_id", companyId),

        supabase
          .from("wine_stock_alert_settings")
          .select(
            "wine_id, min_quantity, target_quantity, alert_enabled"
          )
          .eq("company_id", companyId),
      ]);

      if (winesResult.error) {
        setStockAlertLoadError(
          tUi("alertWinesFetchFailed", {
            error: winesResult.error.message,
          })
        );
        return;
      }

      if (inventoryResult.error) {
        setStockAlertLoadError(
          tUi("alertInventoryFetchFailed", {
            error: inventoryResult.error.message,
          })
        );
        return;
      }

      if (settingsResult.error) {
        setStockAlertLoadError(
          tUi("alertSettingsFetchFailed", {
            error: settingsResult.error.message,
          })
        );
        return;
      }

      const inventoryMap: Record<string, number> = {};
      (inventoryResult.data || []).forEach((r: any) => {
        inventoryMap[r.wine_id] = Number(
          r.current_quantity || 0
        );
      });

      const settingsMap: Record<
        string,
        {
          minQuantity: number;
          targetQuantity: number | null;
          alertEnabled: boolean;
        }
      > = {};

      (settingsResult.data || []).forEach((r: any) => {
        settingsMap[r.wine_id] = {
          minQuantity: Number(r.min_quantity || 0),
          targetQuantity:
            r.target_quantity === null ||
            r.target_quantity === undefined
              ? null
              : Number(r.target_quantity),
          alertEnabled: Boolean(r.alert_enabled),
        };
      });

      // winesを母体にする＝inventory_viewに行が無いwineも
      // current_quantity=0として必ず一覧に含める。
      const rows: StockAlertRow[] = (
        winesResult.data || []
      ).map((w: any) => {
        const currentQuantity = inventoryMap[w.id] ?? 0;
        const settings = settingsMap[w.id];
        const hasSettings = Boolean(settings);
        const minQuantity = settings?.minQuantity ?? 0;
        const targetQuantity =
          settings?.targetQuantity ?? null;
        const alertEnabled =
          settings?.alertEnabled ?? false;

        return {
          wineId: w.id,
          producer: w.producer || "",
          wineName: w.wine_name || "",
          cuvee: w.cuvee || "",
          vintage: w.vintage || "",
          currentQuantity,
          hasSettings,
          minQuantity,
          targetQuantity,
          alertEnabled,
          status: computeStockAlertStatus(
            hasSettings,
            alertEnabled,
            minQuantity,
            currentQuantity
          ),
          recommendedOrderQuantity:
            computeRecommendedOrderQuantity(
              hasSettings,
              alertEnabled,
              targetQuantity,
              currentQuantity
            ),
        };
      });

      setStockAlertRows(rows);

      const drafts: Record<string, StockAlertDraft> = {};
      rows.forEach((row) => {
        drafts[row.wineId] = {
          minQuantity: String(row.minQuantity),
          targetQuantity:
            row.targetQuantity === null
              ? ""
              : String(row.targetQuantity),
          alertEnabled: row.alertEnabled,
        };
      });
      setStockAlertDrafts(drafts);
      setStockAlertLoaded(true);
    } finally {
      setStockAlertLoading(false);
    }
  }

  function updateStockAlertDraft(
    wineId: string,
    patch: Partial<StockAlertDraft>
  ) {
    setStockAlertDrafts((prev) => ({
      ...prev,
      [wineId]: {
        ...(prev[wineId] || {
          minQuantity: "0",
          targetQuantity: "",
          alertEnabled: false,
        }),
        ...patch,
      },
    }));
  }

  /*
   * サマリーカードのクリック/キーボード操作用。
   * 既存のプルダウン(stockAlertFilter)と同じstateをそのまま切り替える
   * （カード専用のstateは作らない）ため、プルダウン表示も
   * 自動的に連動する。同じカードを再クリックした場合は"ALL"へ戻す
   * （read-onlyの表示切り替えのみなので、viewerでも常に操作可）。
   */
  function toggleStockAlertFilter(
    value: typeof stockAlertFilter
  ) {
    setStockAlertFilter((prev) =>
      prev === value ? "ALL" : value
    );
  }

  /*
   * settings行がまだ無いwine(hasSettings=false)はINSERT、
   * 既にある場合はUPDATEする。company_id/wine_id/min_quantity/
   * target_quantity/alert_enabled/updated_atは必ず明示的に指定する
   * （created_atはDB default(now())に任せてよい＝INSERT時は送らない）。
   * alert_enabled=falseで保存した場合も、入力済みの閾値はそのまま
   * 保持する（DELETEはしない。止めたい場合はalert_enabled=false）。
   */
  async function saveStockAlertSetting(row: StockAlertRow) {
    if (isViewerRole) {
      alert(tUi("viewerReadOnlyAction"));
      return;
    }

    if (stockAlertSavingWineId) return;

    const draft =
      stockAlertDrafts[row.wineId] || {
        minQuantity: "0",
        targetQuantity: "",
        alertEnabled: false,
      };

    const minQuantity = Number(draft.minQuantity);

    if (
      draft.minQuantity.trim() === "" ||
      !Number.isFinite(minQuantity) ||
      minQuantity < 0
    ) {
      alert(tUi("alertInvalidMinQuantity"));
      return;
    }

    let targetQuantity: number | null = null;

    if (draft.targetQuantity.trim() !== "") {
      const parsedTarget = Number(draft.targetQuantity);

      if (
        !Number.isFinite(parsedTarget) ||
        parsedTarget < 0
      ) {
        alert(tUi("alertInvalidTargetQuantity"));
        return;
      }

      targetQuantity = parsedTarget;
    }

    if (
      targetQuantity !== null &&
      targetQuantity < minQuantity
    ) {
      alert(tUi("alertTargetLessThanMin"));
      return;
    }

    setStockAlertSavingWineId(row.wineId);

    try {
      let companyId: string;
      try {
        companyId = await getCurrentCompanyIdForInventory();
      } catch {
        alert(tUi("alertCompanyMissing"));
        return;
      }

      const nowIso = new Date().toISOString();

      if (row.hasSettings) {
        const { error } = await supabase
          .from("wine_stock_alert_settings")
          .update({
            min_quantity: minQuantity,
            target_quantity: targetQuantity,
            alert_enabled: draft.alertEnabled,
            updated_at: nowIso,
          })
          .eq("company_id", companyId)
          .eq("wine_id", row.wineId);

        if (error) {
          alert(
            tUi("alertSaveFailed", {
              error: error.message,
            })
          );
          return;
        }
      } else {
        const { error } = await supabase
          .from("wine_stock_alert_settings")
          .insert({
            company_id: companyId,
            wine_id: row.wineId,
            min_quantity: minQuantity,
            target_quantity: targetQuantity,
            alert_enabled: draft.alertEnabled,
            updated_at: nowIso,
          });

        if (error) {
          alert(
            tUi("alertSaveFailed", {
              error: error.message,
            })
          );
          return;
        }
      }

      setStockAlertRows((prev) =>
        prev.map((r) => {
          if (r.wineId !== row.wineId) return r;

          const hasSettings = true;
          const alertEnabled = draft.alertEnabled;

          return {
            ...r,
            hasSettings,
            minQuantity,
            targetQuantity,
            alertEnabled,
            status: computeStockAlertStatus(
              hasSettings,
              alertEnabled,
              minQuantity,
              r.currentQuantity
            ),
            recommendedOrderQuantity:
              computeRecommendedOrderQuantity(
                hasSettings,
                alertEnabled,
                targetQuantity,
                r.currentQuantity
              ),
          };
        })
      );

      alert(
        tUi("alertSaveSuccess", {
          producer: row.producer,
          vintage: row.vintage,
        })
      );
    } finally {
      setStockAlertSavingWineId(null);
    }
  }

  function getStockAlertStatusLabel(
    status: StockAlertStatus
  ): string {
    if (status === "OUT_OF_STOCK") {
      return tUi("alertStatusOutOfStock");
    }
    if (status === "LOW_STOCK") {
      return tUi("alertStatusLowStock");
    }
    if (status === "OK") {
      return tUi("alertStatusOk");
    }
    if (status === "OFF") {
      return tUi("alertStatusOff");
    }
    return tUi("alertStatusNotSet");
  }

  const totalQty = inventory.reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalHT = inventory.reduce((s, r) => s + Number(r.amount || 0), 0);
  const needsCheck = inventory.filter((r) => r.status === "NEEDS_CHECK").length;
  const allInventoryQty = allInventory.reduce(
  (s, r) => s + Number(r.qty || 0),
  0
);

const allInventoryHT = allInventory.reduce(
  (s, r) =>
    s + Number(r.qty || 0) * Number(r.unit || 0),
  0
);
/*
 * Section 17: 検索（Section 4/8と同じAND検索方式を再利用）と
 * フィルターの適用。判定ロジック自体（status/recommendedOrderQuantity）
 * はloadStockAlertData()側で計算済みのものをそのまま使う。
 */
const stockAlertSearchTokens = normalizeSoldBottleText(
  stockAlertSearch
)
  .split(" ")
  .filter(Boolean);

const filteredStockAlertRows = stockAlertRows.filter(
  (row) => {
    if (stockAlertSearchTokens.length > 0) {
      const searchableText = normalizeSoldBottleText(
        [
          row.producer,
          row.cuvee,
          row.wineName,
          row.vintage,
        ].join(" ")
      );

      const matchesSearch = stockAlertSearchTokens.every(
        (token) => searchableText.includes(token)
      );

      if (!matchesSearch) return false;
    }

    if (stockAlertFilter === "ALL") return true;

    if (stockAlertFilter === "NEEDS_ACTION") {
      return (
        row.status === "OUT_OF_STOCK" ||
        row.status === "LOW_STOCK"
      );
    }

    // 「未設定」フィルターはNOT_SET/OFFの両方をまとめて含む
    // （Section 17.7のフィルター一覧には「未設定」しか無く、
    // OFF専用の絞り込みは別途一覧のbadgeで見分ける）。
    if (stockAlertFilter === "NOT_SET") {
      return (
        row.status === "NOT_SET" ||
        row.status === "OFF"
      );
    }

    // 「アラート設定済み」カード用：alert_enabled=trueのwineすべて
    // （OUT_OF_STOCK/LOW_STOCK/OKを問わず含む）。
    if (stockAlertFilter === "ALERT_ENABLED") {
      return row.alertEnabled;
    }

    // 「発注候補本数」カード用：recommendedOrderQuantityが
    // null/0のwineは含めない。
    if (stockAlertFilter === "REORDER") {
      return (
        row.recommendedOrderQuantity !== null &&
        row.recommendedOrderQuantity > 0
      );
    }

    return row.status === stockAlertFilter;
  }
).sort((a, b) =>
  `${a.producer} ${a.cuvee} ${a.vintage}`.localeCompare(
    `${b.producer} ${b.cuvee} ${b.vintage}`
  )
);

const stockAlertSummary = {
  outOfStock: stockAlertRows.filter(
    (r) => r.status === "OUT_OF_STOCK"
  ).length,
  lowStock: stockAlertRows.filter(
    (r) => r.status === "LOW_STOCK"
  ).length,
  configured: stockAlertRows.filter(
    (r) => r.hasSettings && r.alertEnabled
  ).length,
  recommendedOrderTotal: stockAlertRows.reduce(
    (sum, r) => sum + (r.recommendedOrderQuantity || 0),
    0
  ),
};

/*
 * 複数単語のAND検索。アクセント・大文字小文字・記号を正規化する。
 * producer / wine_name(raw) / cuvee / vintage / color / bottle sizeを対象にする。
 */
const inventorySearchTokens =
  normalizeSoldBottleText(inventorySearch)
    .split(" ")
    .filter(Boolean);

const filteredAllInventory = allInventory
  .filter((r) => {
    if (inventorySearchTokens.length === 0) {
      return true;
    }

    const searchableText =
      normalizeSoldBottleText(
        [
          r.producer,
          r.cuvee,
          r.raw,
          r.vintage,
          r.color,
          r.size,
          "cl",
        ].join(" ")
      );

    return inventorySearchTokens.every(
      (token) =>
        searchableText.includes(token)
    );
  })
  .sort((a, b) =>
    `${a.producer} ${a.cuvee} ${a.vintage}`.localeCompare(
      `${b.producer} ${b.cuvee} ${b.vintage}`
    )
  );

/*
 * Section 5「キュヴェ名補完（AI）」専用の対象集合。
 *
 * allInventory（＝Section 4の「0在庫も表示」トグルの影響を直接受ける
 * 共有state）をそのまま使うと、トグルON時に0在庫wineまでAI抽出対象へ
 * 入ってしまう。Section 5は常にcurrent_quantity>0のwineだけを対象と
 * するため、filteredAllInventory（検索のみ適用）へさらに
 * qty>0のfilterを重ねたこの集合を、AI抽出処理(targetWines)・
 * 件数表示(cuveeExtractButtonのtotal)の両方で共通して使う
 * （表示件数と実際の処理対象がズレないようにするため）。
 * showZeroStockInventory自体は参照しない
 * （ON/OFFどちらでもこの集合は常にqty>0のみ）。
 */
const section5TargetInventory = filteredAllInventory.filter(
  (r) => Number(r.qty || 0) > 0
);

/*
 * 現在庫一覧（Section 4下部）専用の表示リスト。
 *
 * filteredAllInventory（検索のみ）はそのまま維持し、
 * ここでは在庫フィルター・並び替えだけを追加で適用する。
 * こうすることで、キュヴェAI抽出の対象件数は
 * 在庫フィルター/並び替えの影響を受けない。
 */
const stockFilteredInventoryList = filteredAllInventory
  .filter((r) => {
    const qty = Number(r.qty || 0);

    if (inventoryStockFilter === "IN_STOCK") {
      return qty > 0;
    }

    if (inventoryStockFilter === "ZERO") {
      return qty === 0;
    }

    if (inventoryStockFilter === "ONE") {
      return qty === 1;
    }

    if (inventoryStockFilter === "TWO_OR_FEWER") {
      return qty <= 2;
    }

    return true;
  });

const isInventoryStocktakeChecked = (r: Item) =>
  Boolean(
    r.wineId &&
      stocktakeCheckedAtByWineId[r.wineId] !== undefined
  );

/*
 * Section 4「未確認 / 確認済み」件数。
 * 検索・0在庫表示・在庫状態フィルター適用後、
 * 「確認済みを非表示」適用前の対象集合で数える
 * （非表示ONでも確認済み件数が0にならないようにするため）。
 */
const inventoryStocktakeCheckedCount =
  stockFilteredInventoryList.filter(
    isInventoryStocktakeChecked
  ).length;

const inventoryStocktakeUncheckedCount =
  stockFilteredInventoryList.length -
  inventoryStocktakeCheckedCount;

const displayedInventoryList = stockFilteredInventoryList
  .filter(
    (r) =>
      !hideCheckedInventory ||
      !isInventoryStocktakeChecked(r)
  )
  .slice()
  .sort((a, b) => {
    if (inventorySortMode === "QTY_ASC") {
      return (
        Number(a.qty || 0) -
        Number(b.qty || 0)
      );
    }

    if (inventorySortMode === "QTY_DESC") {
      return (
        Number(b.qty || 0) -
        Number(a.qty || 0)
      );
    }

    if (inventorySortMode === "COST_ASC") {
      return (
        Number(a.unit || 0) -
        Number(b.unit || 0)
      );
    }

    if (inventorySortMode === "COST_DESC") {
      return (
        Number(b.unit || 0) -
        Number(a.unit || 0)
      );
    }

    if (
      inventorySortMode === "VINTAGE_DESC" ||
      inventorySortMode === "VINTAGE_ASC"
    ) {
      const vintageA = parseVintageYear(
        a.vintage
      );

      const vintageB = parseVintageYear(
        b.vintage
      );

      /*
       * NVや空欄は新旧どちらの並びでも常に最後。
       */
      if (
        vintageA === null &&
        vintageB !== null
      ) {
        return 1;
      }

      if (
        vintageA !== null &&
        vintageB === null
      ) {
        return -1;
      }

      if (
        vintageA !== null &&
        vintageB !== null &&
        vintageA !== vintageB
      ) {
        return inventorySortMode ===
          "VINTAGE_DESC"
          ? vintageB - vintageA
          : vintageA - vintageB;
      }

      return `${a.producer} ${a.cuvee}`.localeCompare(
        `${b.producer} ${b.cuvee}`
      );
    }

    return `${a.producer} ${a.cuvee} ${a.vintage}`.localeCompare(
      `${b.producer} ${b.cuvee} ${b.vintage}`
    );
  });

/*
 * Section 9「在庫移動履歴」用の派生データ。
 * 読み込み済みのstockMovements全体から
 * 検索・filter・二重取消判定・本日集計を計算する。
 * ここではSupabaseへの書き込みは一切行わない。
 */
const stockMovementById = new Map<
  string,
  StockMovementRow
>();

stockMovements.forEach((m) => {
  stockMovementById.set(m.id, m);
});

const reversedMovementIds = new Set<string>();

stockMovements.forEach((m) => {
  if (m.movement_type === "REVERSAL" && m.notes) {
    const match = /^REVERSAL_OF:([0-9a-fA-F-]+)/.exec(
      m.notes
    );

    if (match) {
      reversedMovementIds.add(match[1]);
    }
  }
});

function getReversalOriginalId(
  notes: string | null
): string | null {
  if (!notes) return null;

  const match = /^REVERSAL_OF:([0-9a-fA-F-]+)/.exec(
    notes
  );

  return match ? match[1] : null;
}

const todaysDateForHistory = today();

function getStockMovementTypeLabelKey(
  movementType: string
): ExtraUiI18nKey {
  if (movementType === "PURCHASE") {
    return "stockMovementPurchase";
  }
  if (movementType === "SALE") {
    return "stockMovementSale";
  }
  if (movementType === "ADJUSTMENT") {
    return "stockMovementAdjustment";
  }
  return "stockMovementReversal";
}

function getStockMovementBadgeClass(
  movementType: string
): string {
  if (movementType === "PURCHASE") {
    return "bg-blue-100 text-blue-700";
  }
  if (movementType === "SALE") {
    return "bg-stone-200 text-stone-700";
  }
  if (movementType === "ADJUSTMENT") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-purple-100 text-purple-700";
}

// Section 17: 在庫アラート状態のbadge色。
function getStockAlertStatusBadgeClass(
  status: StockAlertStatus
): string {
  if (status === "OUT_OF_STOCK") {
    return "bg-red-100 text-red-700";
  }
  if (status === "LOW_STOCK") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "OK") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "OFF") {
    return "bg-stone-200 text-stone-500";
  }
  return "bg-stone-100 text-stone-400"; // NOT_SET
}

/*
 * Section 17: サマリーカード（在庫切れ/残りわずか/アラート設定済み/
 * 発注候補本数）のクリック可能フィルターボタン用class。
 * 選択中は同系色のborder強調+ringのみで、色相そのものは変えない。
 */
function stockAlertCardButtonClass(
  color: "red" | "amber" | "stone" | "emerald",
  isActive: boolean
): string {
  const base: Record<string, string> = {
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    stone: "border-stone-200 bg-stone-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  const active: Record<string, string> = {
    red: "border-red-400 ring-2 ring-red-300",
    amber: "border-amber-400 ring-2 ring-amber-300",
    stone: "border-stone-400 ring-2 ring-stone-300",
    emerald: "border-emerald-400 ring-2 ring-emerald-300",
  };

  return (
    "w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " +
    base[color] +
    (isActive ? " " + active[color] : "")
  );
}

/*
 * REVERSAL行の「何を取り消したか」を人間向けに整形する。
 *
 * DB(stock_movements.notes)には引き続き
 * "REVERSAL_OF:<uuid> | <元notes>" をそのまま保存する
 * （二重取消防止の判定に使うため変更しない）。
 * ここでは画面表示用の文字列だけを作る。
 *
 * 元movementが見つからない場合（過去データ・取得件数制限などで
 * 一覧に無い場合）は、汎用メッセージにフォールバックする。
 */
function getReversalDescription(
  original: StockMovementRow | null | undefined
): string {
  if (!original) {
    return tUi("stockHistoryReversalGeneric");
  }

  const qty =
    original.quantity > 0
      ? `+${original.quantity}`
      : `${original.quantity}`;

  if (original.movement_type === "SALE") {
    return tUi(
      "stockHistoryReversalOfSale",
      { qty }
    );
  }

  if (original.movement_type === "ADJUSTMENT") {
    return tUi(
      "stockHistoryReversalOfAdjustment",
      { qty }
    );
  }

  return tUi("stockHistoryReversalGeneric");
}

function passesStockHistoryDateFilter(
  dateStr: string
): boolean {
  if (stockHistoryDateFilter === "ALL") {
    return true;
  }

  if (stockHistoryDateFilter === "TODAY") {
    return dateStr === todaysDateForHistory;
  }

  const days =
    stockHistoryDateFilter === "7D" ? 7 : 30;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff
    .toISOString()
    .slice(0, 10);

  return dateStr >= cutoffStr;
}

const stockHistorySearchTokens =
  normalizeSoldBottleText(stockHistorySearch)
    .split(" ")
    .filter(Boolean);

const filteredStockMovements = stockMovements.filter(
  (m) => {
    if (
      stockHistoryTypeFilter !== "ALL" &&
      m.movement_type !== stockHistoryTypeFilter
    ) {
      return false;
    }

    if (
      !passesStockHistoryDateFilter(
        m.movement_date
      )
    ) {
      return false;
    }

    if (stockHistorySearchTokens.length > 0) {
      const info =
        wineLookupForHistory[m.wine_id];

      const searchableText =
        normalizeSoldBottleText(
          [
            info?.producer,
            info?.wineName,
            info?.cuvee,
            info?.vintage,
            m.notes,
          ].join(" ")
        );

      const matchesAll =
        stockHistorySearchTokens.every(
          (token) =>
            searchableText.includes(token)
        );

      if (!matchesAll) return false;
    }

    return true;
  }
);

/*
 * 本日の集計（読み込み済みの範囲内で計算する補助表示）。
 */
const todaySalesQty = stockMovements
  .filter(
    (m) =>
      m.movement_type === "SALE" &&
      m.movement_date === todaysDateForHistory
  )
  .reduce(
    (sum, m) =>
      sum + Math.abs(Number(m.quantity || 0)),
    0
  );

const todayAdjustmentsQty = stockMovements
  .filter(
    (m) =>
      m.movement_type === "ADJUSTMENT" &&
      m.movement_date === todaysDateForHistory
  )
  .reduce(
    (sum, m) => sum + Number(m.quantity || 0),
    0
  );

const todayReversalsCount = stockMovements.filter(
  (m) =>
    m.movement_type === "REVERSAL" &&
    m.movement_date === todaysDateForHistory
).length;

/*
 * Section 10「初期在庫インポート」プレビュー一覧の検索・filter。
 * ここではSupabaseへの書き込みは一切行わない（表示用の絞り込みのみ）。
 */
const importSearchTokens = normalizeSoldBottleText(
  importSearch
)
  .split(" ")
  .filter(Boolean);

const filteredImportRows = importRows.filter(
  (r) => {
    if (
      importStatusFilter !== "ALL" &&
      r.status !== importStatusFilter
    ) {
      return false;
    }

    if (importSearchTokens.length > 0) {
      const searchableText = normalizeSoldBottleText(
        [
          r.producer,
          r.wine_name,
          r.cuvee,
          r.vintage,
          r.raw_text,
        ].join(" ")
      );

      const matchesAll = importSearchTokens.every(
        (token) => searchableText.includes(token)
      );

      if (!matchesAll) return false;
    }

    return true;
  }
);

/*
 * Section 11「顧客会社管理」プレビュー一覧の検索・filter。
 * ここではSupabaseへの書き込みは一切行わない（表示用の絞り込みのみ）。
 */
const customerSearchTokens = normalizeSoldBottleText(
  customerSearch
)
  .split(" ")
  .filter(Boolean);

const filteredCustomers = customers.filter((c) => {
  if (
    customerContractFilter !== "ALL" &&
    c.contract_status !== customerContractFilter
  ) {
    return false;
  }

  if (
    customerOnboardingFilter !== "ALL" &&
    c.onboarding_status !== customerOnboardingFilter
  ) {
    return false;
  }

  if (customerSearchTokens.length > 0) {
    const searchableText = normalizeSoldBottleText(
      c.company_name
    );

    const matchesAll = customerSearchTokens.every(
      (token) => searchableText.includes(token)
    );

    if (!matchesAll) return false;
  }

  return true;
});

const selectedCustomerRow = customers.find(
  (c) => c.company_id === selectedCustomerCompanyId
);

/*
 * Section 14: UI側の権限制御。実際の安全境界はDB側のRLSであり、
 * これらはあくまで誤操作防止のためのUI表示制御。
 * currentCustomerRoleが未取得(null)の間は、誤って書き込み操作を
 * 許可しないよう安全側（viewer相当）に倒す。
 */
const isViewerRole =
  currentCustomerRole === null ||
  currentCustomerRole === "viewer";

const isOwnerRole = currentCustomerRole === "owner";

const CUSTOMER_CONTRACT_LABEL_KEYS: Record<
  string,
  ExtraUiI18nKey
> = {
  PROSPECT: "customerContractProspect",
  TRIAL: "customerContractTrial",
  ACTIVE: "customerContractActive",
  PAUSED: "customerContractPaused",
  CANCELLED: "customerContractCancelled",
};

const CUSTOMER_ONBOARDING_LABEL_KEYS: Record<
  string,
  ExtraUiI18nKey
> = {
  NEW: "customerOnboardingNew",
  WAITING_EXCEL: "customerOnboardingWaitingExcel",
  EXCEL_RECEIVED:
    "customerOnboardingExcelReceived",
  ANALYZING: "customerOnboardingAnalyzing",
  READY_TO_IMPORT:
    "customerOnboardingReadyToImport",
  IMPORTED: "customerOnboardingImported",
  ACTIVE: "customerOnboardingActive",
};

function customerContractLabel(
  status: string
): string {
  return tUi(
    CUSTOMER_CONTRACT_LABEL_KEYS[status] ||
      "customerContractProspect"
  );
}

function customerOnboardingLabel(
  status: string
): string {
  return tUi(
    CUSTOMER_ONBOARDING_LABEL_KEYS[status] ||
      "customerOnboardingNew"
  );
}

/*
 * Section 12のユーザー状態表示。
 * lib/admin-company-users.tsのclassifyAuthUserStatus()と
 * 同じ3状態（+ UNKNOWN）に対応する。
 */
function companyUserStatusLabel(
  status: string
): string {
  if (status === "ACTIVE") {
    return tUi("customerUsersActive");
  }
  if (status === "INVITED") {
    return tUi("customerUsersInvited");
  }
  if (status === "UNCONFIRMED") {
    return tUi("customerUsersUnconfirmed");
  }
  return tUi("customerUsersUnknownStatus");
}

function companyUserStatusBadgeClass(
  status: string
): string {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "INVITED") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "UNCONFIRMED") {
    return "bg-stone-200 text-stone-600";
  }
  return "bg-stone-200 text-stone-500";
}

/*
 * Section 14: role表示ラベル。
 */
function companyUserRoleLabel(
  role: string
): string {
  if (role === "owner") {
    return tUi("customerUsersRoleOwner");
  }
  if (role === "viewer") {
    return tUi("customerUsersRoleViewer");
  }
  return tUi("customerUsersRoleStaff");
}

/*
 * 重複ワイン候補（検出のみ）。
 *
 * 生産者 + ヴィンテージ + ボトルサイズが一致し、
 * wine_idが2つ以上あるものを候補として一覧化する。
 *
 * ここでは統合・削除・数量変更は一切行わない。
 * 本当に同じワインかどうかは人が原文・キュヴェを見て判断する。
 */
const normalizeDuplicateKeyText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/*
 * \u6bd4\u8f03\u5c02\u7528\uff1a\u539f\u6587/\u30ad\u30e5\u30f4\u30a7\u304b\u3089\u300c\u751f\u7523\u8005\u540d\u300d\u300c\u30f4\u30a3\u30f3\u30c6\u30fc\u30b8\u300d
 * \u300c\u30dc\u30c8\u30eb\u30b5\u30a4\u30ba\u300d\u300c\u8272\u30fb\u72b6\u614b\u306a\u3069\u306e\u30ce\u30a4\u30ba\u8a9e\u300d\u3092\u53d6\u308a\u9664\u304d\u3001
 * \u6b8b\u3063\u305f\u4e2d\u5fc3\u60c5\u5831\uff08\u30ad\u30e5\u30f4\u30a7\u3089\u3057\u304d\u5358\u8a9e\uff09\u3060\u3051\u3092\u53d6\u308a\u51fa\u3059\u3002
 *
 * \u4f8b\uff1a
 * "CHAMPAGNE 1976 DOM PERIGNON Blanc 75 cl CRD"
 * -> producer/vintage/size/\u30ce\u30a4\u30ba\u8a9e\u3092\u9664\u304f\u3068\u4e2d\u5fc3\u60c5\u5831\u306f\u7a7a
 *    \uff08\uff1d\u7d20\u306e\u30f4\u30a3\u30f3\u30c6\u30fc\u30b8\u3082\u306e\u3067\u3042\u308b\u53ef\u80fd\u6027\u304c\u9ad8\u3044\uff09
 *
 * "CHAMPAGNE CORDON ROUGE 1988 MUMM Blanc 75 cl"
 * -> \u4e2d\u5fc3\u60c5\u5831\u306f "CORDON ROUGE"
 */
const DUPLICATE_NOISE_TOKENS = new Set([
  "NM",
  "NV",
  "RM",
  "MA",
  "CM",
  "SR",
  "ND",
  "CRD",
  "SD",
  "TB",
  "BLANC",
  "ROUGE",
  "ROSE",
  "BLC",
  "RGE",
  "CHAMPAGNE",
  "CL",
]);

const duplicateCoreTokens = (r: Item) => {
  const producerTokens = new Set(
    normalizeDuplicateKeyText(r.producer).split(" ").filter(Boolean)
  );

  const vintageToken =
    normalizeDuplicateKeyText(r.vintage);

  const sizeToken =
    String(r.size || 75);

  /*
   * 重複判定ではAI補完されたcuveeより、
   * 元の仕入データ wine_name(raw) を最優先する。
   *
   * 例:
   * - Les Cras
   * - Les Amoureuses
   *
   * がcuvee補完によって同じ一般名になっていても、
   * 原文の違いを失わない。
   */
  const sourceText =
    r.raw || r.cuvee || "";

  const tokens =
    normalizeDuplicateKeyText(sourceText)
    .split(" ")
    .filter(Boolean);

  return new Set(
    tokens.filter(
      (t) =>
        !producerTokens.has(t) &&
        !DUPLICATE_NOISE_TOKENS.has(t) &&
        t !== vintageToken &&
        t !== sizeToken &&
        !/^\d+$/.test(t)
    )
  );
};

const duplicateTokenSimilarity = (
  a: Set<string>,
  b: Set<string>
) => {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  const intersectionSize = Array.from(a).filter((t) => b.has(t)).length;
  const unionSize = new Set(Array.from(a).concat(Array.from(b))).size;

  return unionSize === 0 ? 1 : intersectionSize / unionSize;
};

const wineListByWineId = useMemo(
  () =>
    new Map(
      wineList.map((row) => [
        row.wine_id,
        row,
      ])
    ),
  [wineList]
);

/*
 * お客様表示でcuveeの2段目を隠す除外リストと同じもの。
 * ここではMaster選定のスコアリング（実キュヴェを持つ方を優先する）にも使う。
 */
const CUVEE_DISPLAY_NOISE_VALUES = [
  "champagne",
  "champagne nm",
  "champagne nv",
  "champagne rose",
  "champagne blanc",
  "champagne rouge",
  "champagne annees 70",
];

const hasRealCuveeText = (
  cuvee: unknown,
  appellation: unknown,
  climat: unknown
) => {
  const cuveeText = String(cuvee || "").trim();

  if (!cuveeText) {
    return false;
  }

  const normalizedCuvee = normalizeWineListSearchText(cuveeText);

  if (CUVEE_DISPLAY_NOISE_VALUES.includes(normalizedCuvee)) {
    return false;
  }

  if (normalizedCuvee === normalizeWineListSearchText(appellation)) {
    return false;
  }

  if (normalizedCuvee === normalizeWineListSearchText(climat)) {
    return false;
  }

  return true;
};

type DuplicateConfidence = "HIGH" | "MEDIUM" | "LOW";

const duplicateConfidenceLabel: Record<
  DuplicateConfidence,
  string
> = {
  HIGH: "\u9ad8\u78ba\u7387",
  MEDIUM: "\u4e2d\u78ba\u7387",
  LOW: "\u5225\u7269\u306e\u53ef\u80fd\u6027",
};

const duplicatePairConfidence = (
  a: Item,
  b: Item
): {
  confidence: DuplicateConfidence;
  similarity: number;
} => {
  const similarity =
    duplicateTokenSimilarity(
      duplicateCoreTokens(a),
      duplicateCoreTokens(b)
    );

  const colorA =
    normalizeDuplicateKeyText(
      a.color
    );

  const colorB =
    normalizeDuplicateKeyText(
      b.color
    );

  /*
   * wines.color自体が明確に異なる場合だけ、
   * 候補表示ではLOWにする。
   *
   * Appellation / Climatについては、
   * wine_list_view上の値が人間確認済みとは限らないため
   * ここでは強制判定に使わない。
   *
   * 実際に「同じワインとして統合」を押した時点で、
   * handleMergeDuplicate() が最新の
   * wine_classification_memoryを取得して
   * 人間確認済み分類の競合を最終チェックする。
   */
  if (
    colorA &&
    colorB &&
    colorA !== colorB
  ) {
    return {
      confidence: "LOW",
      similarity,
    };
  }

  if (similarity >= 0.85) {
    return {
      confidence: "HIGH",
      similarity,
    };
  }

  if (similarity >= 0.25) {
    return {
      confidence: "MEDIUM",
      similarity,
    };
  }

  return {
    confidence: "LOW",
    similarity,
  };
};

const duplicateWineGroups = useMemo(() => {
  const groups = new Map<string, Item[]>();

  allInventory.forEach((r) => {
    if (!r.wineId) {
      return;
    }

    const key = [
      normalizeDuplicateKeyText(
        r.producer
      ),
      normalizeDuplicateKeyText(
        r.vintage
      ),
      String(r.size || 75),
    ].join(" | ");

    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  });

  return Array.from(groups.entries())
    .filter(([, rows]) => {
      const distinctIds = new Set(
        rows.map((r) => r.wineId)
      );

      return distinctIds.size >= 2;
    })
    .map(([key, rows]) => {
      const [reference, ...others] =
        rows;

      const comparedRows = others.map(
        (r) => {
          const {
            confidence,
            similarity,
          } =
            duplicatePairConfidence(
              reference,
              r
            );

          return {
            ...r,
            duplicateConfidence:
              confidence,
            duplicateSimilarity:
              similarity,
          };
        }
      );

      const bestSimilarity =
        comparedRows.reduce(
          (max, r) =>
            Math.max(
              max,
              r.duplicateSimilarity
            ),
          0
        );

      return {
        key,
        reference,
        rows: comparedRows,
        bestSimilarity,
      };
    })
    .sort(
      (a, b) =>
        b.bestSimilarity -
        a.bestSimilarity
    );
}, [allInventory, wineListByWineId]);

const visibleDuplicateWineGroups =
  duplicateWineGroups
    .map((group) => {
      const visibleRows = group.rows
        .filter((row) => {
          if (!row.wineId) {
            return true;
          }

          if (
            duplicateResolutions[
              row.wineId
            ] === "DIFFERENT"
          ) {
            return false;
          }

          if (
            group.reference.wineId
          ) {
            const pairKey =
              duplicateDecisionPairKey(
                group.reference.wineId,
                row.wineId
              );

            if (
              savedDifferentDuplicatePairs[
                pairKey
              ]
            ) {
              return false;
            }
          }

          return true;
        })
        .sort(
          (a, b) =>
            b.duplicateSimilarity -
            a.duplicateSimilarity
        );

      const bestVisibleSimilarity =
        visibleRows.reduce(
          (max, row) =>
            Math.max(
              max,
              row.duplicateSimilarity
            ),
          0
        );

      return {
        ...group,
        rows: visibleRows,
        bestSimilarity:
          bestVisibleSimilarity,
      };
    })
    .filter(
      (group) => group.rows.length > 0
    )
    .sort((a, b) => {
      const aHasExact =
        a.bestSimilarity >= 0.999999;
      const bHasExact =
        b.bestSimilarity >= 0.999999;

      if (aHasExact !== bHasExact) {
        return aHasExact ? -1 : 1;
      }

      return (
        b.bestSimilarity -
        a.bestSimilarity
      );
    });

const visibleDuplicateRows =
  visibleDuplicateWineGroups.flatMap(
    (group) => group.rows
  );

const exactDuplicateCount =
  visibleDuplicateRows.filter(
    (row) =>
      row.duplicateConfidence === "HIGH" &&
      row.duplicateSimilarity >= 0.999999
  ).length;

const highDuplicateCount =
  visibleDuplicateRows.filter(
    (row) =>
      row.duplicateSimilarity < 0.999999 &&
      row.duplicateConfidence === "HIGH"
  ).length;

const reviewDuplicateCount =
  visibleDuplicateRows.filter(
    (row) =>
      row.duplicateConfidence !== "HIGH"
  ).length;

const filteredDuplicateWineGroups =
  visibleDuplicateWineGroups
    .map((group) => {
      const filteredRows =
        group.rows.filter((row) => {
          if (
            duplicateViewFilter === "EXACT"
          ) {
            return (
              row.duplicateConfidence ===
                "HIGH" &&
              row.duplicateSimilarity >=
                0.999999
            );
          }

          if (
            duplicateViewFilter === "HIGH"
          ) {
            return (
              row.duplicateSimilarity <
                0.999999 &&
              row.duplicateConfidence ===
                "HIGH"
            );
          }

          if (
            duplicateViewFilter === "REVIEW"
          ) {
            return (
              row.duplicateConfidence !==
              "HIGH"
            );
          }

          return true;
        });

      return {
        ...group,
        rows: filteredRows,
      };
    })
    .filter(
      (group) => group.rows.length > 0
    );

const displayedDuplicateWineGroups =
  exactDuplicateReviewMode &&
  duplicateViewFilter === "EXACT"
    ? filteredDuplicateWineGroups.slice(0, 1)
    : filteredDuplicateWineGroups;

const sortedWineList = [...wineList]
  .sort((a, b) =>
    [
      a.country,
      a.region,
      a.category,
      a.producer,
      a.appellation,
      a.vintage,
    ]
      .join(" ")
      .localeCompare(
        [
          b.country,
          b.region,
          b.category,
          b.producer,
          b.appellation,
          b.vintage,
        ].join(" ")
      )
  );

const listedWineList =
  sortedWineList.filter(
    (row) => row.is_listed
  );

const unlistedWineList =
  sortedWineList.filter(
    (row) => !row.is_listed
  );

/*
 * Section 7「要確認 / 未分類」の対象（MANAGEモードのみ）。
 */
const wineReviewTargets =
  wineListDisplayMode === "MANAGE"
    ? sortedWineList.filter(isWineListRowNeedingReview)
    : [];

const wineReviewSavableSelectedCount =
  wineReviewCandidates.filter(
    (c) =>
      c.selected &&
      isWineReviewCandidateSavable(c)
  ).length;

/*
 * Section 7「価格未設定」パネルの行。
 * 母集合：MANAGEモード・分類済み・在庫>0・active/未merge。
 * パネル内だけで生産者順に並べる（Section 7本体の並び順は変更しない）。
 */
const isWinePriceUnset = (row: WineListRow) =>
  row.sale_price === null ||
  !Number.isFinite(row.sale_price) ||
  row.sale_price <= 0;

const pricingBaseRows =
  wineListDisplayMode === "MANAGE" && pricingActiveWineIds
    ? wineList
        .filter(
          (row) =>
            row.hasClassification &&
            Number(row.current_quantity || 0) > 0 &&
            pricingActiveWineIds.has(row.wine_id)
        )
        .slice()
        .sort((a, b) =>
          `${a.producer} ${a.wine_name} ${a.vintage}`.localeCompare(
            `${b.producer} ${b.wine_name} ${b.vintage}`
          )
        )
    : [];

const pricingUnsetCount =
  pricingBaseRows.filter(isWinePriceUnset).length;

const pricingRegionOptions = Array.from(
  new Set(
    pricingBaseRows
      .map((row) => row.region?.trim())
      .filter((region): region is string => Boolean(region))
  )
).sort((a, b) => a.localeCompare(b));

const pricingRows = pricingBaseRows.filter((row) => {
  if (pricingOnlyUnpriced && !isWinePriceUnset(row)) {
    return false;
  }

  if (pricingListingFilter === "LISTED" && !row.is_listed) {
    return false;
  }

  if (pricingListingFilter === "UNLISTED" && row.is_listed) {
    return false;
  }

  if (
    pricingRegionFilter !== "ALL" &&
    row.region?.trim() !== pricingRegionFilter
  ) {
    return false;
  }

  if (
    pricingCategoryFilter !== "ALL" &&
    row.category !== pricingCategoryFilter
  ) {
    return false;
  }

  return true;
});

const pricingDraftValue = (row: WineListRow) => {
  const draft = pricingDrafts[row.wine_id];

  if (draft !== undefined) {
    return draft;
  }

  const recommended = recommendedSalePriceFromCost(
    row.avg_cost_ht
  );

  return recommended ? String(recommended.price) : "";
};

const parsePricingDraft = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  const price = Number(normalized);

  return normalized && Number.isFinite(price) && price > 0
    ? Math.round(price * 100) / 100
    : null;
};

/*
 * 既定チェック：価格未設定かつ推奨価格が出せる行のみON。
 * 既に価格がある行は、既存価格を誤って上書きしないよう既定OFF。
 */
const isPricingRowSelected = (row: WineListRow) =>
  pricingSelected[row.wine_id] ??
  (isWinePriceUnset(row) &&
    recommendedSalePriceFromCost(row.avg_cost_ht) !== null);

const pricingSavableSelectedRows = pricingRows.filter(
  (row) =>
    isPricingRowSelected(row) &&
    parsePricingDraft(pricingDraftValue(row)) !== null
);

const wineListRegions = Array.from(
  new Set(
    sortedWineList
      .map((row) => row.region?.trim())
      .filter(
        (region): region is string =>
          Boolean(region)
      )
  )
).sort((a, b) =>
  a.localeCompare(b)
);

const baseDisplayedWineList =
  wineListViewMode === "LISTED"
    ? listedWineList
    : wineListViewMode === "UNLISTED"
      ? unlistedWineList
      : sortedWineList;

const normalizeWineListSearchText = (
  value: unknown
) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const wineListSearchTerms =
  normalizeWineListSearchText(
    wineListSearch
  )
    .split(/\s+/)
    .filter(Boolean);

const filteredWineList =
  baseDisplayedWineList.filter((row) => {
    if (
      wineListRegionFilter !== "ALL" &&
      row.region?.trim() !== wineListRegionFilter
    ) {
      return false;
    }

    if (
      wineListCategoryFilter !== "ALL" &&
      row.category !== wineListCategoryFilter
    ) {
      return false;
    }

    if (wineListSearchTerms.length === 0) {
      return true;
    }

    const searchableText =
      normalizeWineListSearchText(
        [
          row.country,
          row.region,
          row.subregion,
          row.category,
          row.producer,
          row.wine_name,
          row.cuvee,
          row.vintage,
          row.appellation,
          row.climat,
          row.cru_level,
        ].join(" ")
      );

    return wineListSearchTerms.every(
      (term) =>
        searchableText.includes(term)
    );
  });

const wineListVintageNumber = (
  value: unknown
): number | null => {
  const text = String(value || "").trim();

  /*
   * 4桁の実Vintageだけを数値として扱う。
   *
   * NVはNon Vintageとして有効な値だが、
   * 年代順では数値Vintageの後ろへ置く。
   *
   * 空欄もNVとは別物のまま扱い、
   * 年代順では後ろへ置く。
   */
  if (!/^\d{4}$/.test(text)) {
    return null;
  }

  return Number(text);
};

const wineListSortTieBreaker = (
  a: WineListRow,
  b: WineListRow
) =>
  [
    a.producer,
    a.appellation,
    a.climat,
    a.cuvee,
    a.vintage,
    a.wine_id,
  ]
    .join(" ")
    .localeCompare(
      [
        b.producer,
        b.appellation,
        b.climat,
        b.cuvee,
        b.vintage,
        b.wine_id,
      ].join(" "),
      undefined,
      {
        sensitivity: "base",
      }
    );

const displayedWineList =
  wineListSortMode === "DEFAULT"
    ? filteredWineList
    : [...filteredWineList].sort(
        (a, b) => {
          if (
            wineListSortMode ===
            "PRODUCER_ASC"
          ) {
            const producerCompare =
              String(
                a.producer || ""
              ).localeCompare(
                String(
                  b.producer || ""
                ),
                undefined,
                {
                  sensitivity: "base",
                }
              );

            if (producerCompare !== 0) {
              return producerCompare;
            }

            return wineListSortTieBreaker(
              a,
              b
            );
          }

          if (
            wineListSortMode ===
              "VINTAGE_DESC" ||
            wineListSortMode ===
              "VINTAGE_ASC"
          ) {
            const vintageA =
              wineListVintageNumber(
                a.vintage
              );

            const vintageB =
              wineListVintageNumber(
                b.vintage
              );

            /*
             * 年が無い・NVなどは、
             * 昇順/降順どちらでも最後。
             */
            if (
              vintageA === null &&
              vintageB !== null
            ) {
              return 1;
            }

            if (
              vintageA !== null &&
              vintageB === null
            ) {
              return -1;
            }

            if (
              vintageA !== null &&
              vintageB !== null &&
              vintageA !== vintageB
            ) {
              return wineListSortMode ===
                "VINTAGE_DESC"
                ? vintageB - vintageA
                : vintageA - vintageB;
            }

            return wineListSortTieBreaker(
              a,
              b
            );
          }

          if (
            wineListSortMode ===
              "PRICE_ASC" ||
            wineListSortMode ===
              "PRICE_DESC"
          ) {
            const priceA =
              a.sale_price !== null &&
              Number.isFinite(
                a.sale_price
              )
                ? a.sale_price
                : null;

            const priceB =
              b.sale_price !== null &&
              Number.isFinite(
                b.sale_price
              )
                ? b.sale_price
                : null;

            /*
             * 価格未設定は昇順/降順どちらでも最後。
             */
            if (
              priceA === null &&
              priceB !== null
            ) {
              return 1;
            }

            if (
              priceA !== null &&
              priceB === null
            ) {
              return -1;
            }

            if (
              priceA !== null &&
              priceB !== null &&
              priceA !== priceB
            ) {
              return wineListSortMode ===
                "PRICE_DESC"
                ? priceB - priceA
                : priceA - priceB;
            }

            return wineListSortTieBreaker(
              a,
              b
            );
          }

          return wineListSortTieBreaker(
            a,
            b
          );
        }
      );

const wineCategoryOrder: WineListRow["category"][] = [
  "SPARKLING",
  "WHITE",
  "ROSE",
  "RED",
  "SPIRIT",
  "UNKNOWN",
];

/*
 * \u304a\u5ba2\u69d8\u8868\u793a\u30fb\u7ba1\u7406\u8868\u793a\u3067\u5171\u6709\u3059\u308bUI\u6587\u8a00\u306e\u7ffb\u8a33\u8f9e\u66f8\u3002
 *
 * \u3053\u3053\u306b\u5165\u308c\u308b\u306e\u306f\u300cUI\u30e9\u30d9\u30eb\u300d\u3060\u3051\u3002
 * \u751f\u7523\u8005\u540d\u30fbAppellation\u30fbCuv\u00e9e\u306a\u3069\u30ef\u30a4\u30f3\u56fa\u6709\u540d\u8a5e\u306f
 * \u30c7\u30fc\u30bf\u305d\u306e\u307e\u307e\u306a\u306e\u3067\u7ffb\u8a33\u3057\u306a\u3044\u3002
 */
const WINE_LIST_I18N = {
  FR: {
    layoutRegion: "Par r\u00e9gion",
    layoutProducer: "Par producteur",
    layoutSimple: "Liste simple",
    sortDefault: "Standard",
    sortProducer: "Producteur A\u2192Z",
    sortVintageDesc: "Mill\u00e9sime r\u00e9cent\u2192ancien",
    sortVintageAsc: "Mill\u00e9sime ancien\u2192r\u00e9cent",
    sortPriceAsc: "Prix croissant",
    sortPriceDesc: "Prix d\u00e9croissant",
    categorySparkling: "Effervescent",
    categoryWhite: "Blanc",
    categoryRose: "Ros\u00e9",
    categoryRed: "Rouge",
    categorySpirit: "Spiritueux",
    categoryUnknown: "\u00c0 v\u00e9rifier",
    displayManage: "Gestion",
    displayCustomer: "Carte des vins",
    settingsTitle: "R\u00e9glages d'affichage",
    layoutLabel: "Disposition",
    sortLabel: "Tri",
    combineHint:
      "La disposition et le tri se combinent librement. Ex. Par r\u00e9gion \u00d7 Mill\u00e9sime ancien\u2192r\u00e9cent.",
    searchPlaceholder:
      "Producteur, r\u00e9gion, mill\u00e9sime, appellation\u2026",
    emptyList: "Aucun vin \u00e0 afficher.",
    unknownProducer: "Producteur inconnu",
    other: "Autres",
    regionLabel: "Région",
    allRegions: "Toutes les régions",
    categoryLabel: "Catégorie",
    allCategories: "Toutes les catégories",
    clearSearch: "Effacer",
    searchResults: "Résultats",
    resultUnit: "vins",
    typeUnit: "vins",
    simpleListTitle: "Liste des vins",
    viewListed: "À la carte",
    viewUnlisted: "Hors carte",
    viewAll: "Tous",
  },
  JA: {
    layoutRegion: "\u5730\u57df\u5225",
    layoutProducer: "\u751f\u7523\u8005\u5225",
    layoutSimple: "\u30b7\u30f3\u30d7\u30eb\u4e00\u89a7",
    sortDefault: "\u6a19\u6e96",
    sortProducer: "\u751f\u7523\u8005 A\u2192Z",
    sortVintageDesc: "Vintage \u65b0\u2192\u65e7",
    sortVintageAsc: "Vintage \u65e7\u2192\u65b0",
    sortPriceAsc: "\u4fa1\u683c \u5b89\u2192\u9ad8",
    sortPriceDesc: "\u4fa1\u683c \u9ad8\u2192\u5b89",
    categorySparkling: "\u6ce1",
    categoryWhite: "\u767d",
    categoryRose: "\u30ed\u30bc",
    categoryRed: "\u8d64",
    categorySpirit: "\u30b9\u30d4\u30ea\u30c3\u30c4",
    categoryUnknown: "\u8981\u78ba\u8a8d",
    displayManage: "\u7ba1\u7406\u8868\u793a",
    displayCustomer: "\u304a\u5ba2\u69d8\u8868\u793a",
    settingsTitle: "\u30ef\u30a4\u30f3\u30ea\u30b9\u30c8\u8868\u793a\u8a2d\u5b9a",
    layoutLabel: "\u30ec\u30a4\u30a2\u30a6\u30c8",
    sortLabel: "\u4e26\u3073\u9806",
    combineHint:
      "\u30ec\u30a4\u30a2\u30a6\u30c8\u3068\u4e26\u3073\u9806\u306f\u81ea\u7531\u306b\u7d44\u307f\u5408\u308f\u305b\u3089\u308c\u307e\u3059\u3002\u4f8b\uff1a\u5730\u57df\u5225 \u00d7 Vintage\u65e7\u2192\u65b0\u3001\u751f\u7523\u8005\u5225 \u00d7 \u4fa1\u683c\u9ad8\u2192\u5b89\u3002",
    searchPlaceholder:
      "\u751f\u7523\u8005\u30fb\u5730\u57df\u30fbVintage\u30fbAppellation\u306a\u3069\u3092\u691c\u7d22",
    emptyList: "\u8868\u793a\u3059\u308b\u30ef\u30a4\u30f3\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
    unknownProducer: "\u751f\u7523\u8005\u4e0d\u660e",
    other: "\u305d\u306e\u4ed6",
    regionLabel: "\u5730\u57df",
    allRegions: "\u5168\u5730\u57df",
    categoryLabel: "\u30ab\u30c6\u30b4\u30ea\u30fc",
    allCategories: "\u5168\u30ab\u30c6\u30b4\u30ea\u30fc",
    clearSearch: "\u30af\u30ea\u30a2",
    searchResults: "\u691c\u7d22\u7d50\u679c",
    resultUnit: "\u4ef6",
    typeUnit: "\u7a2e\u985e",
    simpleListTitle: "\u30ef\u30a4\u30f3\u4e00\u89a7",
    viewListed: "\u63b2\u8f09\u4e2d",
    viewUnlisted: "\u975e\u63b2\u8f09",
    viewAll: "\u3059\u3079\u3066",
  },
  EN: {
    layoutRegion: "By region",
    layoutProducer: "By producer",
    layoutSimple: "Simple list",
    sortDefault: "Default",
    sortProducer: "Producer A\u2192Z",
    sortVintageDesc: "Vintage new\u2192old",
    sortVintageAsc: "Vintage old\u2192new",
    sortPriceAsc: "Price low\u2192high",
    sortPriceDesc: "Price high\u2192low",
    categorySparkling: "Sparkling",
    categoryWhite: "White",
    categoryRose: "Ros\u00e9",
    categoryRed: "Red",
    categorySpirit: "Spirit",
    categoryUnknown: "To confirm",
    displayManage: "Management",
    displayCustomer: "Wine list",
    settingsTitle: "Display settings",
    layoutLabel: "Layout",
    sortLabel: "Sort",
    combineHint:
      "Layout and sort order can be combined freely. E.g. By region \u00d7 Vintage old\u2192new.",
    searchPlaceholder:
      "Search producer, region, vintage, appellation\u2026",
    emptyList: "No wines to display.",
    unknownProducer: "Unknown producer",
    other: "Other",
    regionLabel: "Region",
    allRegions: "All regions",
    categoryLabel: "Category",
    allCategories: "All categories",
    clearSearch: "Clear",
    searchResults: "Results",
    resultUnit: "wines",
    typeUnit: "wines",
    simpleListTitle: "Wine list",
    viewListed: "Listed",
    viewUnlisted: "Unlisted",
    viewAll: "All",
  },
} as const;

const tWine = (
  key: keyof (typeof WINE_LIST_I18N)["JA"]
) => WINE_LIST_I18N[wineListLanguage][key];

const wineCategoryLabel = (
  category: WineListRow["category"]
) => {
  if (category === "SPARKLING") return tWine("categorySparkling");
  if (category === "WHITE") return tWine("categoryWhite");
  if (category === "ROSE") return tWine("categoryRose");
  if (category === "RED") return tWine("categoryRed");
  if (category === "SPIRIT") return tWine("categorySpirit");
  return tWine("categoryUnknown");
};

const EURO_SIGN = "\u20ac";

/*
 * \u304a\u5ba2\u69d8\u30ef\u30a4\u30f3\u30ea\u30b9\u30c8\u5c02\u7528\u306e\u6bd4\u8f03\u6b63\u898f\u5316\u3002
 *
 * Moulin-\u00e0-Vent / MOULIN A VENT \u306e\u3088\u3046\u306a
 * \u30a2\u30af\u30bb\u30f3\u30c8\u30fb\u30cf\u30a4\u30d5\u30f3\u30fb\u5927\u6587\u5b57\u5c0f\u6587\u5b57\u306e\u9055\u3044\u3092\u5438\u53ce\u3059\u308b\u3002
 *
 * DB\u306e\u5024\u305d\u306e\u3082\u306e\u306f\u5909\u66f4\u3057\u306a\u3044\u3002
 */
const normalizeCustomerWineText = (
  value: unknown
) =>
  normalizeWineListSearchText(value)
    .replace(/\u0153/g, "oe")
    .replace(/\u00e6/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/*
 * \u304a\u5ba2\u69d8\u8868\u793a\u3067Cuv\u00e9e\u30922\u884c\u76ee\u306b\u51fa\u3059\u3079\u304d\u304b\u5224\u5b9a\u3059\u308b\u3002
 *
 * Appellation / Climat\u3092\u7e70\u308a\u8fd4\u3057\u3066\u3044\u308b\u3060\u3051\u306e\u6587\u5b57\u5217\u3084\u3001
 * \u4f1d\u7968\u7531\u6765\u306e\u5197\u9577\u306a\u8868\u8a18\u306f\u96a0\u3059\u3002
 *
 * Aka / Cordon Rouge / Brut Imp\u00e9rial \u306a\u3069\u3001
 * \u72ec\u7acb\u3057\u305f\u610f\u5473\u3092\u6301\u3064Cuv\u00e9e\u306f\u6b8b\u3059\u3002
 */
const shouldShowCustomerCuvee = (
  row: WineListRow
) => {
  const cuveeText =
    String(row.cuvee || "").trim();

  if (!cuveeText) {
    return false;
  }

  /*
   * Appellation\u304c\u7121\u3044\u5834\u5408\u3001
   * \u30e1\u30a4\u30f3\u884c\u3067\u3059\u3067\u306bCuv\u00e9e\u3092\u8868\u793a\u3057\u3066\u3044\u308b\u305f\u3081
   * 2\u884c\u76ee\u306b\u306f\u91cd\u8907\u8868\u793a\u3057\u306a\u3044\u3002
   */
  if (!String(row.appellation || "").trim()) {
    return false;
  }

  if (
    CUVEE_DISPLAY_NOISE_VALUES.includes(
      normalizeWineListSearchText(
        cuveeText
      )
    )
  ) {
    return false;
  }

  const normalizedCuvee =
    normalizeCustomerWineText(
      cuveeText
    );

  const normalizedAppellation =
    normalizeCustomerWineText(
      row.appellation
    );

  const normalizedClimat =
    normalizeCustomerWineText(
      row.climat
    );

  const normalizedMainText =
    normalizeCustomerWineText(
      `${row.appellation || ""} ${
        row.climat || ""
      }`
    );

  if (
    normalizedCuvee ===
      normalizedAppellation ||
    normalizedCuvee ===
      normalizedClimat ||
    normalizedCuvee ===
      normalizedMainText
  ) {
    return false;
  }

  const mainTokens =
    new Set(
      normalizedMainText
        .split(" ")
        .filter(Boolean)
    );

  const producerTokens =
    new Set(
      normalizeCustomerWineText(
        row.producer
      )
        .split(" ")
        .filter(Boolean)
    );

  const ignoredTokens =
    new Set([
      "cuvee",
      "eponym",
      "eponyme",
      "eponymous",
      "vin",
      "wine",
      "blanc",
      "white",
      "rouge",
      "red",
      "rose",
      "crd",
      "cl",
      "75",
      "nm",
      "nv",
    ]);

  const vintageToken =
    normalizeCustomerWineText(
      row.vintage
    );

  const meaningfulCuveeTokens =
    normalizedCuvee
      .split(" ")
      .filter(Boolean)
      .filter(
        (token) =>
          !ignoredTokens.has(token)
      )
      .filter(
        (token) =>
          !producerTokens.has(token)
      )
      .filter(
        (token) =>
          !vintageToken ||
          token !== vintageToken
      );

  if (
    meaningfulCuveeTokens.length === 0
  ) {
    return false;
  }

  /*
   * Cuv\u00e9e\u5074\u306b\u6b8b\u3063\u305f\u610f\u5473\u306e\u3042\u308b\u5358\u8a9e\u304c
   * \u3059\u3079\u3066Appellation + Climat\u5185\u306b\u5b58\u5728\u3059\u308b\u306a\u3089\u3001
   * \u5b9f\u8cea\u7684\u306a\u91cd\u8907\u8868\u8a18\u3068\u307f\u306a\u3059\u3002
   *
   * \u4f8b:
   * MORGON EPONYM LES CHARMES
   * \u2192 MORGON + LES CHARMES \u3068\u91cd\u8907
   */
  const onlyRepeatsMainText =
    meaningfulCuveeTokens.every(
      (token) =>
        mainTokens.has(token)
    );

  if (onlyRepeatsMainText) {
    return false;
  }

  return true;
};

/*
 * \u304a\u5ba2\u69d8\u8868\u793a\u5c02\u7528\u306e\u4fa1\u683c\u30d5\u30a9\u30fc\u30de\u30c3\u30c8\u3002
 *
 * 36.00 \u2192 36 \u20ac
 * 36.50 \u2192 36.50 \u20ac
 *
 * \u7ba1\u7406\u8868\u793a\u306e\u4fa1\u683c\u7cbe\u5ea6\u306f\u5909\u66f4\u3057\u306a\u3044\u3002
 */
const formatCustomerWinePrice = (
  value: number | null
) => {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "\u2014";
  }

  const rounded =
    Math.round(value * 100) / 100;

  if (Number.isInteger(rounded)) {
    return `${rounded.toFixed(
      0
    )} ${EURO_SIGN}`;
  }

  return `${rounded.toFixed(
    2
  )} ${EURO_SIGN}`;
};

/*
 * 管理画面で販売価格を編集したが、
 * まだSupabaseへ保存していないかを判定する。
 */
const isWinePriceDraftDirty = (
  row: WineListRow
) => {
  const draft =
    winePriceDrafts[row.wine_id];

  /*
   * 一度も入力欄を変更していない。
   */
  if (draft === undefined) {
    return false;
  }

  const normalizedDraft =
    draft
      .replace(",", ".")
      .trim();

  /*
   * 空欄へ変更した場合。
   */
  if (!normalizedDraft) {
    return row.sale_price !== null;
  }

  const draftPrice =
    Number(normalizedDraft);

  /*
   * 数字として不正な入力も
   * 「未保存の変更」として表示する。
   */
  if (!Number.isFinite(draftPrice)) {
    return true;
  }

  const roundedDraft =
    Math.round(
      draftPrice * 100
    ) / 100;

  const savedPrice =
    row.sale_price === null
      ? null
      : Math.round(
          row.sale_price * 100
        ) / 100;

  return (
    savedPrice === null ||
    roundedDraft !== savedPrice
  );
};

const renderWineListRow = (
  row: WineListRow
) =>
  wineListDisplayMode === "CUSTOMER" ? (
    <div
      key={row.wine_id}
      className="wine-list-print-row grid grid-cols-[48px_minmax(0,1fr)_auto] items-baseline gap-x-4 px-6 py-2.5 font-wineserif text-[15px] leading-relaxed text-stone-900 md:px-8"
    >
      <div className="text-right text-[12px] tabular-nums text-stone-500">
        {row.vintage}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0">
            {row.appellation ||
              row.cuvee ||
              row.wine_name ||
              "\u2014"}

            {row.climat ? (
              <span className="italic text-stone-600">
                {" "}
                / {row.climat}
              </span>
            ) : (
              ""
            )}
          </span>

          <span className="mx-1 h-px flex-1 self-center border-b border-dotted border-stone-300" />
        </div>

        {shouldShowCustomerCuvee(
          row
        ) && (
          <div className="mt-0.5 text-[12px] italic text-stone-500">
            {row.cuvee}
          </div>
        )}

        {Number(row.bottle_size_cl) > 0 &&
          Number(row.bottle_size_cl) !==
            75 && (
            <div className="mt-0.5 text-[11px] text-stone-400">
              {row.bottle_size_cl} cl
            </div>
          )}
      </div>

      <div className="min-w-[74px] text-right text-[15px] font-medium tabular-nums">
        {formatCustomerWinePrice(
          row.sale_price
        )}
      </div>
    </div>
  ) : (
    <div
      key={row.wine_id}
      className="grid grid-cols-12 gap-2 border-t border-stone-100 px-4 py-2 text-xs"
    >
      <div className="col-span-1 font-semibold">
        {row.vintage}
      </div>

      <div className="col-span-4">
        {row.wine_name ||
          row.cuvee}
      </div>

      <div className="col-span-3 text-stone-600">
        {row.hasClassification ? (
          <>
            {row.appellation}

            {row.climat
              ? ` / ${row.climat}`
              : ""}
          </>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            {tUi("wineListUnclassified")}
          </span>
        )}
      </div>

      <div className="col-span-4 flex flex-wrap items-center justify-end gap-2">
        <input
          type="text"
          inputMode="decimal"
          className={
            isWinePriceDraftDirty(row)
              ? "input !h-8 w-[90px] border-amber-400 bg-amber-50 !px-2 !py-1 text-right text-sm font-bold ring-2 ring-amber-100"
              : "input !h-8 w-[90px] !px-2 !py-1 text-right text-sm font-bold"
          }
          value={
            winePriceDrafts[
              row.wine_id
            ] ??
            (row.sale_price === null
              ? ""
              : row.sale_price.toFixed(
                  2
                ))
          }
          readOnly={isViewerRole}
          onChange={(e) =>
            setWinePriceDrafts(
              (prev) => ({
                ...prev,
                [row.wine_id]:
                  e.target.value,
              })
            )
          }
          onKeyDown={(e) => {
            if (e.key !== "Enter") {
              return;
            }

            e.preventDefault();

            if (
              savingWinePriceIds.includes(
                row.wine_id
              )
            ) {
              return;
            }

            saveWineListPrice(
              row.wine_id
            );
          }}
        />

        <span className="text-sm font-bold">
          {EURO_SIGN}
        </span>

        {isWinePriceDraftDirty(row) && (
          <span className="whitespace-nowrap text-[10px] font-bold text-amber-700">
            {tUi("unsaved")}
          </span>
        )}

        <button
          type="button"
          className="btn btn-primary !h-8 whitespace-nowrap !px-3 !py-1 text-xs"
          onClick={() =>
            saveWineListPrice(
              row.wine_id
            )
          }
          disabled={
            savingWinePriceIds.includes(
              row.wine_id
            ) || isViewerRole
          }
          title={
            isViewerRole
              ? tUi("viewerReadOnlyAction")
              : undefined
          }
        >
          {savingWinePriceIds.includes(
            row.wine_id
          )
            ? tApp("saving")
            : tUi("saveAction")}
        </button>

        <button
          type="button"
          className={
            row.is_listed
              ? "btn btn-secondary !h-8 whitespace-nowrap !px-3 !py-1 text-xs"
              : "btn btn-primary !h-8 whitespace-nowrap !px-3 !py-1 text-xs"
          }
          onClick={() =>
            saveWineListListing(
              row.wine_id,
              !row.is_listed
            )
          }
          disabled={
            savingWineListingIds.includes(
              row.wine_id
            ) ||
            isViewerRole ||
            (!row.is_listed &&
              !row.hasClassification)
          }
          title={
            isViewerRole
              ? tUi("viewerReadOnlyAction")
              : !row.is_listed &&
                  !row.hasClassification
                ? tUi(
                    "listingNeedsClassification"
                  )
                : undefined
          }
        >
          {savingWineListingIds.includes(
            row.wine_id
          )
            ? tUi("changing")
            : row.is_listed
              ? tUi("moveToUnlisted")
              : tUi("listWine")}
        </button>
      </div>
    </div>
  );

/*
 * お客様表示では、印刷物のワインリストらしく
 * グループ見出しを黒バーではなく余白・中央揃え・
 * セリフ体の控えめな見出しに切り替える。
 * 管理表示側の機能的な見た目は変更しない。
 */
const isCustomerWineView =
  wineListDisplayMode === "CUSTOMER";

const wineListSectionHeaderClass =
  isCustomerWineView
    ? "wine-list-print-heading wine-list-print-country sticky top-0 z-20 border-b border-stone-300 bg-[#fffdf9]/95 px-6 pt-7 pb-3 text-center font-display text-[28px] font-bold uppercase tracking-[0.20em] text-stone-900 backdrop-blur"
    : "sticky top-0 z-20 border-b border-stone-300 bg-stone-900 px-4 py-3 text-lg font-bold text-white";

const wineListSubHeaderClass =
  isCustomerWineView
    ? "wine-list-print-heading px-6 pb-1 pt-5 text-center font-display text-[19px] font-semibold tracking-[0.04em] text-stone-800"
    : "border-b border-stone-200 bg-stone-200 px-4 py-3 text-base font-bold";

const wineListCategoryHeaderClass =
  isCustomerWineView
    ? "wine-list-print-heading px-6 pb-2 pt-4 text-center text-[10px] font-semibold uppercase tracking-[0.30em] text-stone-500"
    : "border-b border-stone-200 bg-stone-100 px-4 py-2 text-sm font-bold";

const wineListProducerLabelClass =
  isCustomerWineView
    ? "wine-list-print-heading px-6 pb-1 pt-5 text-left font-display text-[17px] font-semibold tracking-[0.03em] text-stone-900 md:px-8 md:text-[18px]"
    : "bg-stone-50 px-4 pt-2 text-[11px] font-bold text-stone-500";

const wineListOriginLabelClass =
  isCustomerWineView
    ? "px-6 pt-3 text-center text-[11px] uppercase tracking-[0.2em] text-stone-400"
    : "bg-stone-50 px-4 pt-2 text-[10px] text-stone-500";

const wineListRowWrapperClass =
  isCustomerWineView
    ? "wine-list-print-row"
    : "border-b border-stone-100";

const wineListSimpleMetaClass =
  isCustomerWineView
    ? "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 pt-3 text-center text-[11px] uppercase tracking-[0.15em] text-stone-400"
    : "flex flex-wrap items-center gap-x-3 gap-y-1 bg-stone-50 px-4 pt-2 text-[10px] text-stone-500";

/*
 * Section 8「売れたボトルを写真AI判定で在庫から引く」の
 * 未確認/確認済み件数と、SALEボタンを有効化してよいかの判定。
 *
 * ここではUI表示・disabled制御だけを行い、
 * applySoldBottleSales()側の安全チェックは一切変更・省略しない
 * （このconstはあくまで補助的な事前警告のためのもの）。
 */
const soldBottleTotalCount =
  soldBottleDetections.length;

const soldBottleConfirmedCount =
  soldBottleDetections.filter(
    (item) => item.selectedWineId
  ).length;

const soldBottleUnconfirmedCount =
  soldBottleTotalCount -
  soldBottleConfirmedCount;

/*
 * 同じwine_idが複数行にまたがる場合を考慮し、
 * wine_id単位で販売本数を合算してから在庫超過を判定する
 * （applySoldBottleSales()と同じ考え方をUI側でも先取りする）。
 */
const soldBottleQuantityByWineId =
  new Map<string, number>();

soldBottleDetections.forEach(
  (item) => {
    if (!item.selectedWineId) {
      return;
    }

    soldBottleQuantityByWineId.set(
      item.selectedWineId,
      (soldBottleQuantityByWineId.get(
        item.selectedWineId
      ) || 0) + Number(item.quantity || 0)
    );
  }
);

const soldBottleHasInvalidQuantity =
  soldBottleDetections.some(
    (item) =>
      !Number.isInteger(
        Number(item.quantity)
      ) ||
      Number(item.quantity) < 1
  );

const soldBottleHasOverStock =
  Array.from(
    soldBottleQuantityByWineId.entries()
  ).some(([wineId, quantity]) => {
    const row = allInventory.find(
      (inventoryRow) =>
        inventoryRow.wineId === wineId
    );

    return (
      !row ||
      quantity > Number(row.qty || 0)
    );
  });

const soldBottleCanApply =
  soldBottleTotalCount > 0 &&
  soldBottleUnconfirmedCount === 0 &&
  !soldBottleHasInvalidQuantity &&
  !soldBottleHasOverStock;

  return (
<main className="mx-auto max-w-[1800px] p-4">
      <div className="flex flex-wrap items-center justify-end gap-2 pb-2 text-xs">
        <span className="mr-1 font-semibold text-stone-500">
          {tApp("language")}
        </span>

        <button
          type="button"
          className={
            appLanguage === "FR"
              ? "btn btn-primary !px-3 !py-1 text-xs"
              : "btn btn-secondary !px-3 !py-1 text-xs"
          }
          onClick={() => setAppLanguage("FR")}
        >
          Français
        </button>

        <button
          type="button"
          className={
            appLanguage === "JA"
              ? "btn btn-primary !px-3 !py-1 text-xs"
              : "btn btn-secondary !px-3 !py-1 text-xs"
          }
          onClick={() => setAppLanguage("JA")}
        >
          日本語
        </button>

        <button
          type="button"
          className={
            appLanguage === "EN"
              ? "btn btn-primary !px-3 !py-1 text-xs"
              : "btn btn-secondary !px-3 !py-1 text-xs"
          }
          onClick={() => setAppLanguage("EN")}
        >
          English
        </button>
      </div>

      {isViewerRole && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-800">
          {tUi("viewerBanner")}
        </div>
      )}

      <section className="card p-6">
        <p className="text-sm font-bold text-stone-500">
          {currentCompanyName || ""}
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          {tApp("appTitle")}
        </h1>

        <p className="mt-2 text-stone-600">
          {tApp("appDescription")}
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">
          {tApp("installTitle")}
        </h2>

        <p className="mt-2 text-sm text-stone-600">
          {tApp("installDescription")}
        </p>

        <ol className="mt-3 list-decimal pl-5 text-sm text-stone-700">
          <li>{tApp("installStep1")}</li>
          <li>{tApp("installStep2")}</li>
          <li>{tApp("installStep3")}</li>
          <li>{tApp("installStep4")}</li>
        </ol>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">
          {tApp("section1Title")}
        </h2>

        <input
          className="input mt-3 w-full"
          type="file"
          multiple
          accept="image/*,.pdf,application/pdf"
          disabled={isViewerRole}
          onChange={(e) =>
            handleFiles(
              Array.from(
                e.target.files || []
              )
            )
          }
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="btn btn-primary"
            disabled={loading || isViewerRole}
            title={
              isViewerRole
                ? tUi("viewerReadOnlyAction")
                : undefined
            }
            onClick={analyze}
          >
            {loading
              ? tApp("analyzing")
              : tApp("analyzeAndRegister")}
          </button>

          <button
            className="btn btn-secondary"
            onClick={addRow}
            disabled={isViewerRole}
            title={
              isViewerRole
                ? tUi("viewerReadOnlyAction")
                : undefined
            }
          >
            {tApp("addManualRow")}
          </button>
        </div>

        {status && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {status}
          </div>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">
          {tApp("section2Title")}
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <label>
              {tApp("supplier")}
            </label>

            <input
              className="input w-full"
              value={supplier}
              onChange={(e) =>
                setSupplier(
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label>
              {tApp("company")}
            </label>

            <input
              className="input w-full"
              value={customer}
              onChange={(e) =>
                setCustomer(
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label>
              {tApp("invoiceNumber")}
            </label>

            <input
              className="input w-full"
              value={invoiceNo}
              onChange={(e) =>
                setInvoiceNo(
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label>
              {tApp("invoiceDate")}
            </label>

            <input
              className="input w-full"
              type="date"
              value={invoiceDate}
              onChange={(e) =>
                setInvoiceDate(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {warnings.length > 0 && (
          <ul className="mt-3 list-disc rounded-xl border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-800">
            {warnings.map(
              (w, i) => (
                <li key={i}>
                  {w}
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">
          {tApp("section3Title")}
        </h2>

        <p className="mt-1 text-sm text-stone-600">
          {tApp("section3Description")}
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[42%_58%]">
          <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold">
                {tApp("sourceDocument")}
              </h3>

              {selectedPreview && (
                <a
                  className="text-sm underline"
                  href={selectedPreview.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tApp("openNewTab")}
                </a>
              )}
            </div>

            {previews.length > 0 ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
                {previews.map((p, idx) => (
                  <button
                    key={`${p.name}-${idx}`}
                    type="button"
                    className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${
                      selectedPreview?.url === p.url
                        ? "border-stone-900 bg-white font-bold"
                        : "border-stone-200 bg-white"
                    }`}
                    onClick={() =>
                      setSelectedPreview(p)
                    }
                  >
                    <div className="max-w-[180px] truncate">
                      {p.name}
                    </div>

                    <div className="!text-[11px] text-stone-500">
                      {p.type.includes("pdf")
                        ? "PDF"
                        : tApp("imageFile")}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">
                {tApp("noPreview")}
              </p>
            )}

            {selectedPreview?.type.includes("pdf") ? (
              <iframe
                src={selectedPreview.url}
                className="h-[760px] w-full rounded-xl border border-stone-200 bg-white"
                title={selectedPreview.name}
              />
            ) : selectedPreview ? (
              <div className="flex h-[760px] justify-center overflow-auto rounded-xl border border-stone-200 bg-white p-3">
                <img
                  src={selectedPreview.url}
                  alt={selectedPreview.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3">
            <h3 className="mb-3 font-bold">
              {tApp("extractedInventory")}
            </h3>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-stone-50 p-4">
                {tApp("stockBottles")}
                <br />
                <b className="text-2xl">
                  {totalQty}
                </b>
              </div>

              <div className="rounded-xl bg-stone-50 p-4">
                {tApp("amountHT")}
                <br />
                <b className="text-2xl">
                  {totalHT.toFixed(2)} €
                </b>
              </div>

              <div className="rounded-xl bg-stone-50 p-4">
                {tApp("productCount")}
                <br />
                <b className="text-2xl">
                  {inventory.length}
                </b>
              </div>

              <div className="rounded-xl bg-stone-50 p-4">
                {tApp("needsReview")}
                <br />
                <b className="text-2xl">
                  {needsCheck}
                </b>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                onClick={exportExcel}
              >
                {tApp("exportExcel")}
              </button>

              <button
                className="btn btn-secondary"
                onClick={exportCSV}
              >
                {tApp("exportCSV")}
              </button>

              <button
                className="btn btn-secondary"
                onClick={exportMasters}
              >
                {tApp("exportMasters")}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => saveLocal(true)}
              >
                {tApp("saveDevice")}
              </button>

              <button
                className="btn btn-primary"
                onClick={saveInvoiceToSupabase}
                disabled={isViewerRole}
                title={
                  isViewerRole
                    ? tUi("viewerReadOnlyAction")
                    : undefined
                }
              >
                {tApp("saveSupabase")}
              </button>

              <button
                className="btn btn-danger"
                onClick={() => {
                  if (
                    confirm(
                      tApp("clearAIConfirm")
                    )
                  ) {
                    setInventory([]);

                    const scopedKey =
                      companyScopedStorageKey(
                        "bon_pinard_ai_inventory_server",
                        currentCompanyId
                      );

                    if (scopedKey) {
                      localStorage.removeItem(
                        scopedKey
                      );
                    }
                  }
                }}
              >
                {tApp("clearAI")}
              </button>
            </div>

            <div className="mt-3 max-h-[520px] overflow-y-auto rounded-xl border border-stone-200 bg-white">
  {inventory.length === 0 ? (
    <div className="p-6 text-center text-sm text-stone-500">
      {tApp("noAIResults")}
    </div>
  ) : (
    inventory.map((r, i) => (
      <div
        key={i}
        className={`border-b border-stone-200 p-2 last:border-b-0 ${
          r.status === "NEEDS_CHECK" ? "bg-amber-50" : ""
        }`}
      >
        {/* 1段目：伝票情報 */}
        <div className="grid grid-cols-12 gap-2 items-end">
          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("status")}
            </div>

            <select
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.status}
              disabled={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "status",
                  e.target.value as StatusCode
                )
              }
            >
              <option value="CONFIRMED">
                {tApp("statusConfirmed")}
              </option>

              <option value="NEEDS_CHECK">
                {tApp("statusNeedsCheck")}
              </option>

              <option value="MANUAL">
                {tApp("statusManual")}
              </option>
            </select>
          </label>

          <div className="col-span-1">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("action")}
            </div>

            <button
              className="btn btn-danger !h-8 !px-2 !py-1 text-xs w-full"
              onClick={() => removeRow(i)}
              disabled={isViewerRole}
              title={
                isViewerRole
                  ? tUi("viewerReadOnlyAction")
                  : undefined
              }
            >
              {tApp("delete")}
            </button>
          </div>

          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("stockDate")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              type="date"
              value={r.date}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "date",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("invoiceNumber")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.invoiceNo}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "invoiceNo",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-5">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("supplier")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.supplier}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "supplier",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* 2段目：ワイン名 */}
        <div className="mt-2 grid grid-cols-12 gap-2 items-end">
          <label className="col-span-4">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("producer")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.producer}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "producer",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-5">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("cuvee")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.cuvee}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "cuvee",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-3">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("originalProductName")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.raw}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "raw",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* 3段目：数量・価格など */}
        <div className="mt-2 grid grid-cols-12 gap-2 items-end">
          <label className="col-span-1">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("color")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.color}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "color",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("vintage")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.vintage}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "vintage",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-1">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("bottleSize")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              type="number"
              value={r.size}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "size",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-1">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("alcohol")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.alcohol}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "alcohol",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-1">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("quantity")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              type="number"
              value={r.qty}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "qty",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("unitPriceHT")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              type="number"
              value={r.unit}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "unit",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("amountHT")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              type="number"
              value={r.amount}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "amount",
                  e.target.value
                )
              }
            />
          </label>

          <label className="col-span-2">
            <div className="mb-1 text-[9px] font-semibold text-stone-500">
              {tApp("memo")}
            </div>

            <input
              className="input !h-8 !px-2 !py-1 text-xs w-full"
              value={r.memo}
              readOnly={isViewerRole}
              onChange={(e) =>
                update(
                  i,
                  "memo",
                  e.target.value
                )
              }
            />
          </label>
        </div>
      </div>
    ))
  )}
</div>
          </div>
        </div>
      </section>
          <section className="card mt-4 p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="text-xl font-bold">
        {tApp("section4Title")}
      </h2>

      <p className="mt-1 text-sm text-stone-600">
        {tApp("section4Description")}
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        className="btn btn-secondary"
        onClick={loadCloudInventory}
      >
        {tApp("refreshInventory")}
      </button>

      <button
        className="btn btn-primary"
        onClick={classifyInventoryTest}
        disabled={classifyingWines || isViewerRole}
        title={
          isViewerRole
            ? tUi("viewerReadOnlyAction")
            : undefined
        }
      >
        {classifyingWines
          ? tApp("classifying")
          : tApp("classifyTest")}
      </button>

      <button
        className="btn btn-primary"
        onClick={classifyAllInventory}
        disabled={classifyingWines || isViewerRole}
        title={
          isViewerRole
            ? tUi("viewerReadOnlyAction")
            : undefined
        }
      >
        {classifyingWines
          ? tApp("classifying")
          : tApp("classifyAll")}
      </button>
    </div>
  </div>

  {classificationStatus && (
    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
      {tApp(
        classificationStatus.key,
        classificationStatus.params
      )}
    </div>
  )}

  {wineClassifications.length > 0 && (
  <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white xl:overflow-x-visible">
    <table className="w-full min-w-[1280px] table-fixed text-[11px] xl:min-w-0">
      <colgroup>
        <col style={{ width: "9%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "4%" }} />
        <col style={{ width: "5%" }} />
        <col style={{ width: "9%" }} />
        <col style={{ width: "9%" }} />
        <col style={{ width: "13%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "7%" }} />
        <col style={{ width: "6%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "9%" }} />
      </colgroup>

      <thead className="bg-stone-100 text-left text-[10px] leading-tight text-stone-600">
        <tr>
          <th className="px-1.5 py-2 align-bottom">
            {tApp("producer")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("wineName")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("vintage")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("country")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("region")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("subregion")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("appellation")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            Climat / Lieu-dit
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("cruLevel")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("category")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("action")}
          </th>

          <th className="px-1.5 py-2 align-bottom">
            {tApp("memo")}
          </th>
        </tr>
      </thead>

      <tbody>
        {wineClassifications.map((c) => {
  const sourceWine = allInventory.find(
    (r) => r.wineId === c.wine_id
  );

  const confirmed =
    confirmedWineIds.includes(c.wine_id);

  const saving =
    savingClassificationWineIds.includes(c.wine_id);

  return (
            <tr
              key={c.wine_id}
              className="border-t border-stone-100"
            >
              <td className="break-words px-1.5 py-1.5 align-top font-semibold leading-tight">
                {sourceWine?.producer || ""}
              </td>

              <td
                className="break-words px-1.5 py-1.5 align-top leading-tight"
                title={sourceWine?.cuvee || sourceWine?.raw || ""}
              >
                {sourceWine?.cuvee || sourceWine?.raw || ""}
              </td>

              <td className="px-1 py-1.5 text-center align-top tabular-nums">
                {sourceWine?.vintage || ""}
              </td>

              <td className="px-1 py-1.5 align-top">
                <input
                  className="input !h-8 w-full min-w-0 !px-1.5 !py-1 text-[11px]"
                  value={c.country}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "country",
                      e.target.value
                    )
                  }
                />
              </td>

              <td className="px-1 py-1.5 align-top">
                <input
                  className="input !h-8 w-full min-w-0 !px-1.5 !py-1 text-[11px]"
                  value={c.region}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "region",
                      e.target.value
                    )
                  }
                />
              </td>

              <td className="px-1 py-1.5 align-top">
                <input
                  className="input !h-8 w-full min-w-0 !px-1.5 !py-1 text-[11px]"
                  value={c.subregion}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "subregion",
                      e.target.value
                    )
                  }
                />
              </td>

              <td className="px-1 py-1.5 align-top">
                <input
                  className="input !h-8 w-full min-w-0 !px-1.5 !py-1 text-[11px]"
                  value={c.appellation}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "appellation",
                      e.target.value
                    )
                  }
                />
              </td>

              <td className="px-1 py-1.5 align-top">
                <input
                  className="input !h-8 w-full min-w-0 !px-1.5 !py-1 text-[11px]"
                  value={c.climat}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "climat",
                      e.target.value
                    )
                  }
                />
              </td>

              <td className="px-1 py-1.5 align-top">
                <select
                  className="input !h-8 w-full min-w-0 !px-1 !py-1 text-[10px]"
                  value={c.cru_level}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "cru_level",
                      e.target.value
                    )
                  }
                >
                  <option value="GRAND_CRU">
                    Grand Cru
                  </option>

                  <option value="PREMIER_CRU">
                    1er Cru
                  </option>

                  <option value="VILLAGE">
                    Village
                  </option>

                  <option value="REGIONAL">
                    Régional
                  </option>

                  <option value="NONE">
                    —
                  </option>

                  <option value="UNKNOWN">
                    {tApp("needsReview")}
                  </option>
                </select>
              </td>

              <td className="px-1 py-1.5 align-top">
                <select
                  className="input !h-8 w-full min-w-0 !px-1 !py-1 text-[10px]"
                  value={c.category}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "category",
                      e.target.value
                    )
                  }
                >
                  <option value="SPARKLING">
                    {tApp("categorySparkling")}
                  </option>

                  <option value="WHITE">
                    {tApp("categoryWhite")}
                  </option>

                  <option value="ROSE">
                    {tApp("categoryRose")}
                  </option>

                  <option value="RED">
                    {tApp("categoryRed")}
                  </option>

                  <option value="SPIRIT">
                    {tApp("categorySpirit")}
                  </option>

                  <option value="UNKNOWN">
                    {tApp("needsReview")}
                  </option>
                </select>
              </td>

              <td className="px-1 py-1.5 align-top">
                <button
                  type="button"
                  className="btn btn-primary min-h-8 w-full whitespace-normal !px-0.5 !py-1 text-[9px] leading-tight"
                  onClick={() =>
                    confirmWineClassification(
                      c.wine_id
                    )
                  }
                  disabled={
                    saving ||
                    confirmed ||
                    isViewerRole
                  }
                  title={
                    isViewerRole
                      ? tUi("viewerReadOnlyAction")
                      : undefined
                  }
                >
                  {saving
                    ? tApp("saving")
                    : confirmed
                      ? tApp("saved")
                      : tApp("markConfirmed")}
                </button>
              </td>

<td className="px-1 py-1.5 align-top">
  <input
                  className="input !h-8 w-full min-w-0 !px-1.5 !py-1 text-[11px]"
                  value={c.notes}
                  title={c.notes}
                  onChange={(e) =>
                    updateWineClassification(
                      c.wine_id,
                      "notes",
                      e.target.value
                    )
                  }
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
  <div className="mt-4 grid gap-3 md:grid-cols-3">
    <div className="rounded-xl bg-stone-50 p-4">
      {tApp("wineTypes")}
      <br />
      <b className="text-2xl">
        {allInventory.length}
      </b>
    </div>

    <div className="rounded-xl bg-stone-50 p-4">
      {tApp("currentStockBottles")}
      <br />
      <b className="text-2xl">
        {allInventoryQty}
      </b>
    </div>

    <div className="rounded-xl bg-stone-50 p-4">
      {tApp("inventoryCostHT")}
      <br />
      <b className="text-2xl">
        {allInventoryHT.toFixed(2)} €
      </b>
    </div>
  </div>

  <div className="mt-4 flex flex-wrap gap-2">
    <input
      className="input min-w-[220px] flex-1"
      placeholder={tApp(
        "inventorySearchPlaceholder"
      )}
      value={inventorySearch}
      onChange={(e) =>
        setInventorySearch(
          e.target.value
        )
      }
    />

    <select
      className="input"
      value={inventorySortMode}
      onChange={(e) =>
        setInventorySortMode(
          e.target
            .value as typeof inventorySortMode
        )
      }
      aria-label={tUi(
        "inventorySortLabel"
      )}
    >
      <option value="PRODUCER_ASC">
        {tUi(
          "inventorySortProducerAsc"
        )}
      </option>

      <option value="VINTAGE_DESC">
        {tUi(
          "inventorySortVintageDesc"
        )}
      </option>

      <option value="VINTAGE_ASC">
        {tUi(
          "inventorySortVintageAsc"
        )}
      </option>

      <option value="QTY_ASC">
        {tUi("inventorySortQtyAsc")}
      </option>

      <option value="QTY_DESC">
        {tUi("inventorySortQtyDesc")}
      </option>

      <option value="COST_DESC">
        {tUi("inventorySortCostDesc")}
      </option>

      <option value="COST_ASC">
        {tUi("inventorySortCostAsc")}
      </option>
    </select>

    <select
      className="input"
      value={inventoryStockFilter}
      onChange={(e) =>
        setInventoryStockFilter(
          e.target
            .value as typeof inventoryStockFilter
        )
      }
      aria-label={tUi(
        "inventoryFilterLabel"
      )}
    >
      <option value="ALL">
        {tUi("inventoryFilterAll")}
      </option>

      <option value="IN_STOCK">
        {tUi(
          "inventoryFilterInStock"
        )}
      </option>

      <option value="ZERO">
        {tUi("inventoryFilterZero")}
      </option>

      <option value="ONE">
        {tUi("inventoryFilterOne")}
      </option>

      <option value="TWO_OR_FEWER">
        {tUi(
          "inventoryFilterTwoOrFewer"
        )}
      </option>
    </select>

    {/*
      0在庫も表示トグル。owner/staff/viewerいずれも
      閲覧目的でON/OFF可能（read-onlyの表示切り替えのため
      isViewerRoleでの制限はしない。編集自体は従来通り
      viewerでは行えない）。
    */}
    <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
      <input
        type="checkbox"
        checked={showZeroStockInventory}
        onChange={(e) =>
          setShowZeroStockInventory(
            e.target.checked
          )
        }
      />
      {tUi("inventoryShowZeroStock")}
    </label>

    {/*
      確認済みを非表示トグル。0在庫も表示と同様、表示切り替えのみの
      ためviewerも操作可能（確認状態の変更自体はowner/staffのみ）。
    */}
    <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
      <input
        type="checkbox"
        checked={hideCheckedInventory}
        onChange={(e) =>
          setHideCheckedInventory(
            e.target.checked
          )
        }
      />
      {tUi("inventoryHideChecked")}
    </label>
  </div>

  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
    <span>
      {tApp("displayed")}{" "}
      {displayedInventoryList.length}
      {" / "}
      {allInventory.length}{" "}
      {tApp("wineTypesUnit")}
    </span>

    <span className="font-semibold text-amber-700">
      {tUi("inventoryStocktakeUncheckedCount", {
        count: inventoryStocktakeUncheckedCount,
      })}
    </span>

    <span className="font-semibold text-emerald-700">
      {tUi("inventoryStocktakeCheckedCount", {
        count: inventoryStocktakeCheckedCount,
      })}
    </span>

    {/*
      確認済みをすべて解除（次回棚卸の開始用）。owner/staffのみ表示。
      確認済みマークだけを消し、在庫数量・移動履歴は変更しない。
    */}
    {!isViewerRole && (
      <button
        type="button"
        className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
        onClick={() =>
          void resetAllInventoryStocktakeChecks()
        }
        disabled={
          resettingStocktakeChecks ||
          Object.keys(stocktakeCheckedAtByWineId)
            .length === 0
        }
      >
        {tUi("inventoryStocktakeResetAll")}
      </button>
    )}
  </div>

  <div className="mt-3 max-h-[700px] overflow-y-auto rounded-xl border border-stone-200 bg-white">
    <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-600">
      <div className="col-span-3">
        {tApp("producer")}
      </div>

      <div className="col-span-3">
        {tApp("cuveeWineName")}
      </div>

      <div className="col-span-1">
        {tApp("vintage")}
      </div>

      <div className="col-span-1">
        {tApp("color")}
      </div>

      <div className="col-span-1">
        {tApp("bottleSize")}
      </div>

      <div className="col-span-1 text-right">
        {tApp("quantity")}
      </div>

      <div className="col-span-1 text-right">
        {tApp("costHT")}
      </div>

      <div className="col-span-1 text-right">
        {tUi("inventoryEdit")}
      </div>
    </div>

    {displayedInventoryList.length === 0 ? (
      <div className="p-6 text-center text-sm text-stone-500">
        {tApp("noMatchingInventory")}
      </div>
    ) : (
      displayedInventoryList.map((r, i) => {
        const isEditing =
          Boolean(
            r.wineId &&
            editingInventoryWineId ===
              r.wineId
          );

        const currentQty =
          Number(r.qty || 0);

        const nextQty =
          inventoryEditDraft
            ? Number(
                inventoryEditDraft.quantity
              )
            : currentQty;

        const difference =
          Number.isFinite(nextQty)
            ? nextQty - currentQty
            : 0;

        const isDirty = Boolean(
          isEditing &&
            inventoryEditDraft &&
            inventoryEditOriginalDraft &&
            JSON.stringify(
              inventoryEditDraft
            ) !==
              JSON.stringify(
                inventoryEditOriginalDraft
              )
        );

        const rowHighlight = isEditing
          ? isDirty
            ? "border-amber-300 bg-amber-50/50"
            : "border-amber-200 bg-amber-50/20"
          : "";

        const stocktakeCheckedAt =
          r.wineId
            ? stocktakeCheckedAtByWineId[r.wineId]
            : undefined;

        const isStocktakeChecked =
          stocktakeCheckedAt !== undefined;

        const isSavingStocktake = Boolean(
          r.wineId &&
            savingStocktakeWineId === r.wineId
        );

        const stocktakeCheckedTitle =
          isStocktakeChecked
            ? tUi("inventoryStocktakeCheckedBadge", {
                date: stocktakeCheckedAt
                  ? new Date(
                      stocktakeCheckedAt
                    ).toLocaleString()
                  : "",
              })
            : undefined;

        const qtyColor =
          currentQty === 0
            ? "text-red-600"
            : currentQty === 1
              ? "text-amber-600"
              : "text-stone-800";

        /*
         * 数量が変わる場合だけ調整理由を必須にする。
         * 「その他」を選んだ場合はメモも必須。
         */
        const quantityChangedForReason =
          isEditing &&
          inventoryEditDraft &&
          nextQty !== currentQty;

        const reasonMissing = Boolean(
          quantityChangedForReason &&
            !inventoryEditDraft?.reason.trim()
        );

        const otherNoteMissing = Boolean(
          quantityChangedForReason &&
            inventoryEditDraft?.reason.trim() ===
              "OTHER" &&
            !inventoryEditDraft?.note.trim()
        );

        const showReasonError = Boolean(
          isEditing &&
            inventoryEditReasonError &&
            reasonMissing
        );

        const showOtherNoteError = Boolean(
          isEditing &&
            inventoryEditReasonError &&
            otherNoteMissing
        );

        return (
          <div
            key={`${r.wineId || ""}-${r.producer}-${r.vintage}-${i}`}
            className={
              "border-b border-stone-100 last:border-b-0" +
              (rowHighlight
                ? " " + rowHighlight
                : "")
            }
          >
            <div className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-[11px]">
              <div className="col-span-3 truncate font-semibold">
                {isStocktakeChecked && (
                  <span
                    className="mr-1 font-bold text-emerald-600"
                    title={stocktakeCheckedTitle}
                    aria-label={stocktakeCheckedTitle}
                  >
                    ✓
                  </span>
                )}
                {r.producer}
              </div>

              <div
                className="col-span-3 truncate"
                title={r.raw || r.cuvee}
              >
                {r.cuvee || r.raw}
              </div>

              <div className="col-span-1">
                {r.vintage}
              </div>

              <div className="col-span-1">
                {r.color}
              </div>

              <div className="col-span-1">
                {r.size} cl
              </div>

              <div
                className={
                  "col-span-1 text-right text-sm font-extrabold " +
                  qtyColor
                }
              >
                {r.qty}
              </div>

              <div className="col-span-1 text-right">
                {r.unit.toFixed(2)}
              </div>

              <div className="col-span-1 flex flex-col items-end gap-1">
                {/*
                  在庫確認済み/取消。owner/staffのみ操作可能。
                  viewerは生産者名の前の✓で状態を表示するだけ。
                */}
                {!isViewerRole && r.wineId && (
                  <button
                    type="button"
                    className={
                      "whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 " +
                      (isStocktakeChecked
                        ? "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                        : "border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50")
                    }
                    onClick={() =>
                      void setInventoryStocktakeChecked(
                        r.wineId as string,
                        !isStocktakeChecked
                      )
                    }
                    disabled={
                      isSavingStocktake || isEditing
                    }
                    title={stocktakeCheckedTitle}
                  >
                    {isStocktakeChecked
                      ? tUi("inventoryStocktakeUndoCheck")
                      : tUi("inventoryStocktakeMarkChecked")}
                  </button>
                )}

                <button
                  type="button"
                  className={
                    "rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors " +
                    (isEditing
                      ? "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                      : !isEditing && isViewerRole
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 opacity-60"
                        : "border-stone-300 bg-stone-800 text-white hover:bg-stone-900")
                  }
                  onClick={() =>
                    isEditing
                      ? cancelInventoryEdit()
                      : startInventoryEdit(r)
                  }
                  disabled={
                    !isEditing && isViewerRole
                  }
                  title={
                    !isEditing && isViewerRole
                      ? tUi("viewerReadOnlyAction")
                      : undefined
                  }
                >
                  {isEditing
                    ? tUi("inventoryEditCancel")
                    : tUi("inventoryEdit")}
                </button>
              </div>
            </div>

            {isEditing &&
              inventoryEditDraft && (
                <div
                  className="border-t border-stone-200 bg-stone-50 px-3 py-3"
                  onKeyDown={(e) => {
                    if (
                      e.nativeEvent.isComposing
                    ) {
                      return;
                    }

                    const target =
                      e.target as HTMLElement;
                    const tagName =
                      target.tagName;

                    if (
                      e.key === "Enter" &&
                      tagName !== "TEXTAREA" &&
                      tagName !== "SELECT"
                    ) {
                      e.preventDefault();
                      if (
                        !savingInventoryEdit
                      ) {
                        saveInventoryEdit(r);
                      }
                    }

                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelInventoryEdit();
                    }
                  }}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="text-sm font-bold text-stone-800">
                      {tUi("inventoryEditTitle")}
                    </div>

                    {isDirty && (
                      <span className="rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {tUi(
                          "inventoryEditUnsavedBadge"
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("producer")}
                      </div>
                      <input
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.producer}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    producer:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>

                    <label className="md:col-span-2">
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("wineName")}
                      </div>
                      <input
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.wineName}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    wineName:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("cuvee")}
                      </div>
                      <input
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.cuvee}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    cuvee:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("vintage")}
                      </div>
                      <input
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.vintage}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    vintage:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("color")}
                      </div>
                      <input
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.color}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    color:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("bottleSize")}
                      </div>
                      <input
                        type="number"
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.size}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    size:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tApp("alcohol")}
                      </div>
                      <input
                        className="input !h-8 w-full !px-2 !py-1 text-xs"
                        value={inventoryEditDraft.alcohol}
                        onChange={(e) =>
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    alcohol:
                                      e.target.value,
                                  }
                                : prev
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-5">
                    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-semibold text-stone-500">
                        {tUi("inventoryEditCurrentQty")}
                      </div>
                      <div className="text-lg font-bold">
                        {currentQty}
                      </div>
                    </div>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tUi("inventoryEditNewQty")}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="!h-9 !w-9 shrink-0 rounded-lg border border-stone-300 bg-white text-base font-bold text-stone-700 hover:bg-stone-100"
                          onClick={() =>
                            setInventoryEditDraft(
                              (prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      quantity: String(
                                        Math.max(
                                          0,
                                          Math.round(
                                            Number(
                                              prev.quantity
                                            ) || 0
                                          ) - 1
                                        )
                                      ),
                                    }
                                  : prev
                            )
                          }
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="input !h-9 w-full !px-2 !py-1 text-center text-sm font-bold"
                          value={inventoryEditDraft.quantity}
                          onChange={(e) => {
                            const raw =
                              e.target.value;
                            setInventoryEditDraft(
                              (prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      quantity: raw,
                                    }
                                  : prev
                            );
                          }}
                        />

                        <button
                          type="button"
                          className="!h-9 !w-9 shrink-0 rounded-lg border border-stone-300 bg-white text-base font-bold text-stone-700 hover:bg-stone-100"
                          onClick={() =>
                            setInventoryEditDraft(
                              (prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      quantity: String(
                                        Math.round(
                                          Number(
                                            prev.quantity
                                          ) || 0
                                        ) + 1
                                      ),
                                    }
                                  : prev
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-semibold text-stone-500">
                        {tUi("inventoryEditDifference")}
                      </div>
                      <div
                        className={
                          "text-lg font-bold " +
                          (difference < 0
                            ? "text-red-700"
                            : difference > 0
                              ? "text-emerald-700"
                              : "text-stone-700")
                        }
                      >
                        {difference > 0
                          ? `+${difference}`
                          : difference}
                      </div>
                    </div>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tUi("inventoryEditReasonLabel")}
                        {quantityChangedForReason && (
                          <span className="ml-1 font-bold text-red-600">
                            {tUi(
                              "inventoryEditRequiredLabel"
                            )}
                          </span>
                        )}
                      </div>
                      <select
                        className={
                          "input !h-9 w-full !px-2 !py-1 text-xs " +
                          (showReasonError
                            ? "!border-red-400 focus:!border-red-400"
                            : "")
                        }
                        value={inventoryEditDraft.reason}
                        onChange={(e) => {
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    reason:
                                      e.target.value,
                                  }
                                : prev
                          );
                          setInventoryEditReasonError(
                            false
                          );
                        }}
                      >
                        <option value="">
                          {tUi(
                            "inventoryEditReasonSelect"
                          )}
                        </option>
                        <option value="INVENTORY_COUNT">
                          {tUi(
                            "inventoryReasonInventoryCount"
                          )}
                        </option>
                        <option value="SALE_CORRECTION">
                          {tUi(
                            "inventoryReasonSaleCorrection"
                          )}
                        </option>
                        <option value="BREAKAGE">
                          {tUi(
                            "inventoryReasonBreakage"
                          )}
                        </option>
                        <option value="LOSS">
                          {tUi(
                            "inventoryReasonLoss"
                          )}
                        </option>
                        <option value="TASTING_SERVICE">
                          {tUi(
                            "inventoryReasonTasting"
                          )}
                        </option>
                        <option value="PURCHASE_CORRECTION">
                          {tUi(
                            "inventoryReasonPurchaseCorrection"
                          )}
                        </option>
                        <option value="OTHER">
                          {tUi(
                            "inventoryReasonOther"
                          )}
                        </option>
                      </select>
                    </label>

                    <label>
                      <div className="mb-1 text-[10px] font-semibold text-stone-500">
                        {tUi("inventoryEditNote")}
                        {quantityChangedForReason &&
                          inventoryEditDraft.reason.trim() ===
                            "OTHER" && (
                            <span className="ml-1 font-bold text-red-600">
                              {tUi(
                                "inventoryEditRequiredLabel"
                              )}
                            </span>
                          )}
                      </div>
                      <input
                        className={
                          "input !h-9 w-full !px-2 !py-1 text-xs " +
                          (showOtherNoteError
                            ? "!border-red-400 focus:!border-red-400"
                            : "")
                        }
                        placeholder={tUi("inventoryEditNotePlaceholder")}
                        value={inventoryEditDraft.note}
                        onChange={(e) => {
                          setInventoryEditDraft(
                            (prev) =>
                              prev
                                ? {
                                    ...prev,
                                    note:
                                      e.target.value,
                                  }
                                : prev
                          );
                          setInventoryEditReasonError(
                            false
                          );
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={cancelInventoryEdit}
                      disabled={savingInventoryEdit}
                    >
                      {tUi("inventoryEditCancel")}
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        saveInventoryEdit(r)
                      }
                      disabled={
                        savingInventoryEdit ||
                        isViewerRole
                      }
                      title={
                        isViewerRole
                          ? tUi(
                              "viewerReadOnlyAction"
                            )
                          : undefined
                      }
                    >
                      {savingInventoryEdit
                        ? tUi("inventoryEditSaving")
                        : tUi("inventoryEditSave")}
                    </button>
                  </div>
                </div>
              )}
          </div>
        );
      })
    )}
  </div>
</section>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {tUi("section5Title")}
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              {tUi("section5Description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={extractCuveeForInventory}
              disabled={extractingCuvee || isViewerRole}
              title={
                isViewerRole
                  ? tUi("viewerReadOnlyAction")
                  : undefined
              }
            >
              {extractingCuvee
                ? tUi("cuveeExtracting")
                : tUi("cuveeExtractButton", {
                    total: section5TargetInventory.length,
                  })}
            </button>

            {cuveeSuggestions.some(
              (suggestion) =>
                suggestion.cuvee.trim() &&
                !confirmedCuveeWineIds.includes(
                  suggestion.wine_id
                )
            ) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={confirmValidCuveeSuggestions}
                disabled={
                  extractingCuvee ||
                  savingCuveeWineIds.length > 0 ||
                  isViewerRole
                }
                title={
                  isViewerRole
                    ? tUi("viewerReadOnlyAction")
                    : undefined
                }
              >
                {tUi("cuveeBulkSaveButton", {
                  total: cuveeSuggestions.filter(
                    (suggestion) =>
                      suggestion.cuvee.trim() &&
                      !confirmedCuveeWineIds.includes(
                        suggestion.wine_id
                      )
                  ).length,
                })}
              </button>
            )}
          </div>
        </div>

        {cuveeStatus && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
            {cuveeStatus}
          </div>
        )}

        {cuveeSuggestions.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="min-w-[1400px] w-full text-xs">
              <thead className="bg-stone-100 text-left text-stone-600">
                <tr>
                  <th className="px-3 py-2">{tApp("producer")}</th>
                  <th className="px-3 py-2">{tApp("wineName")}</th>
                  <th className="px-3 py-2">{tUi("currentCuvee")}</th>
                  <th className="px-3 py-2">{tUi("aiSuggestedCuvee")}</th>
                  <th className="px-3 py-2">{tApp("confidence")}</th>
                  <th className="px-3 py-2">{tApp("status")}</th>
                  <th className="px-3 py-2">{tApp("action")}</th>
                  <th className="px-3 py-2">{tApp("memo")}</th>
                </tr>
              </thead>

              <tbody>
                {cuveeSuggestions.map((c) => {
                  const sourceWine = allInventory.find(
                    (r) => r.wineId === c.wine_id
                  );

                  const manuallyEdited =
                    manuallyEditedCuveeWineIds.includes(
                      c.wine_id
                    );

                  const confirmed =
                    confirmedCuveeWineIds.includes(
                      c.wine_id
                    );

                  const saving =
                    savingCuveeWineIds.includes(c.wine_id);

                  return (
                    <tr
                      key={c.wine_id}
                      className="border-t border-stone-100"
                    >
                      <td className="px-3 py-2 font-semibold">
                        {sourceWine?.producer || ""}
                      </td>

                      <td className="px-3 py-2">
                        {sourceWine?.raw ||
                          sourceWine?.cuvee ||
                          ""}
                      </td>

                      <td className="px-3 py-2 text-stone-500">
                        {sourceWine?.cuvee || ""}
                      </td>

                      <td className="px-2 py-2">
                        <input
                          className="input !h-8 !px-2 !py-1 text-xs min-w-[200px]"
                          value={c.cuvee}
                          placeholder={tUi("noApplicable")}
                          readOnly={isViewerRole}
                          onChange={(e) =>
                            updateCuveeSuggestion(
                              c.wine_id,
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td className="px-3 py-2">
                        {(c.confidence * 100).toFixed(1)}%
                      </td>

                      <td className="px-3 py-2 font-semibold">
                        {confirmed
                          ? tApp("saved")
                          : manuallyEdited
                            ? tApp("manualCorrection")
                            : tUi("aiSuggestion")}
                      </td>

                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="btn btn-primary !h-8 whitespace-nowrap !px-3 !py-1 text-xs"
                          onClick={() =>
                            confirmCuveeSuggestion(c.wine_id)
                          }
                          disabled={
                            saving ||
                            confirmed ||
                            isViewerRole
                          }
                          title={
                            isViewerRole
                              ? tUi("viewerReadOnlyAction")
                              : undefined
                          }
                        >
                          {saving
                            ? tApp("saving")
                            : confirmed
                              ? tApp("saved")
                              : tUi("saveAction")}
                        </button>
                      </td>

                      <td className="px-3 py-2 text-stone-500">
                        {c.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-4 p-5">
        <div>
          <h2 className="text-xl font-bold">
            {tUi("section6Title")}
          </h2>

          <p className="mt-1 text-sm text-stone-600">
            {tUi("section6Description")}
          </p>
        </div>

        {mergeStatus && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
            {mergeStatus}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              setDuplicateViewFilter(
                duplicateViewFilter === "EXACT"
                  ? "ALL"
                  : "EXACT"
              )
            }
            className={
              "rounded-xl border p-4 text-left transition " +
              (duplicateViewFilter === "EXACT"
                ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300"
                : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100")
            }
          >
            <div className="text-sm font-semibold text-emerald-800">
              {tUi("exactMatch")}
            </div>

            <div className="mt-1 text-2xl font-bold text-emerald-900">
              {exactDuplicateCount}
              <span className="ml-1 text-sm font-normal">
                {tUi("countUnit")}
              </span>
            </div>

            {duplicateViewFilter === "EXACT" && (
              <div className="mt-1 text-xs font-semibold text-emerald-700">
                {tUi("filtering")}
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setDuplicateViewFilter(
                duplicateViewFilter === "HIGH"
                  ? "ALL"
                  : "HIGH"
              )
            }
            className={
              "rounded-xl border p-4 text-left transition " +
              (duplicateViewFilter === "HIGH"
                ? "border-amber-500 bg-amber-100 ring-2 ring-amber-300"
                : "border-amber-200 bg-amber-50 hover:bg-amber-100")
            }
          >
            <div className="text-sm font-semibold text-amber-800">
              {tUi("highProbability")}
            </div>

            <div className="mt-1 text-2xl font-bold text-amber-900">
              {highDuplicateCount}
              <span className="ml-1 text-sm font-normal">
                {tUi("countUnit")}
              </span>
            </div>

            {duplicateViewFilter === "HIGH" && (
              <div className="mt-1 text-xs font-semibold text-amber-700">
                {tUi("filtering")}
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setDuplicateViewFilter(
                duplicateViewFilter === "REVIEW"
                  ? "ALL"
                  : "REVIEW"
              )
            }
            className={
              "rounded-xl border p-4 text-left transition " +
              (duplicateViewFilter === "REVIEW"
                ? "border-stone-500 bg-stone-200 ring-2 ring-stone-300"
                : "border-stone-200 bg-stone-50 hover:bg-stone-100")
            }
          >
            <div className="text-sm font-semibold text-stone-700">
              {tApp("needsReview")}
            </div>

            <div className="mt-1 text-2xl font-bold text-stone-900">
              {reviewDuplicateCount}
              <span className="ml-1 text-sm font-normal">
                {tUi("countUnit")}
              </span>
            </div>

            {duplicateViewFilter === "REVIEW" && (
              <div className="mt-1 text-xs font-semibold text-stone-700">
                {tUi("filtering")}
              </div>
            )}
          </button>
        </div>

        {exactDuplicateCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={
                exactDuplicateReviewMode &&
                duplicateViewFilter === "EXACT"
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
              onClick={() => {
                if (
                  exactDuplicateReviewMode &&
                  duplicateViewFilter === "EXACT"
                ) {
                  setExactDuplicateReviewMode(false);
                  return;
                }

                setDuplicateViewFilter("EXACT");
                setExactDuplicateReviewMode(true);
              }}
            >
              {exactDuplicateReviewMode &&
              duplicateViewFilter === "EXACT"
                ? tUi("exactReviewRestore")
                : tUi("exactReviewStart")}
            </button>

            {exactDuplicateReviewMode &&
              duplicateViewFilter === "EXACT" && (
                <span className="text-sm text-stone-600">
                  {tUi("remaining", { total: exactDuplicateCount })}
                </span>
              )}
          </div>
        )}

        {displayedDuplicateWineGroups.length === 0 ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
            {duplicateViewFilter === "ALL"
              ? tUi("noPendingDuplicates")
              : tUi("noFilterDuplicates")}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {displayedDuplicateWineGroups.map((group) => (
              <div
                key={group.key}
                className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50"
              >
                <div className="px-3 py-2 text-xs font-bold text-amber-800">
                  {group.reference.producer || tUi("unknownProducer")}
                  {" ／ "}
                  {group.reference.vintage || tUi("nvBlank")}
                  {" ／ "}
                  {group.reference.size || 75} cl
                  <span className="ml-2 font-normal text-amber-700">
                    {tUi("candidates", { total: group.rows.length + 1 })}
                  </span>
                </div>

                <table className="min-w-[1000px] w-full text-xs">
                  <thead className="bg-white/60 text-left text-stone-600">
                    <tr>
                      <th className="px-3 py-2">{tUi("judgment")}</th>
                      <th className="px-3 py-2">{tApp("wineName")}</th>
                      <th className="px-3 py-2">{tApp("cuvee")}</th>
                      <th className="px-3 py-2 text-right">{tUi("stockQty")}</th>
                      <th className="px-3 py-2 text-right">{tUi("costPerBottle")}</th>
                      <th className="px-3 py-2">wine_id</th>
                      <th className="px-3 py-2">{tApp("action")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr className="border-t border-amber-100 bg-white">
                      <td className="px-3 py-2 font-semibold text-stone-500">
                        {tUi("reference")}
                      </td>
                      <td className="px-3 py-2">
                        {group.reference.raw}
                      </td>
                      <td className="px-3 py-2 text-stone-600">
                        {group.reference.cuvee}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {group.reference.qty}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {group.reference.unit.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-stone-400">
                        {group.reference.wineId}
                      </td>
                      <td className="px-3 py-2" />
                    </tr>

                    {group.rows.map((r, i) => {
                      const resolution =
                        (r.wineId &&
                          duplicateResolutions[r.wineId]) ||
                        "PENDING";

                      const merging = Boolean(
                        r.wineId && mergingWineIds.includes(r.wineId)
                      );

                      return (
                        <tr
                          key={r.wineId || i}
                          className={
                            "border-t border-amber-100 bg-white" +
                            (resolution === "DIFFERENT"
                              ? " opacity-40"
                              : "")
                          }
                        >
                          <td className="px-3 py-2 font-semibold">
                            <span
                              className={
                                r.duplicateConfidence === "HIGH"
                                  ? "text-emerald-700"
                                  : r.duplicateConfidence === "MEDIUM"
                                    ? "text-amber-700"
                                    : "text-stone-500"
                              }
                            >
                              {r.duplicateConfidence === "HIGH"
                                ? tUi("duplicateHigh")
                                : r.duplicateConfidence === "MEDIUM"
                                  ? tUi("duplicateMedium")
                                  : tUi("duplicateLow")}
                            </span>
                          </td>
                          <td className="px-3 py-2">{r.raw}</td>
                          <td className="px-3 py-2 text-stone-600">
                            {r.cuvee}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {r.qty}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.unit.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-stone-400">
                            {r.wineId}
                          </td>
                          <td className="px-2 py-2">
                            {resolution === "SAME" ? (
                              <span className="font-semibold text-emerald-700">
                                {tUi("merged")}
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="btn btn-primary !h-7 whitespace-nowrap !px-2 !py-1 text-[11px]"
                                  disabled={
                                    merging ||
                                    !isOwnerRole
                                  }
                                  title={
                                    isOwnerRole
                                      ? undefined
                                      : tUi(
                                          "ownerOnlyAction"
                                        )
                                  }
                                  onClick={() =>
                                    handleMergeDuplicate(
                                      group.reference,
                                      r,
                                      r.duplicateSimilarity,
                                      r.duplicateConfidence
                                    )
                                  }
                                >
                                  {merging
                                    ? tUi("merging")
                                    : tUi("mergeSameWine")}
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary !h-7 whitespace-nowrap !px-2 !py-1 text-[11px]"
                                  disabled={
                                    merging || isViewerRole
                                  }
                                  title={
                                    isViewerRole
                                      ? tUi(
                                          "viewerReadOnlyAction"
                                        )
                                      : undefined
                                  }
                                  onClick={() =>
                                    void saveDuplicateDifferentDecision(
                                      group.reference,
                                      r,
                                      resolution !== "DIFFERENT"
                                    )
                                  }
                                >
                                  {resolution === "DIFFERENT"
                                    ? tUi("cancelDifferentWine")
                                    : tUi("differentWine")}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

            <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {tUi("section7Title")}
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              {tUi("section7Description")}
            </p>
          </div>

          {wineListDisplayMode === "MANAGE" && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                loadWineList("MANAGE")
              }
              disabled={wineListLoading}
            >
              {wineListLoading
                ? tUi("loadingShort")
                : tUi("refreshWineList")}
            </button>
          )}

          {wineListDisplayMode === "CUSTOMER" && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                className="btn btn-primary"
                onClick={printWineListA4}
              >
                {tUi("wineListA4PdfPrint")}
              </button>

              <div className="max-w-[380px] text-right text-[11px] text-stone-500">
                {tUi("wineListA4PdfHint")}
              </div>
            </div>
          )}
        </div>

        {wineListDisplayMode === "MANAGE" &&
          wineListStatus && (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
              {wineListStatus}
            </div>
          )}

        {wineListDisplayMode === "MANAGE" && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-stone-50 p-4">
              {tUi("allData")}
              <br />
              <b className="text-2xl">
                {wineList.length}
              </b>
            </div>

            <div className="rounded-xl bg-stone-50 p-4">
              {tUi("listedWines")}
              <br />
              <b className="text-2xl">
                {listedWineList.length}
              </b>
            </div>

            <div className="rounded-xl bg-stone-50 p-4">
              {tUi("unlistedWines")}
              <br />
              <b className="text-2xl">
                {unlistedWineList.length}
              </b>
            </div>
          </div>
        )}

        {/*
          要確認 / 未分類。MANAGEモードのみ表示。
          自動判定結果はUI stateのみで、「一括保存」を押すまでDBは変更しない。
          owner/staffのみ判定・保存可能。viewerは対象一覧の閲覧のみ。
        */}
        {wineListDisplayMode === "MANAGE" &&
          (wineReviewTargets.length > 0 ||
            wineReviewCandidates.length > 0) && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-amber-900">
                    {tUi("wineReviewTitle")}{" "}
                    {wineReviewTargets.length}
                  </div>

                  <div className="mt-1 text-xs text-amber-800">
                    {tUi("wineReviewSummary", {
                      count: wineReviewTargets.length,
                    })}
                  </div>
                </div>

                {!isViewerRole && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        void autoClassifyWineReviewTargets()
                      }
                      disabled={
                        wineReviewClassifying ||
                        wineReviewSaving ||
                        wineReviewTargets.length === 0
                      }
                    >
                      {wineReviewClassifying
                        ? tUi("loadingShort")
                        : tUi("wineReviewAutoClassify")}
                    </button>
                  </div>
                )}
              </div>

              {wineReviewStatus && (
                <div className="mt-3 whitespace-pre-line rounded-lg border border-amber-200 bg-white p-2 text-xs text-stone-700">
                  {wineReviewStatus}
                </div>
              )}

              {wineReviewCandidates.length === 0 ? (
                <div className="mt-3 max-h-[240px] overflow-y-auto rounded-lg border border-amber-200 bg-white">
                  {wineReviewTargets.map((row) => (
                    <div
                      key={`review-target-${row.wine_id}`}
                      className="grid grid-cols-12 gap-2 border-b border-stone-100 px-3 py-1.5 text-[11px] last:border-b-0"
                    >
                      <div className="col-span-3 truncate font-semibold">
                        {row.producer}
                      </div>
                      <div
                        className="col-span-5 truncate"
                        title={row.wine_name || row.cuvee}
                      >
                        {row.wine_name || row.cuvee}
                      </div>
                      <div className="col-span-1">
                        {row.vintage}
                      </div>
                      <div className="col-span-3 truncate text-stone-500">
                        {row.hasClassification
                          ? `${row.region || "—"} / ${wineCategoryLabel(row.category)}`
                          : tUi("wineListUnclassified")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-3 max-h-[520px] overflow-y-auto rounded-lg border border-amber-200 bg-white">
                    <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-600">
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          aria-label={tUi("wineReviewSelectAll")}
                          title={tUi("wineReviewSelectAll")}
                          disabled={isViewerRole || wineReviewSaving}
                          checked={wineReviewCandidates
                            .filter(isWineReviewCandidateSavable)
                            .every((c) => c.selected)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setWineReviewCandidates((prev) =>
                              prev.map((c) =>
                                isWineReviewCandidateSavable(c)
                                  ? { ...c, selected: checked }
                                  : c
                              )
                            );
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        {tApp("producer")}
                      </div>
                      <div className="col-span-3">
                        {tApp("cuveeWineName")}
                      </div>
                      <div className="col-span-1">
                        {tApp("vintage")}
                      </div>
                      <div className="col-span-2">
                        {tUi("wineReviewRegion")}
                      </div>
                      <div className="col-span-2">
                        {tUi("wineReviewCategory")}
                      </div>
                      <div className="col-span-1">
                        {tUi("wineReviewSource")}
                      </div>
                    </div>

                    {wineReviewCandidates.map((c) => {
                      const savable =
                        isWineReviewCandidateSavable(c);

                      const sourceLabel = (
                        source:
                          | WineReviewCandidate["regionSource"]
                          | WineReviewCandidate["categorySource"]
                      ) =>
                        source === "COLOR"
                          ? tUi("wineReviewSourceColor")
                          : source === "RULE"
                            ? tUi("wineReviewSourceRule")
                            : source === "AI"
                              ? tUi("wineReviewSourceAi")
                              : source === "EXISTING"
                                ? tUi("wineReviewSourceExisting")
                                : tUi("wineReviewSourceNone");

                      return (
                        <div
                          key={`review-candidate-${c.wine_id}`}
                          className={
                            "grid grid-cols-12 items-center gap-2 border-b border-stone-100 px-3 py-1.5 text-[11px] last:border-b-0" +
                            (savable ? "" : " bg-red-50/60")
                          }
                        >
                          <div className="col-span-1">
                            <input
                              type="checkbox"
                              checked={c.selected && savable}
                              disabled={
                                isViewerRole ||
                                wineReviewSaving ||
                                !savable
                              }
                              title={
                                savable
                                  ? undefined
                                  : tUi("wineReviewIncomplete")
                              }
                              onChange={(e) =>
                                updateWineReviewCandidate(
                                  c.wine_id,
                                  { selected: e.target.checked }
                                )
                              }
                            />
                          </div>

                          <div className="col-span-2 truncate font-semibold">
                            {c.producer}
                            {c.hadClassification && (
                              <div className="text-[9px] font-normal text-stone-500">
                                {tUi("wineReviewExistingRow")}
                              </div>
                            )}
                          </div>

                          <div
                            className="col-span-3 truncate"
                            title={[c.wine_name, c.color]
                              .filter(Boolean)
                              .join(" / ")}
                          >
                            {c.wine_name || c.cuvee}
                            {c.color && (
                              <div className="text-[9px] text-stone-500">
                                {c.color}
                              </div>
                            )}
                          </div>

                          <div className="col-span-1">
                            {c.vintage}
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              className="input w-full px-2 py-1 text-[11px]"
                              list="wine-review-region-options"
                              value={c.region}
                              readOnly={isViewerRole}
                              disabled={wineReviewSaving}
                              onChange={(e) =>
                                updateWineReviewCandidate(
                                  c.wine_id,
                                  { region: e.target.value }
                                )
                              }
                            />
                          </div>

                          <div className="col-span-2">
                            <select
                              className="input w-full px-2 py-1 text-[11px]"
                              value={c.category}
                              disabled={
                                isViewerRole ||
                                wineReviewSaving
                              }
                              onChange={(e) =>
                                updateWineReviewCandidate(
                                  c.wine_id,
                                  {
                                    category: e.target
                                      .value as WineClassification["category"],
                                  }
                                )
                              }
                            >
                              {wineCategoryOrder.map(
                                (category) => (
                                  <option
                                    key={category}
                                    value={category}
                                  >
                                    {wineCategoryLabel(category)}
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          <div className="col-span-1 text-[9px] leading-tight text-stone-500">
                            {c.edited ? (
                              <span className="font-bold text-amber-700">
                                ✎
                              </span>
                            ) : (
                              <>
                                <div>
                                  {tUi("wineReviewRegion")}:{" "}
                                  {sourceLabel(c.regionSource)}
                                </div>
                                <div>
                                  {tUi("wineReviewCategory")}:{" "}
                                  {sourceLabel(c.categorySource)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <datalist id="wine-review-region-options">
                    {Array.from(
                      new Set([
                        ...wineListRegions,
                        "Bourgogne",
                        "Champagne",
                        "Bordeaux",
                        "Rhone",
                        "Loire",
                        "Alsace",
                        "Jura",
                        "Beaujolais",
                        "Provence",
                        "Languedoc-Roussillon",
                        "Sud-Ouest",
                      ])
                    ).map((region) => (
                      <option
                        key={region}
                        value={region}
                      />
                    ))}
                  </datalist>

                  {!isViewerRole && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          void saveWineReviewCandidates()
                        }
                        disabled={
                          wineReviewSaving ||
                          wineReviewClassifying ||
                          wineReviewSavableSelectedCount === 0
                        }
                      >
                        {wineReviewSaving
                          ? tApp("saving")
                          : tUi("wineReviewSaveSelected", {
                              count:
                                wineReviewSavableSelectedCount,
                            })}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setWineReviewCandidates([]);
                          setWineReviewStatus("");
                        }}
                        disabled={wineReviewSaving}
                      >
                        {tUi("wineReviewDiscard")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        {/*
          価格未設定。MANAGEモードのみ表示。
          価格(sale_price)だけを保存し、掲載/非掲載は変更しない。
          owner/staffのみ編集・保存可能。viewerは閲覧のみ。
        */}
        {wineListDisplayMode === "MANAGE" &&
          wineList.length > 0 && (
            <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 p-4">
              <div className="text-sm font-bold text-sky-900">
                {tUi("winePricingTitle")} {pricingUnsetCount}
              </div>

              <div className="mt-1 text-xs text-sky-800">
                {tUi("winePricingSummary", {
                  count: pricingUnsetCount,
                })}
              </div>

              <div className="mt-1 text-[11px] text-sky-700">
                {tUi("winePricingRuleHint")}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={pricingOnlyUnpriced}
                    onChange={(e) =>
                      setPricingOnlyUnpriced(e.target.checked)
                    }
                  />
                  {tUi("winePricingOnlyUnpriced")}
                </label>

                <select
                  className="input"
                  value={pricingListingFilter}
                  onChange={(e) =>
                    setPricingListingFilter(
                      e.target.value as typeof pricingListingFilter
                    )
                  }
                >
                  <option value="ALL">
                    {tUi("winePricingListingAll")}
                  </option>
                  <option value="LISTED">
                    {tUi("winePricingListingListed")}
                  </option>
                  <option value="UNLISTED">
                    {tUi("winePricingListingUnlisted")}
                  </option>
                </select>

                <select
                  className="input"
                  value={pricingRegionFilter}
                  onChange={(e) =>
                    setPricingRegionFilter(e.target.value)
                  }
                >
                  <option value="ALL">
                    {tUi("winePricingRegionAll")}
                  </option>
                  {pricingRegionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={pricingCategoryFilter}
                  onChange={(e) =>
                    setPricingCategoryFilter(
                      e.target.value as typeof pricingCategoryFilter
                    )
                  }
                >
                  <option value="ALL">
                    {tUi("winePricingCategoryAll")}
                  </option>
                  {wineCategoryOrder.map((category) => (
                    <option key={category} value={category}>
                      {wineCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </div>

              {!isViewerRole && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={pricingSaving || pricingRows.length === 0}
                    onClick={() =>
                      setPricingSelected((prev) => {
                        const next = { ...prev };
                        pricingRows.forEach((row) => {
                          next[row.wine_id] = true;
                        });
                        return next;
                      })
                    }
                  >
                    {tUi("winePricingSelectAll")}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={pricingSaving || pricingRows.length === 0}
                    onClick={() =>
                      setPricingSelected((prev) => {
                        const next = { ...prev };
                        pricingRows.forEach((row) => {
                          next[row.wine_id] = false;
                        });
                        return next;
                      })
                    }
                  >
                    {tUi("winePricingDeselectAll")}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={pricingSaving || pricingRows.length === 0}
                    onClick={() =>
                      setPricingDrafts((prev) => {
                        const next = { ...prev };
                        pricingRows.forEach((row) => {
                          delete next[row.wine_id];
                        });
                        return next;
                      })
                    }
                  >
                    {tUi("winePricingRecalculate")}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      pricingSaving ||
                      pricingSavableSelectedRows.length === 0
                    }
                    onClick={() => void saveSelectedWinePrices()}
                  >
                    {pricingSaving
                      ? tApp("saving")
                      : tUi("winePricingSaveSelected", {
                          count: pricingSavableSelectedRows.length,
                        })}
                  </button>
                </div>
              )}

              {pricingStatus && (
                <div className="mt-3 whitespace-pre-line rounded-lg border border-sky-200 bg-white p-2 text-xs text-stone-700">
                  {pricingStatus}
                </div>
              )}

              <div className="mt-3 max-h-[560px] overflow-auto rounded-lg border border-sky-200 bg-white">
                <div className="min-w-[980px]">
                  <div className="sticky top-0 z-10 grid grid-cols-[28px_1.4fr_2fr_56px_1fr_0.9fr_52px_72px_72px_96px_64px_72px] gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-600">
                    <div />
                    <div>{tApp("producer")}</div>
                    <div>{tApp("cuveeWineName")}</div>
                    <div>{tApp("vintage")}</div>
                    <div>{tUi("wineReviewRegion")}</div>
                    <div>{tUi("wineReviewCategory")}</div>
                    <div className="text-right">
                      {tUi("winePricingStock")}
                    </div>
                    <div className="text-right">
                      {tUi("winePricingCost")}
                    </div>
                    <div className="text-right">
                      {tUi("winePricingCurrentPrice")}
                    </div>
                    <div className="text-right">
                      {tUi("winePricingRecommended")}
                    </div>
                    <div className="text-right">
                      {tUi("winePricingRatio")}
                    </div>
                    <div>{tUi("winePricingListing")}</div>
                  </div>

                  {pricingActiveWineIds === null ? (
                    <div className="p-4 text-center text-xs text-stone-500">
                      {tUi("winePricingLoading")}
                    </div>
                  ) : pricingRows.length === 0 ? (
                    <div className="p-4 text-center text-xs text-stone-500">
                      {tUi("winePricingNoRows")}
                    </div>
                  ) : (
                    pricingRows.map((row) => {
                      const recommended =
                        recommendedSalePriceFromCost(
                          row.avg_cost_ht
                        );
                      const draft = pricingDraftValue(row);
                      const parsed = parsePricingDraft(draft);
                      const cost = Number(row.avg_cost_ht || 0);
                      const ratio =
                        parsed !== null && cost > 0
                          ? parsed / cost
                          : null;
                      const selected = isPricingRowSelected(row);

                      return (
                        <div
                          key={`pricing-${row.wine_id}`}
                          className={
                            "grid grid-cols-[28px_1.4fr_2fr_56px_1fr_0.9fr_52px_72px_72px_96px_64px_72px] items-center gap-2 border-b border-stone-100 px-3 py-1.5 text-[11px] last:border-b-0" +
                            (recommended ? "" : " bg-amber-50/70")
                          }
                        >
                          <div>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={isViewerRole || pricingSaving}
                              onChange={(e) =>
                                setPricingSelected((prev) => ({
                                  ...prev,
                                  [row.wine_id]: e.target.checked,
                                }))
                              }
                            />
                          </div>

                          <div className="truncate font-semibold">
                            {row.producer}
                          </div>

                          <div
                            className="truncate"
                            title={row.wine_name || row.cuvee}
                          >
                            {row.wine_name || row.cuvee}
                          </div>

                          <div>{row.vintage}</div>

                          <div className="truncate">
                            {row.region}
                          </div>

                          <div className="truncate">
                            {wineCategoryLabel(row.category)}
                          </div>

                          <div className="text-right">
                            {row.current_quantity}
                          </div>

                          <div className="text-right">
                            {cost > 0 ? (
                              cost.toFixed(2)
                            ) : (
                              <span className="font-bold text-amber-700">
                                {tUi("winePricingNeedsReview")}
                              </span>
                            )}
                          </div>

                          <div className="text-right text-stone-500">
                            {isWinePriceUnset(row)
                              ? "—"
                              : Number(row.sale_price).toFixed(2)}
                          </div>

                          <div>
                            <input
                              type="text"
                              inputMode="decimal"
                              className={
                                "input w-full px-2 py-1 text-right text-[11px]" +
                                (draft && parsed === null
                                  ? " border-red-400"
                                  : "")
                              }
                              value={draft}
                              placeholder={
                                recommended
                                  ? undefined
                                  : tUi("winePricingNeedsReview")
                              }
                              readOnly={isViewerRole}
                              disabled={pricingSaving}
                              onChange={(e) =>
                                setPricingDrafts((prev) => ({
                                  ...prev,
                                  [row.wine_id]: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div
                            className="text-right text-stone-600"
                            title={
                              recommended
                                ? `×${recommended.multiplier.toFixed(1)}`
                                : undefined
                            }
                          >
                            {ratio !== null
                              ? `×${ratio.toFixed(2)}`
                              : "—"}
                            {recommended && (
                              <div className="text-[9px] text-stone-400">
                                ({`×${recommended.multiplier.toFixed(1)}`})
                              </div>
                            )}
                          </div>

                          <div>
                            <span
                              className={
                                "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                                (row.is_listed
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-stone-100 text-stone-600")
                              }
                            >
                              {row.is_listed
                                ? tUi("winePricingListed")
                                : tUi("winePricingUnlisted")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

        {wineListDisplayMode === "MANAGE" && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm font-bold text-stone-800">
              {tUi("wineListHeaderSettingsTitle")}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-stone-600">
                  {tUi("wineListHeaderTitleLabel")}
                </span>
                <input
                  type="text"
                  className="input w-full"
                  value={wineListHeaderTitle}
                  readOnly={isViewerRole}
                  onChange={(e) =>
                    setWineListHeaderTitle(e.target.value)
                  }
                  placeholder="BON PINARD"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-stone-600">
                  {tUi("wineListHeaderSubtitleLabel")}
                </span>
                <input
                  type="text"
                  className="input w-full"
                  value={wineListHeaderSubtitle}
                  readOnly={isViewerRole}
                  onChange={(e) =>
                    setWineListHeaderSubtitle(e.target.value)
                  }
                  placeholder="Carte des vins"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveWineListHeaderSettings}
                disabled={
                  wineListHeaderSaving || isViewerRole
                }
                title={
                  isViewerRole
                    ? tUi("viewerReadOnlyAction")
                    : undefined
                }
              >
                {wineListHeaderSaving
                  ? tApp("saving")
                  : tUi("wineListHeaderSave")}
              </button>

              <span className="text-xs text-stone-500">
                {tUi("wineListHeaderHint")}
              </span>
            </div>

            {wineListHeaderStatus && (
              <div className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
                {wineListHeaderStatus}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-bold text-stone-700">
            {tUi("displayMode")}
          </span>

          <button
            type="button"
            className={
              wineListDisplayMode === "MANAGE"
                ? "btn btn-primary"
                : "btn btn-secondary"
            }
            onClick={() => {
              setWineListDisplayMode("MANAGE");
              // wineListViewModeの切替はwineListDisplayMode専用の
              // useEffectへ一本化した（下記参照）。ここでは
              // 副作用を増やさず、データ再取得だけを行う。
              // MANAGE/CUSTOMERはデータ取得元そのものが違うため、
              // 表示切替のたびに明示的なmodeで再取得する
              // （setWineListDisplayMode()のstate反映を待たない）。
              loadWineList("MANAGE");
            }}
          >
            {tWine("displayManage")}
          </button>

          <button
            type="button"
            className={
              wineListDisplayMode === "CUSTOMER"
                ? "btn btn-primary"
                : "btn btn-secondary"
            }
            onClick={() => {
              setWineListDisplayMode("CUSTOMER");
              loadWineList("CUSTOMER");
            }}
          >
            {tWine("displayCustomer")}
          </button>

          <span className="mx-2 h-5 w-px bg-stone-300" />

          <span className="mr-1 text-sm font-bold text-stone-700">
            {tUi("wineListLanguageLabel")}
          </span>

          <button
            type="button"
            className={
              wineListLanguage === "FR"
                ? "btn btn-primary !px-3 !py-1 text-xs"
                : "btn btn-secondary !px-3 !py-1 text-xs"
            }
            onClick={() =>
              selectWineListLanguage("FR")
            }
          >
            Français
          </button>

          <button
            type="button"
            className={
              wineListLanguage === "JA"
                ? "btn btn-primary !px-3 !py-1 text-xs"
                : "btn btn-secondary !px-3 !py-1 text-xs"
            }
            onClick={() =>
              selectWineListLanguage("JA")
            }
          >
            日本語
          </button>

          <button
            type="button"
            className={
              wineListLanguage === "EN"
                ? "btn btn-primary !px-3 !py-1 text-xs"
                : "btn btn-secondary !px-3 !py-1 text-xs"
            }
            onClick={() =>
              selectWineListLanguage("EN")
            }
          >
            English
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm font-bold text-stone-800">
              {tWine("settingsTitle")}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-bold text-stone-600">
                {tWine("layoutLabel")}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={
                    wineListLayoutMode === "REGION"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListLayoutMode("REGION")
                  }
                >
                  {tWine("layoutRegion")}
                </button>

                <button
                  type="button"
                  className={
                    wineListLayoutMode === "PRODUCER"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListLayoutMode("PRODUCER")
                  }
                >
                  {tWine("layoutProducer")}
                </button>

                <button
                  type="button"
                  className={
                    wineListLayoutMode === "SIMPLE"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListLayoutMode("SIMPLE")
                  }
                >
                  {tWine("layoutSimple")}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-bold text-stone-600">
                {tWine("sortLabel")}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={
                    wineListSortMode === "DEFAULT"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListSortMode("DEFAULT")
                  }
                >
                  {tWine("sortDefault")}
                </button>

                <button
                  type="button"
                  className={
                    wineListSortMode === "PRODUCER_ASC"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListSortMode("PRODUCER_ASC")
                  }
                >
                  {tWine("sortProducer")}
                </button>

                <button
                  type="button"
                  className={
                    wineListSortMode === "VINTAGE_DESC"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListSortMode("VINTAGE_DESC")
                  }
                >
                  {tWine("sortVintageDesc")}
                </button>

                <button
                  type="button"
                  className={
                    wineListSortMode === "VINTAGE_ASC"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListSortMode("VINTAGE_ASC")
                  }
                >
                  {tWine("sortVintageAsc")}
                </button>

                <button
                  type="button"
                  className={
                    wineListSortMode === "PRICE_ASC"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListSortMode("PRICE_ASC")
                  }
                >
                  {tWine("sortPriceAsc")}
                </button>

                <button
                  type="button"
                  className={
                    wineListSortMode === "PRICE_DESC"
                      ? "btn btn-primary"
                      : "btn btn-secondary"
                  }
                  onClick={() =>
                    setWineListSortMode("PRICE_DESC")
                  }
                >
                  {tWine("sortPriceDesc")}
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-stone-500">
              {tWine("combineHint")}
            </div>
          </div>

        {wineListDisplayMode === "MANAGE" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={
                wineListViewMode === "LISTED"
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
              onClick={() =>
                setWineListViewMode("LISTED")
              }
            >
              {tWine("viewListed")} {listedWineList.length}
            </button>

            <button
              type="button"
              className={
                wineListViewMode === "UNLISTED"
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
              onClick={() =>
                setWineListViewMode("UNLISTED")
              }
            >
              {tWine("viewUnlisted")} {unlistedWineList.length}
            </button>

            <button
              type="button"
              className={
                wineListViewMode === "ALL"
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
              onClick={() =>
                setWineListViewMode("ALL")
              }
            >
              {tWine("viewAll")} {sortedWineList.length}
            </button>
          </div>
        )}
                <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-bold text-stone-700">
              {tWine("regionLabel")}
            </span>

            <button
              type="button"
              className={
                wineListRegionFilter === "ALL"
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
              onClick={() =>
                setWineListRegionFilter("ALL")
              }
            >
              {tWine("allRegions")}
            </button>

            {wineListRegions.map((region) => (
              <button
                key={region}
                type="button"
                className={
                  wineListRegionFilter === region
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                }
                onClick={() =>
                  setWineListRegionFilter(region)
                }
              >
                {region}
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-bold text-stone-700">
              {tWine("categoryLabel")}
            </span>

            <button
              type="button"
              className={
                wineListCategoryFilter === "ALL"
                  ? "btn btn-primary"
                  : "btn btn-secondary"
              }
              onClick={() =>
                setWineListCategoryFilter("ALL")
              }
            >
              {tWine("allCategories")}
            </button>

            {wineCategoryOrder.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  wineListCategoryFilter === category
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                }
                onClick={() =>
                  setWineListCategoryFilter(category)
                }
              >
                {wineCategoryLabel(category)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              className="input min-w-[280px] flex-1"
              placeholder={tWine("searchPlaceholder")}
              value={wineListSearch}
              onChange={(e) =>
                setWineListSearch(e.target.value)
              }
            />

            {wineListSearch && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setWineListSearch("")
                }
              >
                {tWine("clearSearch")}
              </button>
            )}
          </div>

          <div className="mt-2 text-sm text-stone-600">
            {tWine("searchResults")}：
            <b className="ml-1 text-stone-900">
              {displayedWineList.length}
            </b>{" "}
            {tWine("resultUnit")}
          </div>
        </div>

        <div
          id={
            isCustomerWineView
              ? "wine-list-print-area"
              : undefined
          }
          className={
            isCustomerWineView
              ? "wine-list-print-area mx-auto mt-5 w-full max-w-[1080px] overflow-visible border border-stone-200 bg-[#fffdf9] px-4 py-2 shadow-sm md:px-8"
              : "mt-4 max-h-[900px] overflow-auto rounded-xl border border-stone-200 bg-white"
          }
        >
          {isCustomerWineView &&
            (wineListHeaderTitle.trim() ||
              wineListHeaderSubtitle.trim()) && (
              <div className="wine-list-print-title border-b border-stone-200 px-6 pb-7 pt-8 text-center md:px-10">
                {wineListHeaderTitle.trim() && (
                  <div className="font-display text-[26px] font-bold tracking-[0.14em] text-stone-900 md:text-[30px]">
                    {wineListHeaderTitle}
                  </div>
                )}

                {wineListHeaderSubtitle.trim() && (
                  <div className="mt-2 font-wineserif text-[15px] italic tracking-[0.04em] text-stone-500 md:text-[16px]">
                    {wineListHeaderSubtitle}
                  </div>
                )}
              </div>
            )}

          {displayedWineList.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-500">
              {tWine("emptyList")}
            </div>
          ) : wineListLayoutMode === "REGION" ? (
            <>
              {Array.from(
                new Set(
                  displayedWineList.map(
                    (row) =>
                      row.country || tWine("other")
                  )
                )
              )
                .sort((a, b) =>
                  a.localeCompare(
                    b,
                    undefined,
                    {
                      sensitivity: "base",
                    }
                  )
                )
                .map((country) => {
                  const countryRows =
                    displayedWineList.filter(
                      (row) =>
                        (row.country ||
                          tWine("other")) ===
                        country
                    );

                  const regions =
                    Array.from(
                      new Set(
                        countryRows.map(
                          (row) =>
                            row.region ||
                            tWine("other")
                        )
                      )
                    ).sort((a, b) =>
                      a.localeCompare(
                        b,
                        undefined,
                        {
                          sensitivity:
                            "base",
                        }
                      )
                    );

                  return (
                    <div key={country}>
                      <div className={wineListSectionHeaderClass}>
                        {country}
                      </div>

                      {regions.map(
                        (region) => {
                          const regionRows =
                            countryRows.filter(
                              (row) =>
                                (row.region ||
                                  tWine("other")) ===
                                region
                            );

                          return (
                            <div
                              key={`${country}-${region}`}
                            >
                              <div className={wineListSubHeaderClass}>
                                {region}
                              </div>

                              {wineCategoryOrder.map(
                                (category) => {
                                  const categoryRows =
                                    regionRows.filter(
                                      (row) =>
                                        row.category ===
                                        category
                                    );

                                  if (
                                    categoryRows.length ===
                                    0
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <div
                                      key={`${country}-${region}-${category}`}
                                    >
                                      <div className={wineListCategoryHeaderClass}>
                                        {wineCategoryLabel(
                                          category
                                        )}

                                        {!isCustomerWineView && (
                                          <span className="ml-2 font-normal text-stone-500">
                                            {
                                              categoryRows.length
                                            }{" "}
                                            {tWine("typeUnit")}
                                          </span>
                                        )}
                                      </div>

                                      {categoryRows.map(
                                        (row) => (
                                          <div
                                            key={`region-${row.wine_id}`}
                                            className={wineListRowWrapperClass}
                                          >
                                            <div className={wineListProducerLabelClass}>
                                              {row.producer ||
                                                tWine("unknownProducer")}
                                            </div>

                                            {renderWineListRow(
                                              row
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  );
                })}
            </>
          ) : wineListLayoutMode ===
            "PRODUCER" ? (
            <>
              {Array.from(
                new Set(
                  displayedWineList.map(
                    (row) =>
                      row.producer ||
                      tWine("unknownProducer")
                  )
                )
              )
                .sort((a, b) =>
                  a.localeCompare(
                    b,
                    undefined,
                    {
                      sensitivity: "base",
                    }
                  )
                )
                .map((producer) => {
                  const producerRows =
                    displayedWineList.filter(
                      (row) =>
                        (row.producer ||
                          tWine("unknownProducer")) ===
                        producer
                    );

                  return (
                    <div key={producer}>
                      <div className={wineListSectionHeaderClass}>
                        {producer}
                      </div>

                      {wineCategoryOrder.map(
                        (category) => {
                          const categoryRows =
                            producerRows.filter(
                              (row) =>
                                row.category ===
                                category
                            );

                          if (
                            categoryRows.length ===
                            0
                          ) {
                            return null;
                          }

                          return (
                            <div
                              key={`${producer}-${category}`}
                            >
                              <div className={wineListCategoryHeaderClass}>
                                {wineCategoryLabel(
                                  category
                                )}

                                {!isCustomerWineView && (
                                  <span className="ml-2 font-normal text-stone-500">
                                    {
                                      categoryRows.length
                                    }{" "}
                                    {tWine("typeUnit")}
                                  </span>
                                )}
                              </div>

                              {categoryRows.map(
                                (row) => (
                                  <div
                                    key={`producer-${row.wine_id}`}
                                    className={wineListRowWrapperClass}
                                  >
                                    <div className={wineListOriginLabelClass}>
                                      {row.country ||
                                        tWine("other")}
                                      {" / "}
                                      {row.region ||
                                        tWine("other")}
                                    </div>

                                    {renderWineListRow(
                                      row
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  );
                })}
            </>
          ) : (
            <>
              <div className={wineListSectionHeaderClass}>
                {tWine("simpleListTitle")}
                {!isCustomerWineView && (
                  <span className="ml-2 text-sm font-normal text-stone-300">
                    {displayedWineList.length}{" "}
                    {tWine("typeUnit")}
                  </span>
                )}
              </div>

              {displayedWineList.map(
                (row) => (
                  <div
                    key={`simple-${row.wine_id}`}
                    className={wineListRowWrapperClass}
                  >
                    <div className={wineListSimpleMetaClass}>
                      <span className="font-semibold text-stone-700">
                        {row.producer ||
                          tWine("unknownProducer")}
                      </span>

                      <span>
                        {row.country ||
                          tWine("other")}
                        {" / "}
                        {row.region ||
                          tWine("other")}
                      </span>

                      <span>
                        {wineCategoryLabel(
                          row.category
                        )}
                      </span>
                    </div>

                    {renderWineListRow(
                      row
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </section>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold">
              {tUi("section8Title")}
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              {tUi("section8Description")}
            </p>
          </div>

          {soldBottleDetections.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearSoldBottleResults}
              disabled={applyingSoldBottles}
            >
              {tUi("soldBottleClear")}
            </button>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <label className="block">
            <div className="mb-2 text-sm font-bold text-stone-700">
              {tUi("soldBottleSelect")}
            </div>

            <input
              className="input w-full"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={isViewerRole}
              onChange={(e) =>
                handleSoldBottleFiles(
                  Array.from(
                    e.target.files || []
                  )
                )
              }
            />
          </label>

          {soldBottlePreviews.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {soldBottlePreviews.map(
                (preview) => (
                  <div
                    key={`${preview.name}-${preview.url}`}
                    className="w-28 shrink-0"
                  >
                    <img
                      src={preview.url}
                      alt={preview.name}
                      className="h-28 w-28 rounded-lg border border-stone-200 bg-white object-cover"
                    />
                    <div
                      className="mt-1 truncate text-[9px] text-stone-500"
                      title={preview.name}
                    >
                      {preview.name}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={analyzeSoldBottlePhotos}
              disabled={
                analyzingSoldBottles ||
                soldBottleFiles.length === 0 ||
                isViewerRole
              }
              title={
                isViewerRole
                  ? tUi("viewerReadOnlyAction")
                  : undefined
              }
            >
              {analyzingSoldBottles
                ? tUi("soldBottleAnalyzing")
                : tUi("soldBottleAnalyze")}
            </button>
          </div>
        </div>

        {soldBottleStatus && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3 text-sm">
            {soldBottleStatus}
          </div>
        )}

        {soldBottleDetections.length > 0 && (
          <div className="mt-4 space-y-3">
            {soldBottleDetections.map(
              (item) => {
                const selectedInventory =
                  allInventory.find(
                    (row) =>
                      row.wineId ===
                      item.selectedWineId
                  );

                /*
                 * ここは表示専用の補助チェック。
                 * applySoldBottleSales()側の検証は
                 * このコードに関わらず必ず実行される。
                 */
                const rowQuantity =
                  Number(item.quantity);

                const rowQuantityInvalid =
                  !Number.isInteger(
                    rowQuantity
                  ) || rowQuantity < 1;

                const rowOverStock =
                  Boolean(
                    item.selectedWineId &&
                      selectedInventory &&
                      (soldBottleQuantityByWineId.get(
                        item.selectedWineId
                      ) || 0) >
                        Number(
                          selectedInventory.qty ||
                            0
                        )
                  );

                const rowIssue =
                  rowQuantityInvalid
                    ? tUi(
                        "soldBottleInvalidQty"
                      )
                    : rowOverStock
                      ? tUi(
                          "soldBottleOverStock",
                          {
                            wine: `${
                              selectedInventory?.producer ||
                              ""
                            } ${
                              selectedInventory?.cuvee ||
                              selectedInventory?.raw ||
                              ""
                            }`.trim(),
                            stock: Number(
                              selectedInventory?.qty ||
                                0
                            ),
                            qty:
                              soldBottleQuantityByWineId.get(
                                item.selectedWineId
                              ) || 0,
                          }
                        )
                      : null;

                return (
                  <div
                    key={item.id}
                    className={
                      item.selectedWineId
                        ? "rounded-xl border border-stone-200 bg-white p-4"
                        : "rounded-xl border border-amber-300 bg-amber-50/40 p-4"
                    }
                  >
                    <div className="mb-2 flex justify-end">
                      <span
                        className={
                          item.selectedWineId
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                            : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                        }
                      >
                        {item.selectedWineId
                          ? tUi(
                              "soldBottleConfirmedBadge"
                            )
                          : tUi(
                              "soldBottleUnconfirmedBadge"
                            )}
                      </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr_160px]">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                          {tUi("soldBottleAiRead")}
                        </div>

                        <div className="mt-1 font-bold">
                          {item.producer || "—"}
                        </div>

                        <div className="text-sm">
                          {item.wine_name ||
                            item.cuvee ||
                            "—"}
                        </div>

                        <div className="mt-1 text-xs text-stone-500">
                          {item.vintage || "NV"}
                          {" / "}
                          {item.bottle_size_cl
                            ? `${item.bottle_size_cl} cl`
                            : "—"}
                        </div>

                        <div className="mt-2 text-xs text-stone-500">
                          {tUi("soldBottleConfidence")}：
                          {Math.round(
                            Math.max(
                              0,
                              Math.min(
                                1,
                                Number(
                                  item.confidence || 0
                                )
                              )
                            ) * 100
                          )}
                          %
                        </div>

                        {item.notes && (
                          <div className="mt-1 text-[10px] text-stone-400">
                            {item.notes}
                          </div>
                        )}
                      </div>

                      <label>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                          {tUi("soldBottleMatchedInventory")}
                        </div>

                        <select
                          className="input w-full"
                          value={item.selectedWineId}
                          onChange={(e) =>
                            updateSoldBottleDetection(
                              item.id,
                              {
                                selectedWineId:
                                  e.target.value,
                              }
                            )
                          }
                        >
                          <option value="">
                            {tUi("soldBottleNoMatch")}
                          </option>

                          {item.selectedWineId &&
                            selectedInventory &&
                            !item.candidates.some(
                              (candidate) =>
                                candidate.wineId ===
                                item.selectedWineId
                            ) && (
                              <option
                                value={
                                  item.selectedWineId
                                }
                              >
                                {tUi(
                                  "soldBottleSearchSelected"
                                )}
                                {" — "}
                                {selectedInventory.producer}
                                {" / "}
                                {selectedInventory.cuvee ||
                                  selectedInventory.raw}
                                {" / "}
                                {selectedInventory.vintage ||
                                  "NV"}
                                {" / "}
                                {selectedInventory.size ||
                                  75}{" "}
                                cl
                              </option>
                            )}

                          {item.candidates.map(
                            (candidate) => (
                              <option
                                key={candidate.wineId}
                                value={candidate.wineId}
                              >
                                {Math.round(
                                  candidate.score * 100
                                )}
                                % / {candidate.label}
                                {" / "}
                                {tUi("soldBottleStock")} {candidate.stock}
                              </option>
                            )
                          )}
                        </select>

                        {selectedInventory && (
                          <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs">
                            <b>
                              {selectedInventory.producer}
                            </b>
                            {" / "}
                            {selectedInventory.cuvee ||
                              selectedInventory.raw}
                            {" / "}
                            {selectedInventory.vintage || "NV"}
                            {" — "}
                            {tUi("soldBottleStock")}：
                            <b>
                              {selectedInventory.qty}
                            </b>
                          </div>
                        )}

                        <div className="mt-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                            {tUi(
                              "soldBottleSearchLabel"
                            )}
                          </div>

                          <input
                            type="text"
                            className="input w-full text-xs"
                            placeholder={tUi(
                              "soldBottleSearchPlaceholder"
                            )}
                            value={
                              item.searchQuery
                            }
                            onChange={(e) =>
                              updateSoldBottleDetection(
                                item.id,
                                {
                                  searchQuery:
                                    e.target
                                      .value,
                                }
                              )
                            }
                          />

                          {item.searchQuery.trim() && (
                            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-stone-200 bg-white text-xs">
                              {(() => {
                                const results =
                                  searchAllInventoryForSoldBottle(
                                    item.searchQuery
                                  );

                                if (
                                  results.length ===
                                  0
                                ) {
                                  return (
                                    <div className="p-2 text-stone-400">
                                      {tUi(
                                        "soldBottleSearchNoResults"
                                      )}
                                    </div>
                                  );
                                }

                                return results.map(
                                  (candidate) => (
                                    <button
                                      key={
                                        candidate.wineId
                                      }
                                      type="button"
                                      className="block w-full border-b border-stone-100 px-2 py-1 text-left last:border-b-0 hover:bg-stone-50"
                                      onClick={() =>
                                        updateSoldBottleDetection(
                                          item.id,
                                          {
                                            selectedWineId:
                                              candidate.wineId,
                                            searchQuery:
                                              "",
                                          }
                                        )
                                      }
                                    >
                                      {
                                        candidate.label
                                      }
                                      {" — "}
                                      {tUi(
                                        "soldBottleStock"
                                      )}{" "}
                                      {
                                        candidate.stock
                                      }
                                    </button>
                                  )
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </label>

                      <label>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                          {tUi("soldBottleQty")}
                        </div>

                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="input w-full text-right font-bold"
                          value={item.quantity}
                          onChange={(e) =>
                            updateSoldBottleDetection(
                              item.id,
                              {
                                quantity:
                                  Math.max(
                                    1,
                                    Math.round(
                                      Number(
                                        e.target.value ||
                                        1
                                      )
                                    )
                                  ),
                              }
                            )
                          }
                        />
                      </label>
                    </div>

                    {rowIssue && (
                      <div className="mt-3 rounded-lg bg-amber-100/70 px-3 py-2 text-xs text-amber-800">
                        {rowIssue}
                      </div>
                    )}
                  </div>
                );
              }
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div
                className={
                  soldBottleUnconfirmedCount > 0
                    ? "rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
                    : "rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                }
              >
                {tUi(
                  "soldBottleConfirmedCount"
                )}
                {"："}
                {soldBottleConfirmedCount}
                {"　"}
                {tUi(
                  "soldBottleUnconfirmedCount"
                )}
                {"："}
                {soldBottleUnconfirmedCount}

                {soldBottleUnconfirmedCount ===
                  0 && (
                  <>
                    {"　"}
                    {tUi(
                      "soldBottleAllConfirmed"
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={applySoldBottleSales}
                disabled={
                  applyingSoldBottles ||
                  !soldBottleCanApply ||
                  isViewerRole
                }
                title={
                  isViewerRole
                    ? tUi("viewerReadOnlyAction")
                    : undefined
                }
              >
                {applyingSoldBottles
                  ? tUi("soldBottleApplying")
                  : soldBottleUnconfirmedCount >
                    0
                    ? tUi(
                        "soldBottleConfirmRemaining",
                        {
                          count:
                            soldBottleUnconfirmedCount,
                        }
                      )
                    : tUi(
                        "soldBottleApplyAll"
                      )}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card mt-4 p-5">
        <div className="max-w-4xl">
          <h2 className="text-xl font-bold">
            {tUi("stockHistoryTitle")}
          </h2>

          <p className="mt-1 text-sm text-stone-600">
            {tUi("stockHistoryDescription")}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <div className="text-[10px] font-semibold text-stone-500">
              {tUi("todaySales")}
            </div>
            <div className="text-lg font-bold text-emerald-700">
              {todaySalesQty}
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <div className="text-[10px] font-semibold text-stone-500">
              {tUi("todayAdjustments")}
            </div>
            <div
              className={
                "text-lg font-bold " +
                (todayAdjustmentsQty < 0
                  ? "text-red-700"
                  : todayAdjustmentsQty > 0
                    ? "text-emerald-700"
                    : "text-stone-700")
              }
            >
              {todayAdjustmentsQty > 0
                ? `+${todayAdjustmentsQty}`
                : todayAdjustmentsQty}
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <div className="text-[10px] font-semibold text-stone-500">
              {tUi("todayReversals")}
            </div>
            <div className="text-lg font-bold text-purple-700">
              {todayReversalsCount}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="input min-w-[220px] flex-1"
            placeholder={tUi(
              "stockHistorySearchPlaceholder"
            )}
            value={stockHistorySearch}
            onChange={(e) =>
              setStockHistorySearch(
                e.target.value
              )
            }
          />

          <select
            className="input"
            value={stockHistoryTypeFilter}
            onChange={(e) =>
              setStockHistoryTypeFilter(
                e.target
                  .value as typeof stockHistoryTypeFilter
              )
            }
            aria-label={tUi(
              "stockHistoryTypeFilterLabel"
            )}
          >
            <option value="ALL">
              {tUi("stockHistoryAll")}
            </option>
            <option value="PURCHASE">
              {tUi("stockMovementPurchase")}
            </option>
            <option value="SALE">
              {tUi("stockMovementSale")}
            </option>
            <option value="ADJUSTMENT">
              {tUi("stockMovementAdjustment")}
            </option>
            <option value="REVERSAL">
              {tUi("stockMovementReversal")}
            </option>
          </select>

          <select
            className="input"
            value={stockHistoryDateFilter}
            onChange={(e) =>
              setStockHistoryDateFilter(
                e.target
                  .value as typeof stockHistoryDateFilter
              )
            }
            aria-label={tUi(
              "stockHistoryDateFilterLabel"
            )}
          >
            <option value="ALL">
              {tUi("stockHistoryDateAll")}
            </option>
            <option value="TODAY">
              {tUi("stockHistoryDateToday")}
            </option>
            <option value="7D">
              {tUi("stockHistoryDate7d")}
            </option>
            <option value="30D">
              {tUi("stockHistoryDate30d")}
            </option>
          </select>
        </div>

        <div className="mt-3 max-h-[700px] overflow-y-auto rounded-xl border border-stone-200 bg-white">
          <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-600">
            <div className="col-span-2">
              {tUi("stockHistoryDate")}
            </div>

            <div className="col-span-1">
              {tUi("stockHistoryType")}
            </div>

            <div className="col-span-4">
              {tUi("stockHistoryWine")}
            </div>

            <div className="col-span-1 text-right">
              {tUi("stockHistoryQuantity")}
            </div>

            <div className="col-span-1 text-right">
              {tUi("stockHistoryCost")}
            </div>

            <div className="col-span-2">
              {tUi("stockHistoryNotes")}
            </div>

            <div className="col-span-1 text-right">
              {tUi("stockHistoryAction")}
            </div>
          </div>

          {filteredStockMovements.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-500">
              {stockMovementsLoading
                ? tUi("stockHistoryLoading")
                : tUi("stockHistoryNoResults")}
            </div>
          ) : (
            filteredStockMovements.map((m) => {
              const info =
                wineLookupForHistory[
                  m.wine_id
                ];

              const wineLabel = `${
                info?.producer || ""
              } ${
                info?.wineName ||
                info?.cuvee ||
                ""
              } ${
                info?.vintage || ""
              }`.trim();

              const isReversed =
                reversedMovementIds.has(
                  m.id
                );

              const canReverse =
                (m.movement_type ===
                  "SALE" ||
                  m.movement_type ===
                    "ADJUSTMENT") &&
                !isReversed;

              const isReversing =
                reversingMovementId === m.id;

              const qtyColor =
                m.movement_type ===
                "REVERSAL"
                  ? "text-purple-700"
                  : m.quantity < 0
                    ? "text-red-700"
                    : m.quantity > 0
                      ? "text-emerald-700"
                      : "text-stone-700";

              const originalId =
                m.movement_type ===
                "REVERSAL"
                  ? getReversalOriginalId(
                      m.notes
                    )
                  : null;

              const originalMovement =
                originalId
                  ? stockMovementById.get(
                      originalId
                    )
                  : null;

              /*
               * REVERSAL行のnotes欄には
               * "REVERSAL_OF:<uuid>"をそのまま出さない。
               * DB保存内容(m.notes)自体は変更しない
               * （二重取消防止に使うため）。
               * 画面には元movementのnotesを
               * 補足として表示するだけにする。
               */
              const notesDisplay =
                m.movement_type === "REVERSAL"
                  ? originalMovement?.notes?.trim()
                    ? tUi(
                        "stockHistoryOriginalNote",
                        {
                          note: originalMovement.notes.trim(),
                        }
                      )
                    : "-"
                  : m.notes || "-";

              const dateDisplay =
                stockMovementsHasCreatedAt &&
                m.created_at
                  ? new Date(
                      m.created_at
                    ).toLocaleString()
                  : m.movement_date;

              return (
                <div
                  key={m.id}
                  className="border-b border-stone-100 px-3 py-2 last:border-b-0"
                >
                  <div className="grid grid-cols-12 items-center gap-2 text-[11px]">
                    <div className="col-span-2 text-stone-600">
                      {dateDisplay}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={
                          "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold " +
                          getStockMovementBadgeClass(
                            m.movement_type
                          )
                        }
                      >
                        {tUi(
                          getStockMovementTypeLabelKey(
                            m.movement_type
                          )
                        )}
                      </span>
                    </div>

                    <div
                      className="col-span-4 truncate"
                      title={wineLabel}
                    >
                      {wineLabel || "-"}

                      {m.movement_type ===
                        "REVERSAL" && (
                        <div className="mt-0.5 truncate text-[10px] text-stone-500">
                          ↳{" "}
                          {getReversalDescription(
                            originalMovement
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        "col-span-1 text-right font-bold " +
                        qtyColor
                      }
                    >
                      {m.quantity > 0
                        ? `+${m.quantity}`
                        : m.quantity}
                    </div>

                    <div className="col-span-1 text-right text-stone-600">
                      {m.unit_cost_ht !==
                      null
                        ? Number(
                            m.unit_cost_ht
                          ).toFixed(2)
                        : "-"}
                    </div>

                    <div
                      className="col-span-2 truncate text-stone-500"
                      title={notesDisplay}
                    >
                      {notesDisplay}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      {canReverse ? (
                        <button
                          type="button"
                          className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                          onClick={() =>
                            reverseStockMovement(
                              m
                            )
                          }
                          disabled={
                            Boolean(
                              reversingMovementId
                            ) || isViewerRole
                          }
                          title={
                            isViewerRole
                              ? tUi(
                                  "viewerReadOnlyAction"
                                )
                              : undefined
                          }
                        >
                          {isReversing
                            ? tUi(
                                "stockHistoryUndoing"
                              )
                            : tUi(
                                "stockHistoryUndo"
                              )}
                        </button>
                      ) : isReversed ? (
                        <span className="text-[10px] font-bold text-stone-400">
                          {tUi(
                            "stockHistoryUndone"
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-300">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {stockMovementsHasMore && (
          <div className="mt-3 text-center">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                loadStockHistoryPage(false)
              }
              disabled={stockMovementsLoading}
            >
              {stockMovementsLoading
                ? tUi("stockHistoryLoading")
                : tUi("stockHistoryLoadMore")}
            </button>
          </div>
        )}
      </section>

      {/*
        Section 16「データバックアップ / エクスポート」。
        読み取り専用機能のためisAdmin判定は不要で、owner/staff/viewer
        いずれのログインユーザーにも常に表示する。
      */}
      <section className="card mt-4 p-5">
        <div className="max-w-4xl">
          <h2 className="text-xl font-bold">
            {tUi("section16Title")}
          </h2>

          <p className="mt-1 text-sm text-stone-600">
            {tUi("section16Description")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCurrentInventoryExcel}
            disabled={exportRunning !== null}
          >
            {exportRunning === "inventory_excel"
              ? tUi("exportRunning")
              : tUi("exportCurrentInventoryExcel")}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCurrentInventoryCsv}
            disabled={exportRunning !== null}
          >
            {exportRunning === "inventory_csv"
              ? tUi("exportRunning")
              : tUi("exportCurrentInventoryCsv")}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportFullBackupExcel}
            disabled={exportRunning !== null}
          >
            {exportRunning === "full_backup"
              ? tUi("exportRunning")
              : tUi("exportFullBackupExcel")}
          </button>
        </div>
      </section>

      {/*
        Section 17「在庫アラート / 補充候補」。
        読み取りは常時（owner/staff/viewer）実行できるので
        isAdmin判定は不要。編集/保存だけisViewerRoleで制御する。
      */}
      <section className="card mt-4 p-5">
        <div className="max-w-4xl">
          <h2 className="text-xl font-bold">
            {tUi("section17Title")}
          </h2>

          <p className="mt-1 text-sm text-stone-600">
            {tUi("section17Description")}
          </p>
        </div>

        {stockAlertLoadError && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {stockAlertLoadError}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/*
            4枚とも既存のstockAlertFilter(=プルダウンと同じstate)を
            直接切り替えるトグルボタン。再クリックで"ALL"に戻る。
            read-onlyの表示絞り込みのみのため、viewerでも常に操作可能
            （disabled指定なし）。
          */}
          <button
            type="button"
            onClick={() =>
              toggleStockAlertFilter("OUT_OF_STOCK")
            }
            aria-pressed={
              stockAlertFilter === "OUT_OF_STOCK"
            }
            className={stockAlertCardButtonClass(
              "red",
              stockAlertFilter === "OUT_OF_STOCK"
            )}
          >
            <div
              className={
                "text-[10px] text-red-600 " +
                (stockAlertFilter === "OUT_OF_STOCK"
                  ? "font-bold"
                  : "font-semibold")
              }
            >
              {tUi("alertSummaryOutOfStock")}
            </div>
            <div className="text-lg font-bold text-red-700">
              {stockAlertSummary.outOfStock}
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              toggleStockAlertFilter("LOW_STOCK")
            }
            aria-pressed={
              stockAlertFilter === "LOW_STOCK"
            }
            className={stockAlertCardButtonClass(
              "amber",
              stockAlertFilter === "LOW_STOCK"
            )}
          >
            <div
              className={
                "text-[10px] text-amber-600 " +
                (stockAlertFilter === "LOW_STOCK"
                  ? "font-bold"
                  : "font-semibold")
              }
            >
              {tUi("alertSummaryLowStock")}
            </div>
            <div className="text-lg font-bold text-amber-700">
              {stockAlertSummary.lowStock}
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              toggleStockAlertFilter("ALERT_ENABLED")
            }
            aria-pressed={
              stockAlertFilter === "ALERT_ENABLED"
            }
            className={stockAlertCardButtonClass(
              "stone",
              stockAlertFilter === "ALERT_ENABLED"
            )}
          >
            <div
              className={
                "text-[10px] text-stone-500 " +
                (stockAlertFilter === "ALERT_ENABLED"
                  ? "font-bold"
                  : "font-semibold")
              }
            >
              {tUi("alertSummaryConfigured")}
            </div>
            <div className="text-lg font-bold text-stone-700">
              {stockAlertSummary.configured}
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              toggleStockAlertFilter("REORDER")
            }
            aria-pressed={
              stockAlertFilter === "REORDER"
            }
            className={stockAlertCardButtonClass(
              "emerald",
              stockAlertFilter === "REORDER"
            )}
          >
            <div
              className={
                "text-[10px] text-emerald-600 " +
                (stockAlertFilter === "REORDER"
                  ? "font-bold"
                  : "font-semibold")
              }
            >
              {tUi("alertSummaryRecommendedOrder")}
            </div>
            <div className="text-lg font-bold text-emerald-700">
              {stockAlertSummary.recommendedOrderTotal}
            </div>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="input min-w-[220px] flex-1"
            placeholder={tUi("alertSearchPlaceholder")}
            value={stockAlertSearch}
            onChange={(e) =>
              setStockAlertSearch(e.target.value)
            }
          />

          <select
            className="input"
            value={stockAlertFilter}
            onChange={(e) =>
              setStockAlertFilter(
                e.target
                  .value as typeof stockAlertFilter
              )
            }
            aria-label={tUi("alertFilterLabel")}
          >
            <option value="ALL">
              {tUi("alertFilterAll")}
            </option>
            <option value="NEEDS_ACTION">
              {tUi("alertFilterNeedsAction")}
            </option>
            <option value="OUT_OF_STOCK">
              {tUi("alertFilterOutOfStock")}
            </option>
            <option value="LOW_STOCK">
              {tUi("alertFilterLowStock")}
            </option>
            <option value="OK">
              {tUi("alertFilterOk")}
            </option>
            <option value="NOT_SET">
              {tUi("alertFilterNotSet")}
            </option>
            <option value="ALERT_ENABLED">
              {tUi("alertFilterAlertEnabled")}
            </option>
            <option value="REORDER">
              {tUi("alertFilterReorder")}
            </option>
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadStockAlertData}
            disabled={stockAlertLoading}
          >
            {stockAlertLoading
              ? tUi("alertLoading")
              : tUi("alertRefresh")}
          </button>
        </div>

        <div className="mt-3 max-h-[700px] overflow-y-auto rounded-xl border border-stone-200 bg-white">
          <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-600">
            <div className="col-span-4">
              {tUi("alertColProducer")} /{" "}
              {tUi("alertColWine")} /{" "}
              {tUi("alertColCuvee")} /{" "}
              {tUi("alertColVintage")}
            </div>

            <div className="col-span-1 text-right">
              {tUi("alertColCurrentStock")}
            </div>

            <div className="col-span-1">
              {tUi("alertColMinStock")}
            </div>

            <div className="col-span-1">
              {tUi("alertColTargetStock")}
            </div>

            <div className="col-span-1">
              {tUi("alertColStatus")}
            </div>

            <div className="col-span-1 text-right">
              {tUi("alertColRecommendedOrder")}
            </div>

            <div className="col-span-1 text-center">
              {tUi("alertColAlert")}
            </div>

            <div className="col-span-2 text-right">
              {tUi("alertColSave")}
            </div>
          </div>

          {filteredStockAlertRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-500">
              {stockAlertLoading
                ? tUi("alertLoading")
                : tUi("alertNoResults")}
            </div>
          ) : (
            filteredStockAlertRows.map((row) => {
              const draft =
                stockAlertDrafts[row.wineId] || {
                  minQuantity: String(
                    row.minQuantity
                  ),
                  targetQuantity:
                    row.targetQuantity === null
                      ? ""
                      : String(row.targetQuantity),
                  alertEnabled: row.alertEnabled,
                };

              const wineLabel = `${row.producer}${
                row.wineName
                  ? " — " + row.wineName
                  : ""
              }${
                row.cuvee ? " / " + row.cuvee : ""
              } ${row.vintage}`.trim();

              const isSavingRow =
                stockAlertSavingWineId ===
                row.wineId;

              return (
                <div
                  key={row.wineId}
                  className="border-b border-stone-100 px-3 py-2 last:border-b-0"
                >
                  <div className="grid grid-cols-12 items-center gap-2 text-[11px]">
                    <div
                      className="col-span-4 truncate"
                      title={wineLabel}
                    >
                      {wineLabel || "-"}
                    </div>

                    <div
                      className={
                        "col-span-1 text-right font-bold " +
                        (row.currentQuantity <= 0
                          ? "text-red-700"
                          : "text-stone-700")
                      }
                    >
                      {row.currentQuantity}
                    </div>

                    <div className="col-span-1">
                      {isViewerRole &&
                      !row.hasSettings ? (
                        // viewer + 未設定：入力欄ではなく「—」を表示する
                        // （「0」が実際の設定値のように見えるのを防ぐ）。
                        <div className="text-right text-stone-400">
                          —
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="input w-full text-right text-[11px]"
                          value={draft.minQuantity}
                          disabled={isViewerRole}
                          onChange={(e) =>
                            updateStockAlertDraft(
                              row.wineId,
                              {
                                minQuantity:
                                  e.target.value,
                              }
                            )
                          }
                        />
                      )}
                    </div>

                    <div className="col-span-1">
                      {isViewerRole &&
                      !row.hasSettings ? (
                        <div className="text-right text-stone-400">
                          —
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="input w-full text-right text-[11px]"
                          value={draft.targetQuantity}
                          disabled={isViewerRole}
                          onChange={(e) =>
                            updateStockAlertDraft(
                              row.wineId,
                              {
                                targetQuantity:
                                  e.target.value,
                              }
                            )
                          }
                        />
                      )}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={
                          "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold " +
                          getStockAlertStatusBadgeClass(
                            row.status
                          )
                        }
                      >
                        {getStockAlertStatusLabel(
                          row.status
                        )}
                      </span>
                    </div>

                    <div className="col-span-1 text-right text-stone-600">
                      {row.recommendedOrderQuantity ===
                      null
                        ? tUi(
                            "alertRecommendedOrderNotSet"
                          )
                        : row.recommendedOrderQuantity}
                    </div>

                    <div className="col-span-1 text-center">
                      <input
                        type="checkbox"
                        checked={draft.alertEnabled}
                        disabled={isViewerRole}
                        onChange={(e) =>
                          updateStockAlertDraft(
                            row.wineId,
                            {
                              alertEnabled:
                                e.target.checked,
                            }
                          )
                        }
                      />
                    </div>

                    <div className="col-span-2 text-right">
                      <button
                        type="button"
                        className="btn btn-secondary text-[10px]"
                        disabled={
                          isViewerRole || isSavingRow
                        }
                        onClick={() =>
                          saveStockAlertSetting(row)
                        }
                      >
                        {isSavingRow
                          ? tUi("alertSaving")
                          : isViewerRole
                            ? tUi(
                                "viewerReadOnlyAction"
                              )
                            : tUi("alertSaveButton")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="card mt-4 border-2 border-amber-300 p-5">
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold">
              {tUi("initialImportTitle")}
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              {tUi("initialImportDescription")}
            </p>
          </div>

          {importError && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {importError}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label>
              <div className="mb-1 text-xs font-semibold text-stone-600">
                {tUi(
                  "initialImportTargetCompany"
                )}
              </div>
              <select
                className="input w-full"
                value={importTargetCompanyId}
                onChange={(e) =>
                  setImportTargetCompanyId(
                    e.target.value
                  )
                }
              >
                <option value="">
                  {tUi(
                    "initialImportSelectCompanyPlaceholder"
                  )}
                </option>
                {adminCompanies.map(
                  (c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <div className="mb-1 text-xs font-semibold text-stone-600">
                {tUi(
                  "initialImportSelectFile"
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="input w-full"
                onChange={(e) =>
                  handleInitialImportFileSelect(
                    e.target.files?.[0] || null
                  )
                }
              />
            </label>
          </div>

          {importFile && (
            <div className="mt-2 text-xs text-stone-500">
              {tUi("initialImportFileInfo", {
                name: importFile.name,
                size: `${(
                  importFile.size / 1024
                ).toFixed(0)} KB`,
              })}
              {importSheets.length > 0 &&
                ` · ${importSheets.length} sheet(s)`}
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={analyzeInitialImportFile}
              disabled={importAnalyzing}
            >
              {importAnalyzing
                ? tUi("initialImportAnalyzing")
                : tUi("initialImportAnalyze")}
            </button>
          </div>

          {importSummary && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-stone-500">
                    {tUi(
                      "initialImportSourceRows"
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {importSummary.sourceRowCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-stone-500">
                    {tUi(
                      "initialImportRecognizedWines"
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {importSummary.recognizedWineCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-stone-500">
                    {tUi(
                      "initialImportUniqueWines"
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {importSummary.uniqueWineCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-stone-500">
                    {tUi(
                      "initialImportTotalBottles"
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {importSummary.totalBottles.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-stone-400">
                {tUi("initialImportCardHint")}
              </div>

              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div
                  className={
                    "cursor-pointer rounded-lg border px-3 py-2 transition-colors hover:bg-emerald-100 " +
                    (importStatusFilter === "READY"
                      ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400"
                      : "border-emerald-200 bg-emerald-50")
                  }
                  onClick={() =>
                    toggleInitialImportStatusFilter(
                      "READY"
                    )
                  }
                >
                  <div className="text-[10px] font-semibold text-emerald-700">
                    {tUi("initialImportReady")}
                  </div>
                  <div className="text-lg font-bold text-emerald-700">
                    {importSummary.readyCount}
                  </div>
                </div>

                <div
                  className={
                    "cursor-pointer rounded-lg border px-3 py-2 transition-colors hover:bg-amber-100 " +
                    (importStatusFilter === "REVIEW"
                      ? "border-amber-500 bg-amber-100 ring-2 ring-amber-400"
                      : "border-amber-200 bg-amber-50")
                  }
                  onClick={() =>
                    toggleInitialImportStatusFilter(
                      "REVIEW"
                    )
                  }
                >
                  <div className="text-[10px] font-semibold text-amber-700">
                    {tUi("initialImportReview")}
                  </div>
                  <div className="text-lg font-bold text-amber-700">
                    {importSummary.reviewCount}
                  </div>
                </div>

                <div
                  className={
                    "cursor-pointer rounded-lg border px-3 py-2 transition-colors hover:bg-purple-100 " +
                    (importStatusFilter ===
                    "DUPLICATE"
                      ? "border-purple-500 bg-purple-100 ring-2 ring-purple-400"
                      : "border-purple-200 bg-purple-50")
                  }
                  onClick={() =>
                    toggleInitialImportStatusFilter(
                      "DUPLICATE"
                    )
                  }
                >
                  <div className="text-[10px] font-semibold text-purple-700">
                    {tUi(
                      "initialImportDuplicate"
                    )}
                  </div>
                  <div className="text-lg font-bold text-purple-700">
                    {importSummary.duplicateCount}
                  </div>
                </div>

                <div
                  className={
                    "cursor-pointer rounded-lg border px-3 py-2 transition-colors hover:bg-red-100 " +
                    (importStatusFilter === "INVALID"
                      ? "border-red-500 bg-red-100 ring-2 ring-red-400"
                      : "border-red-200 bg-red-50")
                  }
                  onClick={() =>
                    toggleInitialImportStatusFilter(
                      "INVALID"
                    )
                  }
                >
                  <div className="text-[10px] font-semibold text-red-700">
                    {tUi("initialImportInvalid")}
                  </div>
                  <div className="text-lg font-bold text-red-700">
                    {importSummary.invalidCount}
                  </div>
                </div>

                <div
                  className={
                    "cursor-pointer rounded-lg border px-3 py-2 transition-colors hover:bg-stone-200 " +
                    (importStatusFilter === "SKIP"
                      ? "border-stone-500 bg-stone-200 ring-2 ring-stone-400"
                      : "border-stone-200 bg-stone-50")
                  }
                  onClick={() =>
                    toggleInitialImportStatusFilter(
                      "SKIP"
                    )
                  }
                >
                  <div className="text-[10px] font-semibold text-stone-500">
                    {tUi("initialImportSkip")}
                  </div>
                  <div className="text-lg font-bold text-stone-600">
                    {importSummary.skipCount}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs font-semibold text-stone-500">
                {tUi(
                  "initialImportBillableUnits",
                  {
                    count:
                      importSummary.uniqueWineCount,
                  }
                )}
              </div>
            </>
          )}

          {importExistingInventory &&
            importExistingInventory.existingBottleCount >
              0 && (
              <div className="mt-4 rounded-lg border border-amber-400 bg-amber-50 px-3 py-3">
                <div className="text-sm font-bold text-amber-800">
                  {tUi(
                    "initialImportExistingInventoryWarning",
                    {
                      company:
                        importExistingInventory.companyName,
                      count:
                        importExistingInventory.existingBottleCount,
                    }
                  )}
                </div>

                <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <input
                    type="checkbox"
                    checked={
                      importAcknowledgeExisting
                    }
                    onChange={(e) =>
                      setImportAcknowledgeExisting(
                        e.target.checked
                      )
                    }
                  />
                  {tUi(
                    "initialImportConfirmExistingInventory"
                  )}
                </label>
              </div>
            )}

          {importRows.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <input
                  className="input min-w-[220px] flex-1"
                  placeholder={tUi(
                    "initialImportSearchPlaceholder"
                  )}
                  value={importSearch}
                  onChange={(e) =>
                    setImportSearch(
                      e.target.value
                    )
                  }
                />

                <select
                  className="input"
                  value={importStatusFilter}
                  onChange={(e) =>
                    setImportStatusFilter(
                      e.target
                        .value as typeof importStatusFilter
                    )
                  }
                  aria-label={tUi(
                    "initialImportStatusFilterLabel"
                  )}
                >
                  <option value="ALL">
                    {tUi(
                      "initialImportStatusAll"
                    )}
                  </option>
                  <option value="READY">
                    {tUi("initialImportReady")}
                  </option>
                  <option value="REVIEW">
                    {tUi("initialImportReview")}
                  </option>
                  <option value="DUPLICATE">
                    {tUi(
                      "initialImportDuplicate"
                    )}
                  </option>
                  <option value="INVALID">
                    {tUi("initialImportInvalid")}
                  </option>
                  <option value="SKIP">
                    {tUi("initialImportSkip")}
                  </option>
                </select>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={
                    exportInitialImportReportCsv
                  }
                >
                  {tUi("initialImportExportCsv")}
                </button>
              </div>

              <div className="mt-2 text-xs font-semibold text-stone-500">
                {tUi("initialImportPreviewTitle", {
                  count: filteredImportRows.length,
                })}
              </div>

              <div className="mt-2 max-h-[600px] overflow-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full min-w-[1400px] border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-stone-100 text-[10px] font-bold text-stone-600">
                    <tr>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "stockHistoryType"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColProducer"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColWineName"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColCuvee"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColVintage"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColColor"
                        )}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {tUi(
                          "initialImportColSize"
                        )}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {tUi(
                          "initialImportColQuantity"
                        )}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {tUi(
                          "initialImportColCost"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColMatch"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "initialImportColWarnings"
                        )}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {tUi(
                          "initialImportColAction"
                        )}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredImportRows.map(
                      (row) => {
                        const statusBadgeClass =
                          row.status === "READY"
                            ? "bg-emerald-100 text-emerald-700"
                            : row.status ===
                                "REVIEW"
                              ? "bg-amber-100 text-amber-700"
                              : row.status ===
                                  "DUPLICATE"
                                ? "bg-purple-100 text-purple-700"
                                : row.status ===
                                    "INVALID"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-stone-200 text-stone-600";

                        return (
                          <tr
                            key={row.row_id}
                            className="border-b border-stone-100 align-top"
                          >
                            <td className="px-2 py-1.5">
                              <span
                                className={
                                  "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold " +
                                  statusBadgeClass
                                }
                              >
                                {tUi(
                                  row.status ===
                                    "READY"
                                    ? "initialImportReady"
                                    : row.status ===
                                        "REVIEW"
                                      ? "initialImportReview"
                                      : row.status ===
                                          "DUPLICATE"
                                        ? "initialImportDuplicate"
                                        : row.status ===
                                            "INVALID"
                                          ? "initialImportInvalid"
                                          : "initialImportSkip"
                                )}
                              </span>
                            </td>

                            <td className="px-2 py-1.5">
                              <input
                                className="input !h-7 w-28 !px-1.5 !py-0.5 text-[11px]"
                                value={
                                  row.producer
                                }
                                onChange={(e) =>
                                  updateInitialImportRowField(
                                    row.row_id,
                                    "producer",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5">
                              <input
                                className="input !h-7 w-32 !px-1.5 !py-0.5 text-[11px]"
                                value={
                                  row.wine_name
                                }
                                onChange={(e) =>
                                  updateInitialImportRowField(
                                    row.row_id,
                                    "wine_name",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5">
                              <input
                                className="input !h-7 w-24 !px-1.5 !py-0.5 text-[11px]"
                                value={
                                  row.cuvee
                                }
                                onChange={(e) =>
                                  updateInitialImportRowField(
                                    row.row_id,
                                    "cuvee",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5">
                              <input
                                className="input !h-7 w-16 !px-1.5 !py-0.5 text-[11px]"
                                value={
                                  row.vintage
                                }
                                onChange={(e) =>
                                  updateInitialImportRowField(
                                    row.row_id,
                                    "vintage",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5">
                              <input
                                className="input !h-7 w-20 !px-1.5 !py-0.5 text-[11px]"
                                value={
                                  row.color
                                }
                                onChange={(e) =>
                                  updateInitialImportRowField(
                                    row.row_id,
                                    "color",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                className="input !h-7 w-16 !px-1.5 !py-0.5 text-right text-[11px]"
                                value={
                                  row.bottle_size_cl ??
                                  ""
                                }
                                onChange={(e) =>
                                  updateInitialImportRowNumberField(
                                    row.row_id,
                                    "bottle_size_cl",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="input !h-7 w-16 !px-1.5 !py-0.5 text-right text-[11px] font-bold"
                                value={
                                  row.quantity ??
                                  ""
                                }
                                onChange={(e) =>
                                  updateInitialImportRowQuantity(
                                    row.row_id,
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                className="input !h-7 w-20 !px-1.5 !py-0.5 text-right text-[11px]"
                                value={
                                  row.unit_cost_ht ??
                                  ""
                                }
                                onChange={(e) =>
                                  updateInitialImportRowNumberField(
                                    row.row_id,
                                    "unit_cost_ht",
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </td>

                            <td className="px-2 py-1.5">
                              {row.matched_wine_id ? (
                                <div>
                                  <div className="text-[10px] font-semibold text-blue-700">
                                    {tUi(
                                      "initialImportExistingMatch"
                                    )}
                                  </div>
                                  <div
                                    className="max-w-[140px] truncate text-[10px] text-stone-500"
                                    title={
                                      row.matched_wine_label ||
                                      ""
                                    }
                                  >
                                    {
                                      row.matched_wine_label
                                    }
                                  </div>
                                  <button
                                    type="button"
                                    className="mt-0.5 text-[9px] font-semibold text-stone-500 underline underline-offset-2 hover:text-stone-900"
                                    onClick={() =>
                                      clearInitialImportRowMatch(
                                        row.row_id
                                      )
                                    }
                                  >
                                    {tUi(
                                      "initialImportClearMatch"
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-400">
                                  {tUi(
                                    "initialImportNewWine"
                                  )}
                                </span>
                              )}
                            </td>

                            <td className="max-w-[180px] px-2 py-1.5">
                              {row.warnings.length >
                                0 && (
                                <div
                                  className="truncate text-[10px] text-amber-700"
                                  title={row.warnings.join(
                                    " / "
                                  )}
                                >
                                  {row.warnings.join(
                                    " / "
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-2 py-1.5 text-right">
                              {row.status !==
                                "READY" && (
                                <button
                                  type="button"
                                  className="rounded border border-stone-300 bg-white px-1.5 py-1 text-[9px] font-bold text-stone-700 hover:bg-stone-100"
                                  onClick={() =>
                                    markInitialImportRowReady(
                                      row.row_id
                                    )
                                  }
                                >
                                  {tUi(
                                    "initialImportMarkReady"
                                  )}
                                </button>
                              )}

                              {row.status !==
                                "SKIP" && (
                                <button
                                  type="button"
                                  className="mt-1 block rounded border border-stone-300 bg-white px-1.5 py-1 text-[9px] font-bold text-stone-500 hover:bg-stone-100"
                                  onClick={() =>
                                    markInitialImportRowSkip(
                                      row.row_id
                                    )
                                  }
                                >
                                  {tUi(
                                    "initialImportSkip"
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={commitInitialImportFile}
                  disabled={importCommitting}
                >
                  {importCommitting
                    ? tUi("stockHistoryLoading")
                    : tUi(
                        "initialImportImportButton"
                      )}
                </button>
              </div>
            </>
          )}

          {importResult && (
            <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
              <div className="text-sm font-bold text-emerald-800">
                {tUi("initialImportResultTitle")}
              </div>

              <div className="mt-1 text-xs text-emerald-800">
                {tUi("initialImportResultBatch")}:{" "}
                {importResult.batchId}
              </div>
              <div className="text-xs text-emerald-800">
                {tUi(
                  "initialImportResultCompany"
                )}
                : {importResult.companyName}
              </div>
              <div className="text-xs text-emerald-800">
                {tUi(
                  "initialImportResultWineCount"
                )}
                : {importResult.wineCount}
              </div>
              <div className="text-xs text-emerald-800">
                {tUi(
                  "initialImportResultTotalBottles"
                )}
                : {importResult.totalBottles}
              </div>
              <div className="text-xs text-emerald-800">
                {tUi("initialImportResultFile")}:{" "}
                {importResult.filename}
              </div>
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="card mt-4 border-2 border-blue-300 p-5">
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold">
              {tUi("customerAdminTitle")}
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              {tUi("customerAdminDescription")}
            </p>
          </div>

          {customersError && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {customersError}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className="input"
                placeholder={tUi(
                  "customerCompanyNamePlaceholder"
                )}
                value={newCustomerName}
                onChange={(e) =>
                  setNewCustomerName(
                    e.target.value
                  )
                }
              />

              <input
                className="input"
                placeholder={tUi("customerPlan")}
                value={newCustomerPlanName}
                onChange={(e) =>
                  setNewCustomerPlanName(
                    e.target.value
                  )
                }
              />

              <input
                type="number"
                step="0.01"
                className="input"
                placeholder={tUi(
                  "customerInitialFee"
                )}
                value={newCustomerInitialFee}
                onChange={(e) =>
                  setNewCustomerInitialFee(
                    e.target.value
                  )
                }
              />

              <input
                type="number"
                step="0.01"
                className="input"
                placeholder={tUi(
                  "customerMonthlyFee"
                )}
                value={newCustomerMonthlyFee}
                onChange={(e) =>
                  setNewCustomerMonthlyFee(
                    e.target.value
                  )
                }
              />

              <input
                className="input md:col-span-2"
                placeholder={tUi(
                  "customerInternalNotes"
                )}
                value={newCustomerNotes}
                onChange={(e) =>
                  setNewCustomerNotes(
                    e.target.value
                  )
                }
              />
            </div>

            {customerDuplicateWarning && (
              <div className="mt-3 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="font-bold">
                  {tUi(
                    "customerDuplicateWarningTitle"
                  )}
                </div>
                <div className="mt-1">
                  {tUi(
                    "customerDuplicateWarningBody",
                    {
                      names:
                        customerDuplicateWarning
                          .map((c) => c.name)
                          .join(", "),
                    }
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      createCustomerCompany(true)
                    }
                    disabled={customerCreating}
                  >
                    {tUi(
                      "customerConfirmCreateDuplicate"
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setCustomerDuplicateWarning(
                        null
                      )
                    }
                  >
                    {tUi(
                      "customerCancelDuplicate"
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  createCustomerCompany(false)
                }
                disabled={customerCreating}
              >
                {customerCreating
                  ? tUi("customerCreating")
                  : tUi("customerCreateButton")}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className="input min-w-[220px] flex-1"
              placeholder={tUi(
                "customerSearchPlaceholder"
              )}
              value={customerSearch}
              onChange={(e) =>
                setCustomerSearch(e.target.value)
              }
            />

            <select
              className="input"
              value={customerContractFilter}
              onChange={(e) =>
                setCustomerContractFilter(
                  e.target
                    .value as typeof customerContractFilter
                )
              }
              aria-label={tUi(
                "customerContractFilterLabel"
              )}
            >
              <option value="ALL">
                {tUi("customerFilterAll")}
              </option>
              <option value="PROSPECT">
                {tUi("customerContractProspect")}
              </option>
              <option value="TRIAL">
                {tUi("customerContractTrial")}
              </option>
              <option value="ACTIVE">
                {tUi("customerContractActive")}
              </option>
              <option value="PAUSED">
                {tUi("customerContractPaused")}
              </option>
              <option value="CANCELLED">
                {tUi(
                  "customerContractCancelled"
                )}
              </option>
            </select>

            <select
              className="input"
              value={customerOnboardingFilter}
              onChange={(e) =>
                setCustomerOnboardingFilter(
                  e.target
                    .value as typeof customerOnboardingFilter
                )
              }
              aria-label={tUi(
                "customerOnboardingFilterLabel"
              )}
            >
              <option value="ALL">
                {tUi("customerFilterAll")}
              </option>
              <option value="NEW">
                {tUi("customerOnboardingNew")}
              </option>
              <option value="WAITING_EXCEL">
                {tUi(
                  "customerOnboardingWaitingExcel"
                )}
              </option>
              <option value="EXCEL_RECEIVED">
                {tUi(
                  "customerOnboardingExcelReceived"
                )}
              </option>
              <option value="ANALYZING">
                {tUi(
                  "customerOnboardingAnalyzing"
                )}
              </option>
              <option value="READY_TO_IMPORT">
                {tUi(
                  "customerOnboardingReadyToImport"
                )}
              </option>
              <option value="IMPORTED">
                {tUi(
                  "customerOnboardingImported"
                )}
              </option>
              <option value="ACTIVE">
                {tUi("customerOnboardingActive")}
              </option>
            </select>
          </div>

          <div className="mt-3 max-h-[600px] overflow-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[1100px] border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-stone-100 text-[10px] font-bold text-stone-600">
                <tr>
                  <th className="px-2 py-2 text-left">
                    {tUi("customerColCompany")}
                  </th>
                  <th className="px-2 py-2 text-left">
                    {tUi(
                      "customerColContractStatus"
                    )}
                  </th>
                  <th className="px-2 py-2 text-left">
                    {tUi(
                      "customerColOnboardingStatus"
                    )}
                  </th>
                  <th className="px-2 py-2 text-right">
                    {tUi("customerColWineCount")}
                  </th>
                  <th className="px-2 py-2 text-right">
                    {tUi(
                      "customerColBottleCount"
                    )}
                  </th>
                  <th className="px-2 py-2 text-right">
                    {tUi(
                      "customerColImportCount"
                    )}
                  </th>
                  <th className="px-2 py-2 text-left">
                    {tUi(
                      "customerColLatestImport"
                    )}
                  </th>
                  <th className="px-2 py-2 text-left">
                    {tUi("customerColCreatedAt")}
                  </th>
                  <th className="px-2 py-2 text-right">
                    {tUi("customerColActions")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {customersLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-6 text-center text-stone-500"
                    >
                      {tUi("stockHistoryLoading")}
                    </td>
                  </tr>
                ) : filteredCustomers.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-6 text-center text-stone-500"
                    >
                      {tUi("customerNoResults")}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr
                      key={c.company_id}
                      className="border-b border-stone-100 align-top"
                    >
                      <td className="px-2 py-1.5 font-semibold">
                        {c.company_name}

                        {c.initial_import_batch_count >
                          0 && (
                          <div className="mt-0.5 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                            {tUi(
                              "customerInitialImportDoneBadge"
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-1.5">
                        {customerContractLabel(
                          c.contract_status
                        )}
                      </td>

                      <td className="px-2 py-1.5">
                        {customerOnboardingLabel(
                          c.onboarding_status
                        )}
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        {c.wine_count.toLocaleString()}
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        {c.current_bottles.toLocaleString()}
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        {c.initial_import_batch_count}
                      </td>

                      <td className="px-2 py-1.5">
                        {c.latest_initial_import_at
                          ? new Date(
                              c.latest_initial_import_at
                            ).toLocaleDateString()
                          : tUi(
                              "customerLatestImportNone"
                            )}
                      </td>

                      <td className="px-2 py-1.5">
                        {new Date(
                          c.company_created_at
                        ).toLocaleDateString()}
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-100"
                          onClick={() =>
                            openCustomerDetail(c)
                          }
                        >
                          {tUi("customerDetails")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedCustomerRow &&
            customerEditDraft && (
              <div className="mt-4 rounded-xl border-2 border-blue-300 bg-blue-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-stone-800">
                    {tUi("customerDetailsTitle")}
                  </div>

                  <div className="text-[10px] text-stone-400">
                    {tUi("customerCompanyId")}:{" "}
                    {selectedCustomerRow.company_id}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <label>
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi("customerCompanyName")}
                    </div>
                    <input
                      className="input w-full"
                      value={
                        customerEditDraft.companyName
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "companyName",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi(
                        "customerContractStatusLabel"
                      )}
                    </div>
                    <select
                      className="input w-full"
                      value={
                        customerEditDraft.contractStatus
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "contractStatus",
                          e.target.value
                        )
                      }
                    >
                      <option value="PROSPECT">
                        {tUi(
                          "customerContractProspect"
                        )}
                      </option>
                      <option value="TRIAL">
                        {tUi(
                          "customerContractTrial"
                        )}
                      </option>
                      <option value="ACTIVE">
                        {tUi(
                          "customerContractActive"
                        )}
                      </option>
                      <option value="PAUSED">
                        {tUi(
                          "customerContractPaused"
                        )}
                      </option>
                      <option value="CANCELLED">
                        {tUi(
                          "customerContractCancelled"
                        )}
                      </option>
                    </select>
                  </label>

                  <label>
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi(
                        "customerOnboardingStatusLabel"
                      )}
                    </div>
                    <select
                      className="input w-full"
                      value={
                        customerEditDraft.onboardingStatus
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "onboardingStatus",
                          e.target.value
                        )
                      }
                    >
                      <option value="NEW">
                        {tUi(
                          "customerOnboardingNew"
                        )}
                      </option>
                      <option value="WAITING_EXCEL">
                        {tUi(
                          "customerOnboardingWaitingExcel"
                        )}
                      </option>
                      <option value="EXCEL_RECEIVED">
                        {tUi(
                          "customerOnboardingExcelReceived"
                        )}
                      </option>
                      <option value="ANALYZING">
                        {tUi(
                          "customerOnboardingAnalyzing"
                        )}
                      </option>
                      <option value="READY_TO_IMPORT">
                        {tUi(
                          "customerOnboardingReadyToImport"
                        )}
                      </option>
                      <option value="IMPORTED">
                        {tUi(
                          "customerOnboardingImported"
                        )}
                      </option>
                      <option value="ACTIVE">
                        {tUi(
                          "customerOnboardingActive"
                        )}
                      </option>
                    </select>
                  </label>

                  <label>
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi("customerPlan")}
                    </div>
                    <input
                      className="input w-full"
                      value={
                        customerEditDraft.planName
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "planName",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi("customerInitialFee")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full"
                      value={
                        customerEditDraft.initialFeeEur
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "initialFeeEur",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi("customerMonthlyFee")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-full"
                      value={
                        customerEditDraft.monthlyFeeEur
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "monthlyFeeEur",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label className="md:col-span-3">
                    <div className="mb-1 text-[10px] font-semibold text-stone-500">
                      {tUi(
                        "customerInternalNotes"
                      )}
                    </div>
                    <input
                      className="input w-full"
                      value={
                        customerEditDraft.internalNotes
                      }
                      onChange={(e) =>
                        updateCustomerDraftField(
                          "internalNotes",
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                    <div className="text-[10px] font-semibold text-stone-500">
                      {tUi("customerCurrentStock")}
                    </div>
                    <div className="text-sm">
                      {tUi("customerWineCount")}:{" "}
                      {
                        selectedCustomerRow.wine_count
                      }
                      {" · "}
                      {tUi("customerBottleCount")}:{" "}
                      {
                        selectedCustomerRow.current_bottles
                      }
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {tUi(
                        "customerChargeableWineCount",
                        {
                          count:
                            selectedCustomerRow.latest_initial_import_unique_wines ??
                            selectedCustomerRow.wine_count,
                        }
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                    <div className="text-[10px] font-semibold text-stone-500">
                      {tUi(
                        "customerImportHistory"
                      )}
                    </div>

                    {selectedCustomerRow.initial_import_batch_count ===
                    0 ? (
                      <div className="text-xs text-stone-400">
                        {tUi(
                          "customerNoImportHistory"
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-stone-600">
                        <div>
                          {
                            selectedCustomerRow.latest_initial_import_filename
                          }
                        </div>
                        <div>
                          {tUi(
                            "customerWineCount"
                          )}
                          :{" "}
                          {
                            selectedCustomerRow.latest_initial_import_unique_wines
                          }
                          {" · "}
                          {tUi(
                            "customerBottleCount"
                          )}
                          :{" "}
                          {
                            selectedCustomerRow.latest_initial_import_total_bottles
                          }
                        </div>
                        <div>
                          {selectedCustomerRow.latest_initial_import_at
                            ? new Date(
                                selectedCustomerRow.latest_initial_import_at
                              ).toLocaleString()
                            : ""}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[10px] text-stone-400">
                  {tUi("customerNoDeleteNotice")}
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeCustomerDetail}
                    disabled={customerSaving}
                  >
                    {tUi("customerClose")}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveCustomerDetail}
                    disabled={customerSaving}
                  >
                    {customerSaving
                      ? tUi("customerSaving")
                      : tUi("customerSave")}
                  </button>
                </div>
              </div>
            )}
        </section>
      )}

      {isAdmin && (
        <section className="card mt-4 border-2 border-purple-300 p-5">
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold">
              {tUi("customerUsersTitle")}
            </h2>

            <p className="mt-1 text-sm text-stone-600">
              {tUi("customerUsersDescription")}
            </p>
          </div>

          <div className="mt-4 max-w-sm">
            <label>
              <div className="mb-1 text-xs font-semibold text-stone-600">
                {tUi("customerUsersCompany")}
              </div>
              <select
                className="input w-full"
                value={
                  companyUsersSelectedCompanyId
                }
                onChange={(e) =>
                  selectCompanyUsersCompany(
                    e.target.value
                  )
                }
              >
                <option value="">
                  {tUi(
                    "customerUsersSelectCompanyPlaceholder"
                  )}
                </option>
                {adminCompanies.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!companyUsersSelectedCompanyId ? (
            <div className="mt-4 text-sm text-stone-500">
              {tUi(
                "customerUsersSelectCompanyPrompt"
              )}
            </div>
          ) : (
            <>
              {companyUsersError && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {companyUsersError}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="text-sm font-bold text-stone-800">
                  {tUi(
                    "customerUsersInviteHeading",
                    {
                      company:
                        adminCompanies.find(
                          (c) =>
                            c.id ===
                            companyUsersSelectedCompanyId
                        )?.name || "",
                    }
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="email"
                    className="input min-w-[240px] flex-1"
                    placeholder={tUi(
                      "customerUsersInviteEmail"
                    )}
                    value={inviteEmail}
                    onChange={(e) =>
                      setInviteEmail(
                        e.target.value
                      )
                    }
                  />

                  <select
                    className="input"
                    value={newCustomerInviteRole}
                    onChange={(e) =>
                      setNewCustomerInviteRole(
                        e.target
                          .value as typeof newCustomerInviteRole
                      )
                    }
                    aria-label={tUi(
                      "customerUsersInviteRoleLabel"
                    )}
                  >
                    <option value="owner">
                      {tUi(
                        "customerUsersRoleOwner"
                      )}
                    </option>
                    <option value="staff">
                      {tUi(
                        "customerUsersRoleStaff"
                      )}
                    </option>
                    <option value="viewer">
                      {tUi(
                        "customerUsersRoleViewer"
                      )}
                    </option>
                  </select>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={inviteCompanyUser}
                    disabled={inviteSending}
                  >
                    {inviteSending
                      ? tUi(
                          "customerUsersInviting"
                        )
                      : tUi(
                          "customerUsersInviteButton"
                        )}
                  </button>
                </div>

                {inviteResultMessage && (
                  <div
                    className={
                      "mt-2 rounded-lg border px-3 py-2 text-xs " +
                      (inviteResultMessage.type ===
                      "success"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : inviteResultMessage.type ===
                            "warning"
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-red-300 bg-red-50 text-red-700")
                    }
                  >
                    {inviteResultMessage.text}
                  </div>
                )}
              </div>

              <div className="mt-4 max-h-[500px] overflow-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full min-w-[800px] border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-stone-100 text-[10px] font-bold text-stone-600">
                    <tr>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "customerUsersColEmail"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "customerUsersColCreatedAt"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "customerUsersColEmailConfirmed"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "customerUsersColLastSignIn"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "customerUsersColStatus"
                        )}
                      </th>
                      <th className="px-2 py-2 text-left">
                        {tUi(
                          "customerUsersColRole"
                        )}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {tUi(
                          "customerUsersColAction"
                        )}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {companyUsersLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-6 text-center text-stone-500"
                        >
                          {tUi(
                            "stockHistoryLoading"
                          )}
                        </td>
                      </tr>
                    ) : companyUsers.length ===
                      0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-6 text-center text-stone-500"
                        >
                          {tUi(
                            "customerUsersNoUsers"
                          )}
                        </td>
                      </tr>
                    ) : (
                      companyUsers.map((u) => (
                        <tr
                          key={u.userId}
                          className="border-b border-stone-100"
                        >
                          <td className="px-2 py-1.5 font-semibold">
                            {u.email ||
                              u.userId}
                          </td>

                          <td className="px-2 py-1.5">
                            {u.createdAt
                              ? new Date(
                                  u.createdAt
                                ).toLocaleDateString()
                              : ""}
                          </td>

                          <td className="px-2 py-1.5">
                            {u.emailConfirmedAt
                              ? tUi(
                                  "customerUsersYes"
                                )
                              : tUi(
                                  "customerUsersNo"
                                )}
                          </td>

                          <td className="px-2 py-1.5">
                            {u.lastSignInAt
                              ? new Date(
                                  u.lastSignInAt
                                ).toLocaleDateString()
                              : tUi(
                                  "customerUsersNever"
                                )}
                          </td>

                          <td className="px-2 py-1.5">
                            <span
                              className={
                                "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold " +
                                companyUserStatusBadgeClass(
                                  u.status
                                )
                              }
                            >
                              {companyUserStatusLabel(
                                u.status
                              )}
                            </span>
                          </td>

                          <td className="px-2 py-1.5">
                            <select
                              className="input !h-7 !px-1.5 !py-0.5 text-[10px]"
                              value={u.role}
                              onChange={(e) =>
                                updateCompanyUserRole(
                                  u.userId,
                                  e.target.value
                                )
                              }
                              disabled={
                                updatingRoleUserId ===
                                u.userId
                              }
                              aria-label={tUi(
                                "customerUsersColRole"
                              )}
                            >
                              <option value="owner">
                                {tUi(
                                  "customerUsersRoleOwner"
                                )}
                              </option>
                              <option value="staff">
                                {tUi(
                                  "customerUsersRoleStaff"
                                )}
                              </option>
                              <option value="viewer">
                                {tUi(
                                  "customerUsersRoleViewer"
                                )}
                              </option>
                            </select>
                          </td>

                          <td className="px-2 py-1.5 text-right">
                            {!u.emailConfirmedAt ? (
                              <button
                                type="button"
                                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                                onClick={() =>
                                  resendCompanyUserInvite(
                                    u.userId
                                  )
                                }
                                disabled={Boolean(
                                  resendingUserId
                                )}
                              >
                                {resendingUserId ===
                                u.userId
                                  ? tUi(
                                      "customerUsersResending"
                                    )
                                  : tUi(
                                      "customerUsersResendInvite"
                                    )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                                onClick={() =>
                                  sendPasswordSetupLink(
                                    u.userId
                                  )
                                }
                                disabled={Boolean(
                                  sendingPasswordSetupUserId
                                )}
                              >
                                {sendingPasswordSetupUserId ===
                                u.userId
                                  ? tUi(
                                      "customerUsersSendingPasswordSetup"
                                    )
                                  : tUi(
                                      "customerUsersSendPasswordSetup"
                                    )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}