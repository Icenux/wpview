# CLAUDE.md — wpview

## Co to je
**wpview** je touch-first prohlížeč/editor fotek. Vyvíjí se pod značkou
**Icenux**; publikuje se jako `@icenux/wpview`, root komponenta `<WpView>`.
Je to **samostatný frontend plugin** — consumer (gallery) ho jen nainstaluje
a napojí přes props/eventy. Kontrakt viz `CONTRACT.md`.

## Co wpview NENÍ (tvrdá pravidla)
- **Žádné API / `fetch` / axios / react-query.** wpview nekomunikuje se
  serverem. Data dostává v props, výsledky vrací v eventech.
- **Žádná oprávnění, žádné potvrzování.** Nerozhoduje, jestli akce smí
  proběhnout, ani nezobrazuje ConfirmDialog. To dělá consumer.
- **Žádný import z gallery/backendu.** Závislost jde jen jedním směrem:
  consumer → wpview.

## Vodicí princip
**wpview emituje záměr, consumer vlastní politiku.** Tlačítko rotace nevyrotuje
na serveru — vystřelí `onEdit`. Delete nemaže — vystřelí `onDelete`. Info
nezobrazuje panel — vystřelí `onInfoOpen`. Pravý klik nekreslí menu — vystřelí
`onContextMenu(id, x, y)`. Poslední dva jsou schválně čistě emit-only (žádný
lokální stav, žádná UI) — consumer skoro vždycky má svůj vlastní, bohatší
detail panel a menu; duplicitní zjednodušená verze uvnitř wpview by se s ním
jen prala o pozornost.

## Architektura (tok jedním směrem)
```
contract/ → state,data (hooks) → view,gestures,present,edit → ui/ → WpView.tsx
```
- **Public ven teče jen `src/index.ts`** (`<WpView>` + typy). Nic jiného.
- **`ui/` komponenty nikdy neemitují event přímo.** Jdou přes `actions/registry`,
  kde se aplikuje capability-gate.
- **Stav přes `useReducer` + context. Žádný externí store** (zustand/redux).
  Plugin musí být dep-light — jediná peerDep je React.

## Klíčová pravidla
- **Optimistic reconciliation:** overlay klíčovaný per `id`; po příchodu
  odpovídajícího `itemState[id]` zahoď. Nikdy nepřenášej overlay mezi `id`;
  při změně indexu čisti odcházející. (Bez toho stav „drží" napříč fotkami —
  konkrétní bug, kvůli kterému to pravidlo je.)
- **Windowing:** nikdy nepředpokládej, že `items` obsahuje celou galerii.
  Na kraji okna volej `onRequestMore`.
- **Editace:** crop/rotate klient-side v canvasu → `Blob` v `onEdit`. Rotace
  je ztrátová (re-encode) — dokumentovaný kompromis, neřeš jako bug.
- **Settings — dvě nezávislé controlled/uncontrolled osy.** *Persistence:*
  dvojice `settings` + `onSettingsChange` → controlled, wpview se `localStorage`
  NEDOTKNE; jinak fallback na `localStorage` (prefix `wpview:`). *Otevírání
  panelu:* dvojice `settingsOpen` + `onSettingsOpenChange` → panel otevírá
  consumer; wpview samo žádný gear/tlačítko nastavení nemá. Osy jsou nezávislé. Pravidlo: dodaná dvojice prop+handler =
  převzato consumerem, wpview si to sám neřeší.
- **Kontrakt:** `src/contract/types.ts` je source of truth, `CONTRACT.md` jeho
  zrcadlo. Měň oba spolu.
- **Zavírání má tři nezávislé cesty na `onClose`:** křížek (jen když je
  `onClose` dodaný), swipe/tažení dolů, Escape. **Ťuknutí na fotku** (bez
  tažení) schová/vrátí křížek + toolbar — nemá nic společného s zavíráním.

## Co se NEAPLIKUJE
Backendová pravidla ze skillu `web-project-structure` (FastAPI, domain vrstva,
`scoped_query`, tenké routy) tu **neplatí** — wpview nemá backend ani datovou
vrstvu. Z frontendových vzorů platí jen: sdílené dumb komponenty v `ui/`,
akce přes registry, tenká root komponenta.

## Struktura
```
src/
  index.ts            public entry (<WpView> + typy)
  WpView.tsx          orchestrace, nic víc
  contract/           types.ts (source of truth), defaults.ts
  state/              reducer.ts, useOptimistic.ts, useSettings.ts
  data/               useWindow.ts
  view/               Stage.tsx, ImageLoader.tsx, usePreload.ts
  gestures/           useSwipe.ts, usePinchZoom.ts, useKeyboard.ts
  present/            Slideshow.tsx, useFullscreen.ts
  edit/               CropCanvas.tsx, rotate.ts, encode.ts
  actions/            registry.ts, types.ts
  ui/                 Toolbar, RatingStars, TagChips, SettingsPanel, IconButton (dumb)
  styles/             wpview.css (CSS proměnné pro téma)
playground/           dev harness — mock data, žádný backend
tests/
```

## Vývoj
- Vyvíjí se v `playground/` proti mock datům (`mock-items.ts`). Žádný běžící
  backend není potřeba.
- Build: Vite library mode → ESM + `.d.ts`. `react` a `react-dom` jako
  **peerDependencies** (nebundlovat).
