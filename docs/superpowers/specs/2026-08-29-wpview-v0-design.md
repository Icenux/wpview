# wpview V0 — implementation design

Datum: 2026-08-29. Stav: implementováno v této session, viz commit.

## Kontext

`wpview` (`@icenux/wpview`) je nový, samostatný frontend plugin — touch-first
prohlížeč/editor fotek pro značku Icenux. `CLAUDE.md` a `CONTRACT.md` v rootu
existovaly už před touto session a fungují jako source-of-truth kontrakt
(`WpViewProps`, `ViewerItem`, `ItemState`, `Capabilities`, `EditPatch`,
`Settings`). Tento dokument zaznamenává implementační rozhodnutí, která
kontrakt nechává otevřená — tvar reduceru, gesta, editační pipeline, testovací
strategii a tooling.

Konzument (`gallery`, `/home/lukas/DEV/gallery`) má už napsaný
`viewer-removal.md` (FÁZE 1 — inventura starého lightboxu, kód zatím
nezměněný), který dokumentuje budoucí šev pro wpview. wpview samo o sobě
konzumenta nezná a nekomunikuje s žádným API — mock data v `playground/` jsou
jen inspirovaná reálným tvarem gallery `Photo` (číselné id, `thumbnail_sm/md/lg`
+ `/download`), pro věrohodnost při ručním testování.

## Rozsah V0

Celý V0 z `CONTRACT.md` najednou — rating, favorite, tag (remove-only, žádný
picker vokabuláře), rotate/crop (klient-side canvas), slideshow, windowing,
dual-axis settings. Bez zúžení na první iteraci.

## Repo a tooling

- `git init`, `origin` → `ssh://git@100.121.109.115:2222/Icenux/wpview.git`
  (Forgejo, stejný vzor jako `gallery`/`admin`/`Hub`).
- Vite library mode (ESM) + `tsc --emitDeclarationOnly` pro `.d.ts`.
  **Pozor:** `vite build` musí mít `build.emptyOutDir: false` — jinak smaže
  `.d.ts`, které `tsc` napsal v předchozím kroku skriptu `build`.
- Vitest + `@testing-library/react` + jsdom, ESLint (flat config,
  typescript-eslint + react-hooks) + Prettier.
- `playground/` je samostatná Vite dev app, importuje `@wpview` alias přímo ze
  `src/`, žádný build krok navíc. Mock data (`playground/mock-items.ts`) kreslí
  placeholdery přes `<canvas>.toDataURL('image/jpeg')` — **ne SVG data URI**:
  `createImageBitmap` neumí SVG dekódovat (`InvalidStateError`), což by
  shodilo rotate/crop demo na startu.

## State: reducer se dvěma sliky

`src/state/reducer.ts` — `overlay` (optimistic rating/tag/favorite) a `edit`
(optický crop/rotate výsledek), nezávislé sliky.

- `overlay/reconcile` musí vrátit **stejnou referenci `state`**, pokud se nic
  nezměnilo (žádné pole nově nematchuje). Když vrátí nový objekt i beze změny
  obsahu, `useOptimistic`'s efekt (deps `[itemState, state.overlay]`) se
  spustí znovu na vlastní dispatch → nekonečná smyčka. Tohle byl reálný bug
  objevený při prvním testovacím běhu — Node worker OOMoval po ~62 minutách,
  než reducer opravil, aby no-op vracel identickou referenci.
- `edit[id]` drží `capturedFullSrc` (fullSrc položky v okamžiku editace).
  Zahazuje se, jakmile `items[i].fullSrc` pro dané id přestane odpovídat —
  přesně podle CONTRACT.md sémantiky „dokud consumer nedodá nový fullSrc".

## Actions/registry

`isActionEnabled(id, capabilities, handlers)` je jediný choke-point:
`capabilities?.[id] !== true` NEBO chybějící handler → false. `ActionId` a
klíče `Capabilities` jsou schválně identické (1:1 mapování). `present` nemá
handler — je to čistě interní UI gate (Slideshow tlačítko).

`ui/` komponenty nikdy nevolají `props.onX` přímo; dostávají už prošlé
callbacky z `WpView.tsx`, které interně volají `emitRate`/`emitFavorite`/…

## Gesta — bez knihovny

`useSwipe`/`usePinchZoom`/`useKeyboard` — čistě Pointer Events přes
`addEventListener` na sdíleném ref (dep-light, jediná peerDep je React).
`useSwipe` se vzdá gesta, jakmile přibude druhý prst (pinch converá).

## Editace — OffscreenCanvas + createImageBitmap

`edit/encode.ts` (`loadBitmap`, `canvasToBlob`, `inferMimeType` — JPEG→JPEG,
jinak PNG fallback), `edit/rotate.ts` (`rotateImage`, re-encode je ztrátový,
dokumentovaný kompromis), `edit/CropCanvas.tsx` (drag-to-draw jeden obdélník
od nuly — bez resize handles, v0 scope).

Ověřeno v reálném prohlížeči (Chromium): rotate proběhl celou pipeline
(fetch → createImageBitmap → OffscreenCanvas → convertToBlob → blob URL →
optický reconciliation) a `onEdit` se emitoval správně.

## Settings — dvě nezávislé osy

`useSettings` — persistence (`settings`+`onSettingsChange`) a otevírání panelu
(`settingsOpen`+`onSettingsOpenChange`) jsou oddělené controlled/uncontrolled
páry. Uncontrolled persistence padá do `localStorage` pod prefixem `wpview:`.

## Testy

65 testů, Vitest + RTL, včetně simulace gest přes `PointerEvent`.

- **jsdom nemá nativní `PointerEvent`** ani `setPointerCapture` — polyfill v
  `tests/setup.ts`.
- Raw `element.dispatchEvent(...)` (na rozdíl od RTL `fireEvent`) se
  nezabalí do `act()` automaticky → testy na `usePinchZoom`/`useSwipe` musely
  dostat vlastní `act()` wrapper, jinak assert běžel dřív, než React stihl
  zaflushovat state.
- `edit/rotate.test.ts` a `edit/CropCanvas.test.tsx` mockují
  `fetch`/`createImageBitmap`/`OffscreenCanvas` (jsdom je nemá).

## Známé zjednodušení (vědomě, ne bug)

- `TagChips` umí jen odebrat existující tag, ne přidat nový — `CONTRACT.md`
  nedává wpview žádný prop s vokabulářem tagů, takže picker není v jeho
  dosahu; přidávání tagů je věc consumera.
- `CropCanvas` nemá resize handles nad existujícím výběrem, jen kreslení
  nového obdélníku od nuly.
- Rotace/crop re-encode je ztrátová (canvas), dokumentovaný kompromis podle
  `CLAUDE.md`.
