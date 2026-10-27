# Silly Studio

手機優先、電腦也能用的 SillyTavern 角色卡與 Lorebook 編輯器。純前端，資料只存在你的瀏覽器。

## 開始使用

```bash
npm install
npm run dev        # http://localhost:5173/
```

其他指令：

| 指令 | 用途 |
| --- | --- |
| `npm run typecheck` | 檢查 TypeScript 錯誤 |
| `npm test` | 跑格式轉換與 PNG 讀寫的測試 |
| `npm run build` | 打包到 `dist/` |

## 目前功能

- **角色卡（Character Card V3）**：全部 V3 欄位、備用開場白／群組專用開場白（多項目）、來源、角色備註（`extensions.depth_prompt`）、Tags chips（Enter／逗號新增、自動去重複）、角色圖片。
- **Lorebook**：條目列表、搜尋、啟用開關、新增／複製／刪除／排序；常用設定在前，進階設定（次要關鍵詞、群組、遞迴、時間效果、額外比對來源……）可收合。
- **長文欄位**：點擊進入全螢幕編輯，手機返回鍵也能退回。
- **匯入**：角色卡 PNG（`ccv3` 優先，其次 `chara`）／JSON（V1、V2、V3），Lorebook JSON（SillyTavern 世界書、`lorebook_v3`、`character_book`）。
- **匯出**：PNG 角色卡（同時寫入 `chara` V2 與 `ccv3` V3，與 SillyTavern 相同）、V3 JSON、SillyTavern 世界書 JSON、`lorebook_v3` JSON。
- **本機草稿**：自動存到 localStorage。這只是草稿，清除瀏覽資料就會消失，重要內容請匯出備份。

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

1. 搜尋／取代、復原／重做、剪貼簿
2. 更多手機實機測試
3. 評估 IndexedDB、Capacitor／Android 封裝
