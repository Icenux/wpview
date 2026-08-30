# wpview — kontrakt (V0)

Rozhraní mezi **wpview** (prohlížeč fotek, značka Icenux) a consumerem (gallery).
Zdroj pravdy je `src/contract/types.ts`. Tento soubor je jeho lidsky čitelné
zrcadlo — **měň oba spolu**, jinak se rozejdou.

Princip: **wpview emituje záměr, consumer vlastní politiku.** wpview nikdy
neaplikuje oprávnění, nepotvrzuje destruktivní akce a nevolá žádné API.

## Vstup (props)

```ts
interface WpViewProps {
  items: ViewerItem[];                    // OKNO položek, ne nutně celá galerie (viz windowing)
  index: number;                          // controlled pozice; wpview ji nemění sám, jen navrhuje
  itemState: Record<string, ItemState>;   // aktuální pravda (rating/tags/favorite) z consumeru
  capabilities?: Capabilities;            // co se zobrazí; nevyplněné = false
  hasMore?: { prev: boolean; next: boolean };  // pro windowing

  // Settings — dvě nezávislé osy, obě controlled/uncontrolled (viz sémantika):
  settings?: Partial<Settings>;           // controlled hodnoty, když je s onSettingsChange
  onSettingsChange?(next: Settings): void;
  settingsOpen?: boolean;                 // controlled viditelnost panelu
  onSettingsOpenChange?(open: boolean): void;

  onIndexChange(index: number): void;
  onRate?(id: string, value: number): void;
  onFavorite?(id: string, next: boolean): void;
  onTagToggle?(id: string, tagId: string): void;
  onEdit?(id: string, patch: EditPatch): void;
  onDelete?(id: string): void;
  onInfoOpen?(id: string): void;         // jednorázový klik, žádný toggle — viz sémantika
  onContextMenu?(id: string, x: number, y: number): void;  // pravý klik / long-press — žádné vlastní menu
  onRequestMore?(dir: 'prev' | 'next'): void;
  onClose?(): void;                       // křížek, swipe dolů, Escape — všechny tři volají tohle
}
```

## Typy

```ts
interface ViewerItem {
  id: string;
  thumbSrc: string;
  fullSrc: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;   // EXIF / datum / místo — wpview to sám nezobrazuje (viz onInfoOpen)
}

interface ItemState {
  rating?: number;    // 0–5
  tags?: string[];    // tagId[]
  favorite?: boolean;
}

interface Capabilities {
  rate?: boolean; favorite?: boolean; tag?: boolean;
  rotate?: boolean; crop?: boolean; delete?: boolean;
  info?: boolean; present?: boolean;
}

type EditPatch =
  | { type: 'rotate'; deg: 90 | 180 | 270; blob: Blob }
  | { type: 'crop';   rect: { x: number; y: number; w: number; h: number }; blob: Blob };

interface Settings {
  slideshowMs: number;                // default 4000
  zoomMode: 'fit' | 'actual';         // default 'fit'
  doubleTapZoom: number;              // default 2
  theme: 'dark' | 'light' | 'system'; // default 'system'
}
```

## Sémantika

**Controlled index.** wpview pozici nikdy nemění sám. Při swipe/šipce zavolá
`onIndexChange(next)` a čeká na nový `index` prop. (Opticky může překreslit hned —
viz optimistic.)

**Optimistic + reconciliation.** Interakce (rate / favorite / tag) se překreslí
okamžitě z lokálního overlaye **klíčovaného per `id`**, event odletí. Jakmile
dorazí `itemState[id]` odpovídající změně, overlay pro to `id` se zahodí.
Overlay se **nikdy nepřenáší mezi `id`** a při změně indexu se pro odcházející
foto čistí. (Toto pravidlo existuje kvůli konkrétnímu bugu — bez něj stav „drží"
napříč fotkami.)

**Editace je klient-side.** crop i rotate probíhají v canvasu uvnitř wpview;
výsledek je hotový `Blob` v `onEdit(id, patch)`. wpview ukazuje editovaný blob
opticky, dokud consumer nedodá nový `fullSrc` pro to `id`. Rotace přes canvas
re-encode je **ztrátová** — dokumentovaný kompromis, ne bug.

**Windowing.** `items` je okno kolem `index`, ne celá galerie. Na kraji okna
wpview volá `onRequestMore(dir)`; `hasMore` říká, jestli má smysl žádat dál.

**Settings — dvě nezávislé osy.** Každá je zvlášť controlled nebo uncontrolled
podle toho, jestli dodáš dvojici prop + handler:

- *Kam se ukládá.* Dodáš `settings` **i** `onSettingsChange` → controlled:
  wpview se `localStorage` vůbec nedotkne, pravdu držíš ty a persistuješ kam
  chceš (vlastní store, backend, sdílené settings consumeru). Nedodáš →
  uncontrolled: wpview ukládá do `localStorage` pod prefix `wpview:`.
- *Odkud se panel otevírá.* Dodáš `settingsOpen` **i** `onSettingsOpenChange`
  → controlled: panel otevíráš vlastním tlačítkem kdekoli ve svém UI. Nedodáš →
  uncontrolled: panel řídí gear uvnitř wpview.

Osy jsou nezávislé — můžeš převzít jen persistenci, jen otevírání, obojí, nebo
nic. Bez čehokoli funguje wpview out-of-the-box.

**Capability gate.** Akce bez odpovídající capability se **nezobrazí ani
neemituje**. Chybějící handler má stejný efekt — akce je skrytá.

**Info a context menu jsou čistě emit-only.** Na rozdíl od rating/tag/rotate
(ty JSOU interaktivní ovládání a musí žít uvnitř wpview) si Info a context menu
téměř každý consumer už má svoje vlastní — bohatší detail panel, bohatší menu s
akcemi mimo dosah wpview (album, download, přesun...). wpview proto pro ně
**nekreslí žádnou vlastní UI**: `onInfoOpen(id)` se zavolá při každém kliku na
Info (žádný toggle, žádný lokální stav — consumer si otevírání/zavírání svého
panelu řídí sám). `onContextMenu(id, x, y)` se zavolá při pravém kliku na fotku
s pozicí kliku; consumer na `(x, y)` vykreslí svoje vlastní menu (klidně to
samé, které používá jinde v appce pro tu stejnou fotku). Bez handleru se u
Info nic neděje (tlačítko samo o sobě zmizí přes capability gate) a u
context menu **neprojde `preventDefault()`** — prohlížeč ukáže svoje nativní
menu, protože wpview capability nemá čím to schovat.

**Zavírání.** Tři nezávislé cesty na `onClose()`: křížek vpravo nahoře
(zobrazí se jen když je `onClose` dodaný), swipe/tažení dolů přes fotkou, a
Escape. Všechny tři jsou navzájem nezávislé a rovnocenné.

**Chrome toggle.** Ťuknutí/klik na fotku (bez tažení) schová/vrátí křížek a
toolbar — stejný vzorec jako mobilní galerie. Netýká se to klávesových
zkratek ani swipe-to-close, ty fungují bez ohledu na viditelnost chrome.
