# Silly Studio

手機優先、電腦也能用的 SillyTavern 角色卡與 Lorebook 編輯器。純前端，資料只存在你的瀏覽器。

## 線上版（可安裝成 app）

https://yolanda1027-sudo.github.io/stEditor/

用手機瀏覽器打開後，從選單選「加到主畫面」／「安裝應用程式」，就會變成一個獨立的 app，開過一次之後沒有網路也能用。
有新版本時畫面上方會出現「有新版本可以更新」，點「更新」就好。

每次推送到 `ccr-541dd608-6189sf` 分支，GitHub Actions 會自動跑測試、打包並部署（`.github/workflows/deploy.yml`）。
第一次使用前要到 repo 的 Settings → Pages → Source 選 **GitHub Actions**。

## 開始使用

```bash
npm install
npm run dev        # http://localhost:5173/
```

### 用手機測試

電腦和手機連同一個 Wi-Fi，然後：

```bash
npm run dev:phone
```

終端機會印出一行 `Network: http://192.168.x.x:5173/`，用手機瀏覽器打開那個網址就可以了。
打不開的話，通常是電腦防火牆擋住了 5173 port（Windows 第一次執行時會跳視窗問要不要允許，選「允許」）。

其他指令：

| 指令 | 用途 |
| --- | --- |
| `npm run dev:phone` | 開放給同一個 Wi-Fi 的手機連線 |
| `npm run typecheck` | 檢查 TypeScript 錯誤 |
| `npm test` | 跑格式轉換與 PNG 讀寫的測試 |
| `npm run build` | 打包到 `dist/` |

## 目前功能

- **角色卡（Character Card V3）**：全部 V3 欄位、備用開場白／群組專用開場白（多項目）、來源、角色備註（`extensions.depth_prompt`）、Tags chips（Enter／逗號新增、自動去重複）、角色圖片。
- **Lorebook**：條目列表、搜尋、啟用開關、新增／複製／刪除／排序；常用設定在前，進階設定（次要關鍵詞、群組、遞迴、時間效果、額外比對來源……）可收合。
- **長文欄位**：點擊進入全螢幕編輯，手機返回鍵也能退回。
- **匯入**：角色卡 PNG（`ccv3` 優先，其次 `chara`）／JSON（V1、V2、V3），Lorebook JSON（SillyTavern 世界書、`lorebook_v3`、`character_book`）。
- **匯出**：PNG 角色卡（同時寫入 `chara` V2 與 `ccv3` V3，與 SillyTavern 相同）、V3 JSON、SillyTavern 世界書 JSON、`lorebook_v3` JSON。
- **本機草稿**：自動存到 localStorage。這只是草稿，清除瀏覽資料就會消失，重要內容請匯出備份。超過 7 天沒匯出時，頁面底部會提醒備份。
- **正則腳本（Regex Scripts）**：角色卡分頁「擴充功能」裡。編輯 SillyTavern 正規表示式擴充功能的腳本（存在 `extensions.regex_scripts`，會跟著角色卡匯出），欄位和 SillyTavern 一致：尋找、取代為、修剪掉、影響條目、深度、巨集替換模式、暫時性等。附測試區（文字或 HTML 預覽），可以匯入／匯出 SillyTavern 格式的腳本 JSON。執行規則對照 SillyTavern `extensions/regex/engine.js`。
- **搜尋／取代**：分頁旁的 🔍。一次搜尋角色卡所有文字欄位、開場白、角色備註、標籤，以及 Lorebook 名稱、說明、條目名稱、關鍵詞、內容；可以只搜角色卡或只搜 Lorebook。支援區分大小寫、正規表示式（取代可用 `$1`）。可以單一取代或全部取代，全部取代算一步、可以復原。點結果會打開該欄位並選取符合的文字。
- **復原／重做**：頁首、子頁面右上角、全螢幕編輯底部都有 ↶ ↷；電腦可用 Ctrl+Z／Ctrl+Shift+Z（Ctrl+Y）。連續打字算一步，停頓超過 1 秒或換欄位才算新的一步。紀錄只保留在這次開啟期間，重新整理後會清空。
- **PWA**：可安裝到主畫面、離線使用、有新版本時提示更新。

匯入時不認得的欄位（例如其他擴充功能寫入的 `extensions`）會原樣保留，再匯出時不會遺失。

## 檔案結構

```
src/
  App.tsx                 狀態、頁面切換、匯入匯出流程
  types.ts                資料型別
  lib/card.ts             角色卡正規化與 V2/V3 輸出
  lib/lorebook.ts         SillyTavern 世界書 ⇄ character_book 轉換
  lib/png.ts              PNG tEXt chunk 讀寫
  lib/storage.ts          本機草稿
  components/             各個畫面與欄位元件
tests/formats.test.ts     格式與 PNG 測試
```

格式轉換對照 SillyTavern 原始碼：`public/scripts/world-info.js`（`newWorldInfoEntryDefinition`、`convertCharacterBook`）、`src/endpoints/characters.js`（`convertWorldInfoToCharacterBook`）、`src/character-card-parser.js`。

## 之後要做

1. 剪貼簿
2. 更多手機實機測試
3. 評估 IndexedDB、Capacitor／Android 封裝（APK）
