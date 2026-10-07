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
  availableTags?: { id: string; label?: string }[];  // nabídka pro tlačítko Tags

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
  onShare?(id: string): void;            // jednorázový klik na Share — emit-only, viz sémantika
  onContextMenu?(id: string, x: number, y: number): void;  // pravý klik / long-press — žádné vlastní menu
  onRequestMore?(dir: 'prev' | 'next'): void;
  onClose?(): void;                       // křížek, swipe dolů, Escape — všechny tři volají tohle
}
```

## Typy

```ts
interface ViewerItem {
  id: string;
  type?: 'image' | 'video';         // default 'image'
  filename?: string;                // vč. přípony, zobrazuje se nahoře
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
  info?: boolean; share?: boolean; present?: boolean;
}

type EditPatch =
  | { type: 'rotate'; deg: 90 | 180 | 270; blob: Blob }
  | { type: 'crop';   rect: { x: number; y: number; w: number; h: number }; blob: Blob };

interface Settings {
  slideshowMs: number;                          // default 4000
  slideshowTransition: 'none' | 'fade' | 'slide' | 'zoom' | 'flip' | 'blur'; // default 'fade'
  slideshowLoop: boolean;                       // default false
  slideshowShuffle: boolean;                    // default false
  slideshowContent: 'all' | 'photos' | 'videos'; // default 'all'
  autoplaySlideshow: boolean;                   // default false
  autoplayVideo: boolean;                       // default false
  doubleTapZoom: number;                        // default 2
  theme: 'dark' | 'light' | 'system';           // default 'system'
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

**Rotate má dvě tlačítka (doleva/doprava), jednu capability.** `deg: 90` =
doprava (po směru hodinových ručiček), `deg: 270` = doleva (matematicky -90°,
ale `EditPatch.deg` drží jen kladné násobky 90). Obě tlačítka gatuje stejná
`capabilities.rotate` — je to jedna schopnost „tuhle fotku smí otočit", ne dvě.

**Windowing.** `items` je okno kolem `index`, ne celá galerie. Na kraji okna
wpview volá `onRequestMore(dir)`; `hasMore` říká, jestli má smysl žádat dál.

**Zoom/pan.** Fotka je vždy zobrazená, ať se celá vejde na obrazovku
(`object-fit: contain`) — žádný přepínač „actual size"/1:1 pixelů
neexistuje (byl a zase byl odstraněný, viz historie tohoto souboru — nešlo
ovládat žádným běžným gestem, jen z menu, a bez panování byl nepoužitelný).
Přiblížit jde jen pinch nebo double-tap/-click (`doubleTapZoom`). Kdykoli je fotka
takhle zvětšená (`scale > 1`), tažení jedním prstem přestává
navigovat/zavírat a místo toho **panuje** — vidět zbytek zvětšené fotky je
jinak nemožné. Swipe next/prev/close se vrátí, jakmile se `scale` vrátí na
1 (klávesové šipky navigují bez ohledu na zoom/pan, ty žádný pointer gesto
nepoužívají).

**Slideshow přechod.** `slideshowTransition` řídí, jak vypadá automatické
přehození při prezentaci (`present`/`onTogglePresent`), ne manuální
swipe/šipky — ty jsou vždycky okamžité. `'slide'` spustí přesně tu samou
dojíždějící animaci jako dokončený swipe (viz useSwipe.ts `triggerAdvance`);
`'fade'` je nezávislý cross-fade (dvě překrývající se vrstvy, žádný
vodorovný posun); `'none'` přehodí index okamžitě, bez animace. Ve všech
třech případech u `'fade'`/`'slide'` platí totéž pravidlo jako u
dokončeného swipe: `onIndexChange` se zavolá až PO animaci, ne v okamžiku,
kdy uplyne `slideshowMs`.

**Další přechody.** Kromě `'fade'`/`'slide'`/`'none'` jsou `'zoom'`, `'flip'`
(3D otočení) a `'blur'` (rozostření) — všechny overlay přechody, `onIndexChange`
jde až po nich. Nesousední cíl (shuffle, loop, přeskočené položky) se u `'slide'`
animuje jako `'fade'`.

**Slideshow pořadí.** `slideshowShuffle`, `slideshowLoop` a `slideshowContent`
(vyloučení videí/fotek) pracují jen nad oknem `items` (viz windowing) — shuffle
i loop se drží v okně. Na konci okna s `hasMore.next` slideshow čeká na další
okno. Video se ve slideshow nečasuje, přejde se po jeho konci.

**Video.** `ViewerItem.type: 'video'` — `fullSrc` je URL videa, `thumbSrc`
poster. `autoplayVideo` ho po otevření spustí (ve slideshow vždy, muted).
Akce `rotate` a `crop` se u videa nezobrazují (editace je jen pro fotky).
`autoplaySlideshow` spustí slideshow po otevření (vyžaduje capability `present`).

**Tagy z lišty.** `availableTags?: { id, label? }[]` je nabídka pro tlačítko
Tags; přiřazení i odebrání je `onTagToggle(id, tagId)` (za capability `tag`).

**Photobar.** Tlačítko v liště zobrazí pás miniatur pod fotkou (aktuální
uprostřed); klik na miniaturu = `onIndexChange`. **Název souboru** (vč.
přípony: `ViewerItem.filename` → `meta.filename` → konec URL) se ukazuje nahoře
spolu s ostatním chrome.

**Settings — dvě nezávislé osy.** Každá je zvlášť controlled nebo uncontrolled
podle toho, jestli dodáš dvojici prop + handler:

- *Kam se ukládá.* Dodáš `settings` **i** `onSettingsChange` → controlled:
  wpview se `localStorage` vůbec nedotkne, pravdu držíš ty a persistuješ kam
  chceš (vlastní store, backend, sdílené settings consumeru). Nedodáš →
  uncontrolled: wpview ukládá do `localStorage` pod prefix `wpview:`.
- *Odkud se panel otevírá.* Dodáš `settingsOpen` **i** `onSettingsOpenChange`
  → controlled: panel otevíráš vlastním tlačítkem kdekoli ve svém UI. wpview
  samo **žádné tlačítko nastavení nemá** — bez této dvojice se panel nedá otevřít.

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

**Share je čistě emit-only.** `onShare(id)` se zavolá při každém kliku na
tlačítko Share (vedle Info) s `id` aktuální položky — foto i video. Tlačítko
se zobrazí jen s `capabilities.share === true` **a** dodaným `onShare`.
wpview nic nesdílí: vytvoření odkazu, expirace, schránka, Web Share API i
dialog jsou věc consumera.

**Zavírání.** Tři nezávislé cesty na `onClose()`: křížek vpravo nahoře
(zobrazí se jen když je `onClose` dodaný), swipe/tažení dolů přes fotkou, a
Escape. Všechny tři jsou navzájem nezávislé a rovnocenné.

**Chrome toggle.** Ťuknutí/klik na fotku (bez tažení) schová/vrátí křížek a
toolbar — stejný vzorec jako mobilní galerie. Netýká se to klávesových
zkratek ani swipe-to-close, ty fungují bez ohledu na viditelnost chrome.
