# @icenux/wpview

Touch-first prohlížeč/editor fotek. Samostatný frontend plugin — žádné API,
žádný fetch, žádná oprávnění. wpview emituje záměr (`onRate`, `onEdit`,
`onDelete`, …), consumer vlastní politiku. Viz [`CONTRACT.md`](./CONTRACT.md).

![wpview playground — otevřená fotka s rating hvězdičkami, favorite, tagy a toolbarem (rotate/crop/slideshow/info/delete/settings)](./docs/screenshot-viewer.png)

Screenshot z `playground/` — capability-gated toolbar, optimistic rating,
odebíratelné tag chipy, favorite.

## Vývoj

```bash
npm install
npm run dev        # playground proti mock datům, žádný backend
npm test           # Vitest + Testing Library
npm run typecheck
npm run lint
npm run build       # Vite library mode -> dist/ (ESM + .d.ts)
```
