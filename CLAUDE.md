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
- `showEditPage`: Controls page transition animation (boolean)
- `currentPage`: 'create' or 'detail' mode for edit page
- `notes` / `taggedNotes`: Cached note lists per tab
- `isBatchMode` / `selectedIds`: Multi-selection state for batch delete
- `swipedNoteId`: Currently swiped note for delete action

### Component Structure

Components are organized by feature in `src/components/`:
- `NoteCard` - Individual note display with swipe-to-delete and checkbox selection
- `NoteEditPage` - Create/edit note with auto-save
- `NoteListPage` / `TagsPage` - List views with pull-to-bounce, multi-select, and swipe actions
- `TabBar` - Bottom navigation between categories
- `TagSelector` / `TagChipNav` - Color tag UI (red, orange, yellow, gray)
- `BatchActionBar` - Multi-select actions (appears at top)
- `Toast` - Non-blocking notification system
- `Modal` - Confirmation dialogs with cancel/confirm actions
- `FAB` - Floating action button for creating new notes
- `EmptyState` - Placeholder when no notes exist

### Type Definitions (`src/types/`)

```typescript
Category = 'impromptu' | 'study' | 'todo'
TagColor = 'red' | 'orange' | 'yellow' | 'gray'
Note = { id, title, content, category, tagColor, createdAt, updatedAt, isDeleted }
```

### Page Transition Animations

**Dual-page architecture** in `App.tsx`:
- Both list page and edit page are always rendered in DOM
- `showEditPage` state controls visibility via CSS classes
- `app-page-list` and `app-page-edit` use `position: fixed` with CSS transitions

**Animation specs** (in `src/App.css`):
- Slide in from right: 350ms, cubic-bezier(0.25, 0.46, 0.45, 0.94)
- List page fades to 85% opacity and scales to 98% when edit page is visible
- Edit page slides from translateX(100%) to translateX(0)

### List Page Interactions

**Swipe to delete** (`NoteCard` component):
- Left swipe > 60px reveals delete and cancel buttons
- Fast swipe (velocity > 0.5px/ms) triggers immediately
- Maximum swipe distance: 144px (2 action buttons)
- Smooth spring animation on release
- Only one card can be swiped at a time

**Multi-select mode**:
- Tap header "select" button (list icon) to enter batch mode
- Batch action bar appears at top with cancel/count/select-all/delete
- Checkboxes appear on each note card
- Exit by tapping cancel or after delete operation

**Pull to bounce** (elastic scroll effect):
- Only activates when scrollTop === 0
- Damping factor: 0.5 (pull 100px = 50px movement)
- Max pull distance: 100px
- Spring back animation: 300ms ease-out
- Visual indicator text "松开回弹" appears during pull

### PWA Configuration

Configured in `vite.config.ts`:
- `base: './'` - Relative paths for portable deployment
- Service worker with auto-update enabled
- Workbox caching for offline functionality
- Manifest referenced externally (in `public/manifest.json`)

## Key Development Notes

- **Soft deletes**: Notes use `isDeleted` flag; no hard delete implemented
- **Auto-save**: Edit page saves automatically on input (debounced 3000ms)
- **Touch targets**: Minimum 48x48px for all interactive elements
- **Screen width**: Designed for 360px-412px mobile screens
- **Multi-select**: Header button triggers batch mode (replaced long-press)
- **Toast duration**: 2 seconds default display time
- **Animations**: All transitions use cubic-bezier(0.25, 0.46, 0.45, 0.94) for natural feel
- **Scroll handling**: Lists use `-webkit-overflow-scrolling: touch` for iOS momentum scrolling
- **State reset**: `NoteEditPage` resets form state when `note?.id` or `isCreating` changes
- **Swipe conflict prevention**: Multi-select mode disables swipe gestures via early return in touch handlers

## Animation Timing Reference

| Animation | Duration | Easing | Description |
|-----------|----------|--------|-------------|
| Page slide | 350ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) | Edit page in/out |
| Swipe actions | 250ms | ease-out | Delete buttons reveal |
| Pull bounce | 300ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) | Elastic return |
| Toast | 200ms in, 2000ms stay, 200ms out | ease | Notification lifecycle |
| Modal | 200ms | ease | Overlay fade and scale |
| Button press | 150ms | - | Background color change |

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
