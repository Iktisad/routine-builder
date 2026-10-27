# Routine Builder

A weekly routine on one screen: seven day columns (Sunday → Saturday), free
start/end times, and a print layout that fits a single landscape page.

Live: **https://iktisad.github.io/routine-builder/**

## There is no database

Nothing is written to your browser — reloading the page gives you a blank grid.
That is deliberate. **Export** downloads the routine as JSON, and **Import**
loads one back. The page warns you before you navigate away with unsaved edits,
and `⌘Z` undoes.

## Using it

| Action | How |
| --- | --- |
| Add an activity | Drag down a day column, or press **+ Activity** |
| Edit one | Click it |
| Move / resize | Drag the block, or drag its bottom edge |
| Move across days | Drag it sideways into another column |
| Repeat on other days | Tick days under “Also add on” / “Copy to” in the editor |
| Keyboard | `Tab` to a block, then `↑`/`↓` to move, `Shift+↑`/`↓` to resize, `←`/`→` to change day, `Enter` to edit, `Delete` to remove |
| Save a copy | **Export**, or `⌘S` |
| Print / PDF | **Print**, or `⌘P` |
| Change hours, snap interval, visible days | **Hours & days** |

Times are stored as minutes from midnight, so `09:15–10:40` is exact rather than
snapped to a slot. Overlapping activities render side by side.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (time maths, overlap layout, import validation)
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve dist/ at the real /routine-builder/ base path
```

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and
publishes `dist/` to GitHub Pages.

**One-time setup:** in the repo, **Settings → Pages → Source → GitHub Actions**.
Until that is set, the deploy step fails.

`vite.config.ts` sets `base: '/routine-builder/'`. If you rename the repository,
change that too or every asset will 404.
