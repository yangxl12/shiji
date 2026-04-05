# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**拾记 (ShiJi)** - A zero-network, zero-registration, zero-server local note-taking PWA. Data is stored entirely in the browser using IndexedDB.

## Build Commands

```bash
# Start development server
npm run dev

# Build for production (runs TypeScript compiler then Vite build)
npm run build

# Preview production build locally
npm run preview

# Run ESLint
npm run lint
```

## Tech Stack

- **Framework**: React 19 + TypeScript 5.9
- **Build Tool**: Vite 8 with PWA plugin (`vite-plugin-pwa`)
- **Storage**: IndexedDB via `idb` library
- **Styling**: Pure CSS (no UI framework)
- **Linting**: ESLint 9 with TypeScript, React Hooks, and React Refresh plugins

## Project Architecture

### Data Layer (`src/db/`)

All IndexedDB operations are centralized in `src/db/index.ts`:
- `initDB()` - Initialize database connection (called once on app start)
- `createNote()` / `updateNote()` / `softDeleteNote()` - CRUD operations
- `batchSoftDeleteNote()` - Batch operations for multi-select
- `getNotesByCategory()` / `getAllTaggedNotes()` - Query functions

**Key constraint**: Notes have a maximum title length of 100 chars and content length of 50,000 chars (enforced in DB layer with automatic truncation).

### State Management

The app uses React state (no external state library). Main state is managed in `App.tsx`:
- `activeTab`: Current category tab ('impromptu' | 'study' | 'todo' | 'tags')
- `currentPage`: Navigation state ('list' | 'create' | 'detail')
- `notes` / `taggedNotes`: Cached note lists per tab
- `isBatchMode` / `selectedIds`: Multi-selection state for batch delete

### Component Structure

Components are organized by feature in `src/components/`:
- `NoteCard` - Individual note display with long-press for batch selection
- `NoteEditPage` - Create/edit note with auto-save
- `NoteListPage` / `TagsPage` - List views with pull-to-refresh feel
- `TabBar` - Bottom navigation between categories
- `TagSelector` / `TagChipNav` - Color tag UI (red, orange, yellow, gray)
- `BatchActionBar` - Multi-select actions (appears at bottom)
- `Toast` - Non-blocking notification system

### Type Definitions (`src/types/`)

```typescript
Category = 'impromptu' | 'study' | 'todo'
TagColor = 'red' | 'orange' | 'yellow' | 'gray'
Note = { id, title, content, category, tagColor, createdAt, updatedAt, isDeleted }
```

### PWA Configuration

Configured in `vite.config.ts`:
- `base: './'` - Relative paths for portable deployment
- Service worker with auto-update enabled
- Workbox caching for offline functionality
- Manifest referenced externally (in `public/manifest.json`)

## Key Development Notes

- **Soft deletes**: Notes use `isDeleted` flag; no hard delete implemented
- **Auto-save**: Edit page saves automatically on input (debounced)
- **Touch targets**: Minimum 48x48px for all interactive elements
- **Screen width**: Designed for 360px-412px mobile screens
- **Long press**: 300ms threshold to enter batch selection mode
- **Toast duration**: 2 seconds default display time

## File Organization

```
src/
├── components/     # Reusable UI components
├── pages/          # Page-level components
├── db/             # IndexedDB data access layer
├── types/          # TypeScript type definitions
├── utils/          # Constants and utility functions
├── App.tsx         # Main app with state management
└── main.tsx        # Entry point
```
