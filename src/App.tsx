import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './App.css';
import type { CardData, ListFieldKey, Lorebook, LongFieldKey, WIEntry } from './types';
import { buildCardV2, buildCardV3, emptyCard, getDepthPrompt, parseCardJson, type DepthPrompt } from './lib/card';
import {
  emptyLorebook,
  newEntry,
  nextUid,
  parseLorebookJson,
  toLorebookV3,
  toSillyTavernWorld,
} from './lib/lorebook';
import { isPng, readCardFromPng, stripCardFromPng, writeCardToPng } from './lib/png';
import {
  bytesToDataUrl,
  dataUrlToBytes,
  defaultAvatarPng,
  downloadBlob,
  downloadJson,
  imageFileToPng,
  safeFileName,
} from './lib/files';
import {
  clearDraft,
  loadAvatar,
  loadDraft,
  loadLastExport,
  requestPersistentStorage,
  saveAvatar,
  saveDraft,
  saveLastExport,
} from './lib/storage';
import { dedupe, rejected } from './lib/util';
import { CharacterEditor, LIST_FIELDS, LONG_FIELDS } from './components/CharacterEditor';
import { FullscreenEditor } from './components/FullscreenEditor';
import { GreetingList } from './components/GreetingList';
import { LorebookList } from './components/LorebookList';
import { LorebookEntryEditor } from './components/LorebookEntryEditor';
import { FilePanel } from './components/FilePanel';
import { NumberField, SelectField } from './components/fields';
import { UndoRedoButtons, UndoRedoContext, useUndoHistory, useUndoShortcuts } from './components/UndoRedo';
import { SearchPanel, initialSearchState, type SearchState } from './components/SearchPanel';
import { applyReplace, buildPattern, type SearchLocation } from './lib/search';
import {
  getRegexScripts,
  newRegexScript,
  parseRegexScriptsJson,
  withRegexScripts,
  type RegexScript,
} from './lib/regexScripts';
import { RegexScriptList } from './components/RegexScriptList';
import { RegexScriptEditor } from './components/RegexScriptEditor';

type Tab = 'card' | 'lorebook';

type TextTarget =
  | { kind: 'card'; field: LongFieldKey }
  | { kind: 'listItem'; list: ListFieldKey; index: number }
  | { kind: 'depthPrompt' }
  | { kind: 'entryContent'; uid: number }
  | { kind: 'bookDescription' }
  | { kind: 'regexReplace'; id: string };

type View =
  | { type: 'text'; target: TextTarget; select?: [number, number] }
  | { type: 'search' }
  | { type: 'regexList' }
  | { type: 'regex'; id: string }
  | { type: 'list'; list: ListFieldKey }
  | { type: 'entry'; uid: number }
  | { type: 'files' };

// 子頁面用瀏覽器歷史紀錄管理，手機的返回鍵也能退回上一頁
function useViewStack() {
  const [stack, setStack] = useState<View[]>([]);
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const push = useCallback((view: View) => {
    history.pushState({ sillyStudio: true }, '');
    setStack((s) => [...s, view]);
  }, []);
  const back = useCallback(() => history.back(), []);
  return { current: stack.at(-1) ?? null, push, back };
}

function hasCardContent(card: CardData): boolean {
  return Boolean(card.name || card.description || card.first_mes || card.personality || card.scenario);
}

export default function App() {
  const [initial] = useState(loadDraft);
  const [values, setValues] = useState<CardData>(initial.card);
  const [lorebook, setLorebook] = useState<Lorebook>(initial.lorebook);
  const [embedLorebook, setEmbedLorebook] = useState(initial.embedLorebook);
  const [avatar, setAvatar] = useState<string | null>(loadAvatar);
  const [tab, setTab] = useState<Tab>('card');
  const [savedAt, setSavedAt] = useState<number | null>(initial.savedAt);
  const [saveError, setSaveError] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [lastExport, setLastExport] = useState<number | null>(loadLastExport);
  const [search, setSearch] = useState<SearchState>(initialSearchState);
  const [regexTestInput, setRegexTestInput] = useState('');
  const { current, push, back } = useViewStack();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    requestPersistentStorage();
  }, []);

  const notify = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 5000 : 2500);
  }, []);

  // ---------- 復原／重做 ----------

  const applySnapshot = useCallback(
    (s: { values: CardData; lorebook: Lorebook; embedLorebook: boolean; avatar: string | null }) => {
      setValues(s.values);
      setLorebook(s.lorebook);
      setEmbedLorebook(s.embedLorebook);
      setAvatar(s.avatar);
    },
    [],
  );
  const undoRedo = useUndoHistory(
    { values, lorebook, embedLorebook, avatar },
    applySnapshot,
    useCallback((kind: 'undo' | 'redo') => notify(kind === 'undo' ? '已復原' : '已重做'), [notify]),
  );
  useUndoShortcuts(undoRedo);

  // 自動儲存草稿（停止輸入 0.6 秒後）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const time = saveDraft({ card: values, lorebook, embedLorebook });
      setSaveError(time === null);
      if (time) setSavedAt(time);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [values, lorebook, embedLorebook]);

  useEffect(() => {
    if (!saveAvatar(avatar) && avatar) notify('圖片太大，無法存進本機草稿；匯出前請不要重新整理頁面。', 'error');
  }, [avatar, notify]);

  // ---------- 角色卡 ----------

  const updateField = useCallback(<K extends keyof CardData>(field: K, value: CardData[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const tags = values.tags;

  const addTag = (newTags: string[]) => {
    const next = dedupe([...tags, ...newTags.map((t) => t.trim())].filter(Boolean));
    if (next.length !== tags.length) updateField('tags', next);
    return rejected(tags, newTags);
  };

  const removeTag = (tag: string) => updateField('tags', tags.filter((t) => t !== tag));

  const updateDepthPrompt = (patch: Partial<DepthPrompt>) => {
    setValues((prev) => ({
      ...prev,
      extensions: { ...prev.extensions, depth_prompt: { ...getDepthPrompt(prev), ...patch } },
    }));
  };

  async function pickAvatar(file: File) {
    try {
      const png = await imageFileToPng(file);
      setAvatar(await bytesToDataUrl(stripCardFromPng(png), 'image/png'));
    } catch (error) {
      notify(error instanceof Error ? error.message : '圖片讀取失敗。', 'error');
    }
  }

  // ---------- Lorebook ----------

  const updateBook = (patch: Partial<Lorebook>) => setLorebook((prev) => ({ ...prev, ...patch }));

  const updateEntry = useCallback((uid: number, patch: Partial<WIEntry>) => {
    setLorebook((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.uid === uid ? { ...e, ...patch } : e)),
    }));
  }, []);

  function addEntry() {
    const uid = nextUid(lorebook.entries);
    setLorebook((prev) => ({ ...prev, entries: [...prev.entries, newEntry(uid)] }));
    push({ type: 'entry', uid });
  }

  function deleteEntry(uid: number) {
    const entry = lorebook.entries.find((e) => e.uid === uid);
    if (!entry || !confirm(`確定要刪除「${entry.comment || '未命名條目'}」嗎？刪除後可以按「復原」救回來。`)) return;
    back();
    setLorebook((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.uid !== uid) }));
    notify('條目已刪除');
  }

  function duplicateEntry(uid: number) {
    const index = lorebook.entries.findIndex((e) => e.uid === uid);
    if (index < 0) return;
    const copy = { ...structuredClone(lorebook.entries[index]), uid: nextUid(lorebook.entries) };
    copy.comment = copy.comment ? `${copy.comment}（副本）` : '';
    setLorebook((prev) => {
      const entries = [...prev.entries];
      entries.splice(index + 1, 0, copy);
      return { ...prev, entries };
    });
    notify('已複製條目，副本在原條目的下一個');
  }

  function moveEntry(uid: number, delta: number) {
    setLorebook((prev) => {
      const index = prev.entries.findIndex((e) => e.uid === uid);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= prev.entries.length) return prev;
      const entries = [...prev.entries];
      [entries[index], entries[target]] = [entries[target], entries[index]];
      return { ...prev, entries };
    });
  }

  // ---------- 匯入／匯出 ----------

  async function importCard(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text: string;
      let image: string | null = null;
      if (isPng(bytes)) {
        const found = readCardFromPng(bytes);
        if (!found) throw new Error('這張 PNG 裡沒有角色卡資料。');
        text = found;
        image = await bytesToDataUrl(stripCardFromPng(bytes), 'image/png');
      } else {
        text = new TextDecoder().decode(bytes);
      }
      const parsed = parseCardJson(JSON.parse(text));
      if (hasCardContent(values) && !confirm('匯入會取代目前編輯中的角色卡，確定嗎？\n（建議先匯出備份）')) return;
      if (parsed.book && lorebook.entries.length && !confirm('這張角色卡內嵌了 Lorebook，要取代目前 Lorebook 分頁的內容嗎？')) {
        parsed.book = null;
      }
      setValues(parsed.card);
      setAvatar(image);
      if (parsed.book) {
        setLorebook(parsed.book);
        setEmbedLorebook(true);
      } else {
        setEmbedLorebook(false);
      }
      back();
      setTab('card');
      notify(
        parsed.book
          ? `已匯入「${parsed.card.name}」與 ${parsed.book.entries.length} 個 Lorebook 條目`
          : `已匯入「${parsed.card.name || '未命名角色'}」`,
      );
    } catch (error) {
      notify(error instanceof SyntaxError ? '檔案不是有效的 JSON。' : errorText(error), 'error');
    }
  }

  async function importLorebook(file: File) {
    try {
      const book = parseLorebookJson(JSON.parse(await file.text()), file.name);
      if (lorebook.entries.length && !confirm(`匯入會取代目前的 ${lorebook.entries.length} 個條目，確定嗎？`)) return;
      setLorebook(book);
      back();
      setTab('lorebook');
      notify(`已匯入 ${book.entries.length} 個條目`);
    } catch (error) {
      notify(error instanceof SyntaxError ? '檔案不是有效的 JSON。' : errorText(error), 'error');
    }
  }

  function requireName(): boolean {
    if (values.name.trim()) return true;
    notify('請先在角色卡分頁填寫角色名稱', 'error');
    return false;
  }

  const bookForCard = embedLorebook ? lorebook : null;

  function markExported() {
    const now = Date.now();
    saveLastExport(now);
    setLastExport(now);
  }

  function exportCardJson() {
    if (!requireName()) return;
    downloadJson(buildCardV3(values, bookForCard), `${safeFileName(values.name, 'character')}.json`);
    markExported();
  }

  async function exportCardPng() {
    if (!requireName()) return;
    try {
      const base = avatar ? await dataUrlToBytes(avatar) : await defaultAvatarPng(values.name);
      const png = writeCardToPng(
        base,
        JSON.stringify(buildCardV2(values, bookForCard)),
        JSON.stringify(buildCardV3(values, bookForCard)),
      );
      downloadBlob(new Blob([png as BlobPart], { type: 'image/png' }), `${safeFileName(values.name, 'character')}.png`);
      markExported();
    } catch (error) {
      notify(errorText(error), 'error');
    }
  }

  function lorebookFileName() {
    return safeFileName(lorebook.name || values.name, 'lorebook');
  }

  function exportWorld() {
    if (!lorebook.entries.length) return notify('Lorebook 還沒有條目', 'error');
    downloadJson(toSillyTavernWorld(lorebook), `${lorebookFileName()}.json`);
    markExported();
  }

  function exportLorebookV3() {
    if (!lorebook.entries.length) return notify('Lorebook 還沒有條目', 'error');
    downloadJson(toLorebookV3({ ...lorebook, name: lorebook.name || values.name }), `${lorebookFileName()}.lorebook_v3.json`);
    markExported();
  }

  function newCharacter() {
    if (!confirm('確定要清空角色卡與 Lorebook 嗎？沒有匯出的內容會消失。')) return;
    clearDraft();
    setValues(emptyCard());
    setLorebook(emptyLorebook());
    setEmbedLorebook(false);
    setAvatar(null);
    setLastExport(null);
    back();
    setTab('card');
    notify('已開新角色卡');
  }

  // ---------- 全螢幕文字編輯 ----------

  function renderTextEditor(target: TextTarget, select?: [number, number]) {
    switch (target.kind) {
      case 'card': {
        const info = LONG_FIELDS[target.field];
        return (
          <FullscreenEditor
            title={info.label}
            en={info.en}
            value={values[target.field]}
            placeholder={info.placeholder}
            onChange={(v) => updateField(target.field, v)}
            onClose={back}
            initialSelection={select}
          />
        );
      }
      case 'listItem': {
        const info = LIST_FIELDS[target.list];
        const items = values[target.list];
        if (target.index >= items.length) return <MissingView onBack={back} />;
        return (
          <FullscreenEditor
            title={`${info.itemName} ${target.index + 1}`}
            en={info.en}
            value={items[target.index]}
            onChange={(v) =>
              setValues((prev) => ({
                ...prev,
                [target.list]: prev[target.list].map((item, i) => (i === target.index ? v : item)),
              }))
            }
            onClose={back}
            initialSelection={select}
          />
        );
      }
      case 'depthPrompt': {
        const dp = getDepthPrompt(values);
        return (
          <FullscreenEditor
            title="角色備註"
            en="Character's Note"
            value={dp.prompt}
            placeholder="會在指定深度插入對話中，適合放需要角色一直記得的提醒"
            onChange={(prompt) => updateDepthPrompt({ prompt })}
            onClose={back}
            initialSelection={select}
            extra={
              <div className="field-grid">
                <NumberField
                  label="深度"
                  en="Depth"
                  value={dp.depth}
                  min={0}
                  onChange={(depth) => updateDepthPrompt({ depth: depth ?? 0 })}
                />
                <SelectField
                  label="角色"
                  en="Role"
                  value={dp.role}
                  options={[
                    { value: 'system', label: '系統 System' },
                    { value: 'user', label: '使用者 User' },
                    { value: 'assistant', label: '助理 Assistant' },
                  ]}
                  onChange={(role) => updateDepthPrompt({ role })}
                />
              </div>
            }
          />
        );
      }
      case 'entryContent': {
        const entry = lorebook.entries.find((e) => e.uid === target.uid);
        if (!entry) return <MissingView onBack={back} />;
        return (
          <FullscreenEditor
            title={entry.comment || '未命名條目'}
            en="Content"
            value={entry.content}
            placeholder="觸發時要插入提示詞的內容"
            onChange={(content) => updateEntry(target.uid, { content })}
            onClose={back}
            initialSelection={select}
          />
        );
      }
      case 'bookDescription':
        return (
          <FullscreenEditor
            title="Lorebook 說明"
            en="Description"
            value={lorebook.description}
            onChange={(description) => updateBook({ description })}
            onClose={back}
            initialSelection={select}
          />
        );
      case 'regexReplace': {
        const script = regexScripts.find((r) => r.id === target.id);
        if (!script) return <MissingView onBack={back} />;
        return (
          <FullscreenEditor
            title={script.scriptName || '未命名腳本'}
            en="Replace With"
            value={script.replaceString}
            placeholder="{{match}} 代表整段符合的文字，$1、$2 代表括號抓到的內容"
            monospace
            onChange={(replaceString) => updateRegexScript(target.id, { replaceString })}
            onClose={back}
          />
        );
      }
    }
  }

  const daysSinceExport = lastExport ? Math.floor((Date.now() - lastExport) / 86_400_000) : null;
  const hasWork = hasCardContent(values) || lorebook.entries.length > 0;
  const backupReminder = !hasWork
    ? null
    : daysSinceExport === null
      ? '💾 還沒有匯出過備份，點這裡匯出'
      : daysSinceExport >= 7
        ? `💾 上次匯出是 ${daysSinceExport} 天前，點這裡備份`
        : null;

  // ---------- 正則腳本 ----------

  const regexScripts = getRegexScripts(values);
  const regexMacros = useMemo(() => ({ char: values.nickname || values.name || '角色', user: '使用者' }), [values.nickname, values.name]);

  const updateRegexScripts = useCallback((change: (scripts: RegexScript[]) => RegexScript[]) => {
    setValues((prev) => withRegexScripts(prev, change(getRegexScripts(prev))));
  }, []);

  const updateRegexScript = (id: string, patch: Partial<RegexScript>) =>
    updateRegexScripts((scripts) => scripts.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  function addRegexScript() {
    const script = newRegexScript();
    updateRegexScripts((scripts) => [...scripts, script]);
    push({ type: 'regex', id: script.id });
  }

  function deleteRegexScript(id: string) {
    const script = regexScripts.find((s) => s.id === id);
    if (!script || !confirm(`確定要刪除「${script.scriptName || '未命名腳本'}」嗎？刪除後可以按「復原」救回來。`)) return;
    back();
    updateRegexScripts((scripts) => scripts.filter((s) => s.id !== id));
    notify('腳本已刪除');
  }

  function duplicateRegexScript(id: string) {
    const index = regexScripts.findIndex((s) => s.id === id);
    if (index < 0) return;
    const original = regexScripts[index];
    const copy = { ...structuredClone(original), id: newRegexScript().id, scriptName: original.scriptName ? `${original.scriptName}（副本）` : '' };
    updateRegexScripts((scripts) => {
      const next = [...scripts];
      next.splice(index + 1, 0, copy);
      return next;
    });
    notify('已複製腳本，副本在原腳本的下一個');
  }

  function moveRegexScript(id: string, delta: number) {
    updateRegexScripts((scripts) => {
      const index = scripts.findIndex((s) => s.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= scripts.length) return scripts;
      const next = [...scripts];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function importRegexScripts(file: File) {
    try {
      const imported = parseRegexScriptsJson(JSON.parse(await file.text()));
      updateRegexScripts((scripts) => {
        const ids = new Set(scripts.map((s) => s.id));
        // 和 SillyTavern 一樣：id 重複時換一個新的，避免蓋掉現有腳本
        return [...scripts, ...imported.map((s) => (ids.has(s.id) ? { ...s, id: newRegexScript().id } : s))];
      });
      notify(`已匯入 ${imported.length} 個腳本`);
    } catch (error) {
      notify(error instanceof SyntaxError ? '檔案不是有效的 JSON。' : errorText(error), 'error');
    }
  }

  function exportRegexScript(id: string) {
    const script = regexScripts.find((s) => s.id === id);
    if (!script) return;
    downloadJson(script, `regex-${safeFileName(script.scriptName, 'script')}.json`);
  }

  function exportAllRegexScripts() {
    downloadJson(regexScripts, `regex-${safeFileName(values.name, 'character')}.json`);
  }

  // ---------- 搜尋／取代 ----------

  function runReplace(target?: { loc: SearchLocation; index: number }) {
    const pattern = buildPattern(search.query, search);
    if (!(pattern instanceof RegExp)) return;
    const result = applyReplace(values, lorebook, pattern, search.replacement, search, search, target);
    if (!result.count) return;
    setValues(result.card);
    setLorebook(result.book);
    notify(target ? '已取代 1 處' : `已取代 ${result.count} 處，可以按「復原」還原`);
  }

  function openSearchResult(loc: SearchLocation, start: number, end: number) {
    const select: [number, number] = [start, end];
    switch (loc.kind) {
      case 'card':
        if (loc.field in LONG_FIELDS) push({ type: 'text', target: { kind: 'card', field: loc.field as LongFieldKey }, select });
        break;
      case 'cardList':
        push({ type: 'text', target: { kind: 'listItem', list: loc.list, index: loc.index }, select });
        break;
      case 'depthPrompt':
        push({ type: 'text', target: { kind: 'depthPrompt' }, select });
        break;
      case 'bookDescription':
        push({ type: 'text', target: { kind: 'bookDescription' }, select });
        break;
      case 'entry':
        if (loc.field === 'content') push({ type: 'text', target: { kind: 'entryContent', uid: loc.uid }, select });
        else push({ type: 'entry', uid: loc.uid });
        break;
      case 'entryKey':
        push({ type: 'entry', uid: loc.uid });
        break;
    }
  }

  function renderView(view: View) {
    switch (view.type) {
      case 'text':
        return renderTextEditor(view.target, view.select);
      case 'list': {
        const info = LIST_FIELDS[view.list];
        return (
          <GreetingList
            title={info.label}
            en={info.en}
            itemName={info.itemName}
            items={values[view.list]}
            onBack={back}
            onChange={(items) => updateField(view.list, items)}
            onOpenItem={(index) => push({ type: 'text', target: { kind: 'listItem', list: view.list, index } })}
          />
        );
      }
      case 'entry': {
        const index = lorebook.entries.findIndex((e) => e.uid === view.uid);
        if (index < 0) return <MissingView onBack={back} />;
        return (
          <LorebookEntryEditor
            entry={lorebook.entries[index]}
            index={index}
            total={lorebook.entries.length}
            onChange={(patch) => updateEntry(view.uid, patch)}
            onBack={back}
            onOpenContent={() => push({ type: 'text', target: { kind: 'entryContent', uid: view.uid } })}
            onDelete={() => deleteEntry(view.uid)}
            onDuplicate={() => duplicateEntry(view.uid)}
            onMove={(delta) => moveEntry(view.uid, delta)}
          />
        );
      }
      case 'regexList':
        return (
          <RegexScriptList
            scripts={regexScripts}
            onBack={back}
            onOpen={(id) => push({ type: 'regex', id })}
            onAdd={addRegexScript}
            onToggle={(id, enabled) => updateRegexScript(id, { disabled: !enabled })}
            onImport={importRegexScripts}
            onExportAll={exportAllRegexScripts}
          />
        );
      case 'regex': {
        const index = regexScripts.findIndex((s) => s.id === view.id);
        if (index < 0) return <MissingView onBack={back} />;
        return (
          <RegexScriptEditor
            script={regexScripts[index]}
            index={index}
            total={regexScripts.length}
            macros={regexMacros}
            testInput={regexTestInput}
            onTestInputChange={setRegexTestInput}
            onChange={(patch) => updateRegexScript(view.id, patch)}
            onOpenReplace={() => push({ type: 'text', target: { kind: 'regexReplace', id: view.id } })}
            onBack={back}
            onDelete={() => deleteRegexScript(view.id)}
            onDuplicate={() => duplicateRegexScript(view.id)}
            onExport={() => exportRegexScript(view.id)}
            onMove={(delta) => moveRegexScript(view.id, delta)}
          />
        );
      }
      case 'search':
        return (
          <SearchPanel
            card={values}
            book={lorebook}
            state={search}
            onStateChange={(patch) => setSearch((prev) => ({ ...prev, ...patch }))}
            onReplace={runReplace}
            onOpen={openSearchResult}
            onBack={back}
          />
        );
      case 'files':
        return (
          <FilePanel
            onBack={back}
            onImportCard={importCard}
            onImportLorebook={importLorebook}
            onExportCardJson={exportCardJson}
            onExportCardPng={exportCardPng}
            onExportWorld={exportWorld}
            onExportLorebookV3={exportLorebookV3}
            onNewCharacter={newCharacter}
            savedAt={savedAt}
            saveError={saveError}
          />
        );
    }
  }

  return (
    <UndoRedoContext.Provider value={undoRedo}>
      <div className="app">
        <div className="home" aria-hidden={current ? true : undefined} inert={current ? true : undefined}>
          <header className="app-header">
            <div className="app-header-row">
              <h1 className="app-title">Silly Studio</h1>
              <div className="header-actions">
                <UndoRedoButtons />
                <button type="button" className="btn btn-soft" onClick={() => push({ type: 'files' })}>
                  匯入／匯出
                </button>
              </div>
            </div>
            <div className="tabs-row">
              <nav className="tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'card'} onClick={() => setTab('card')}>
                  角色卡
                </button>
                <button type="button" role="tab" aria-selected={tab === 'lorebook'} onClick={() => setTab('lorebook')}>
                  Lorebook
                  {lorebook.entries.length > 0 && <span className="badge">{lorebook.entries.length}</span>}
                </button>
              </nav>
              <button
                type="button"
                className="icon-round search-btn"
                aria-label="搜尋／取代"
                title="搜尋／取代"
                onClick={() => push({ type: 'search' })}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <main>
            {tab === 'card' ? (
              <CharacterEditor
                values={values}
                updateField={updateField}
                addTag={addTag}
                removeTag={removeTag}
                avatarUrl={avatar}
                onPickAvatar={pickAvatar}
                onRemoveAvatar={() => setAvatar(null)}
                onOpenLongField={(field) => push({ type: 'text', target: { kind: 'card', field } })}
                onOpenList={(list) => push({ type: 'list', list })}
                onOpenDepthPrompt={() => push({ type: 'text', target: { kind: 'depthPrompt' } })}
                regexScriptNames={regexScripts.map((s) => s.scriptName || '未命名腳本')}
                onOpenRegexScripts={() => push({ type: 'regexList' })}
                lorebookCount={lorebook.entries.length}
                embedLorebook={embedLorebook}
                onEmbedLorebookChange={setEmbedLorebook}
              />
            ) : (
              <LorebookList
                book={lorebook}
                onBookChange={updateBook}
                onEntryChange={updateEntry}
                onAddEntry={addEntry}
                onOpenEntry={(uid) => push({ type: 'entry', uid })}
                onOpenDescription={() => push({ type: 'text', target: { kind: 'bookDescription' } })}
                embedLorebook={embedLorebook}
                onEmbedLorebookChange={setEmbedLorebook}
              />
            )}
          </main>
          <footer className="save-status">
            {saveError ? '⚠️ 草稿儲存失敗，請匯出備份' : savedAt ? `草稿已自動儲存 ${new Date(savedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : ''}
            {backupReminder && (
              <button type="button" className="backup-reminder" onClick={() => push({ type: 'files' })}>
                {backupReminder}
              </button>
            )}
          </footer>
        </div>

        {current && <div className="overlay">{renderView(current)}</div>}

        {needRefresh && (
          <div className="update-banner" role="status">
            <span>有新版本可以更新</span>
            <button type="button" className="btn btn-primary small" onClick={() => updateServiceWorker(true)}>
              更新
            </button>
          </div>
        )}

        {toast && (
          <div className={`toast ${toast.tone}`} role="status">
            {toast.text}
          </div>
        )}
      </div>
    </UndoRedoContext.Provider>
  );
}

// 復原之後，目前開著的條目或開場白可能已經不存在
function MissingView({ onBack }: { onBack: () => void }) {
  return (
    <div className="subpage">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ 返回
        </button>
        <span />
        <UndoRedoButtons />
      </header>
      <div className="page">
        <p className="empty-state">這個項目已經不存在了（可能是剛剛復原了新增）。按「重做」可以把它找回來。</p>
      </div>
    </div>
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '發生未知錯誤。';
}
