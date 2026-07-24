# Sila .vision — Media Intelligence Dashboard

A minimalist, Linear/Vercel-inspired single-page React dashboard for **Sila**, a local-first AI media intelligence tool.

![Sila Dashboard](https://img.shields.io/badge/status-preview-blue) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Vite](https://img.shields.io/badge/Vite-7-646CFF) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8)

## Features

- **Strictly light mode** with breathable off-white (`#FAFAFA`) design
- **Glassmorphism header** with live connection status
- **Floating omnibar** with `⌘K` / `/` keyboard shortcuts
- **Masonry grid** with Framer Motion spring animations
- **Cinematic hover overlays** showing filename, blur score, and metadata
- **JUNK badge** system for flagged media
- **Graceful fallback** to mock data when FastAPI backend is offline
- **Skeleton loaders** and empty states

## Tech Stack

- React 18 + TypeScript
- Vite 7
- Tailwind CSS 4
- Framer Motion
- Lucide React

## Quick Start

### 1. Generate the zip

**macOS / Linux:**
```bash
chmod +x scripts/zip-it.sh
./scripts/zip-it.sh
```

**Windows PowerShell:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/zip-it.ps1
```

This creates `sila-dashboard.zip` in the project root.

### 2. Deploy to your UI folder

```bash
# Copy the zip to your destination
cp sila-dashboard.zip /path/to/your/ui/folder/
cd /path/to/your/ui/folder/

# Unzip
unzip sila-dashboard.zip

# Install dependencies
npm install

# Start dev server
npm run dev
```

The dashboard will open at `http://localhost:5173`.

### 3. Connect to your FastAPI backend

The dashboard automatically attempts to connect to `http://localhost:8000`. If the backend is running, you'll see a green status indicator. If not, it gracefully falls back to curated mock data for demonstration.

**Backend endpoints used:**
- `GET /api/media?limit=50` — fetch all media
- `GET /api/search?q={query}` — search media
- `GET /api/proxy/{sila_id}` — serve image thumbnails

## Project Structure

```
src/
├── App.tsx                    # Main dashboard composition
├── main.tsx                   # React entry point
├── index.css                  # Tailwind + custom styles
├── types.ts                   # TypeScript interfaces
├── lib/
│   └── api.ts                 # API layer with mock fallback
└── components/
    ├── Header.tsx             # Sticky glassmorphism nav
    ├── Omnibar.tsx            # Floating search bar
    ├── MediaGrid.tsx          # Masonry grid wrapper
    ├── MediaCard.tsx          # Individual media card
    ├── SkeletonGrid.tsx       # Loading skeletons
    └── EmptyState.tsx         # Empty state UI
```

## Design System

- **Background:** `#FAFAFA` with subtle grid pattern
- **Cards:** White, 1px `border-zinc-200`, soft shadows
- **Typography:** Inter (headings), JetBrains Mono (metadata)
- **Animations:** Physics-based springs via Framer Motion
- **Spacing:** 1400px max-width, 24px gutters

## Customization

### Change API endpoint

Edit `src/lib/api.ts`:
```typescript
const API_BASE = "http://localhost:8000"; // Change this
```

### Adjust grid density

Edit `src/components/MediaGrid.tsx`:
```typescript
className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4"
// Change xl:columns-4 to xl:columns-5 for denser grid
```

### Modify color palette

The entire design uses Tailwind's `zinc` scale. To rebrand:
- Replace `zinc-900` → your primary color
- Replace `zinc-500` → your secondary color
- Replace `zinc-200` → your border color

## Keyboard Shortcuts

- `⌘K` or `Ctrl+K` — Focus search
- `/` — Focus search (when not typing)
- `Enter` — Execute search
- `Esc` — Clear search

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

## License

MIT

## Credits

Built for **Sila .vision** — a local-first AI media intelligence tool.

Design inspired by Linear, Vercel, and Apple's Human Interface Guidelines.
