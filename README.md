# Flashcards Study App

A browser-based flashcards study app (single-page, no build tools). Built with
HTML, CSS, and vanilla JavaScript, with data persisted in `localStorage`.

This folder is also structured as a Python project (uv) so it can be served
locally.

## Run the web app

Option A - open directly:

- Open `index.html` in your browser.

Option B - serve with Python:

```bash
uv sync
uv run flashcards
```

Then visit http://localhost:8000/index.html

## Features

- Multiple decks with create / edit / delete.
- Cards with front/back, create / edit / delete.
- Study mode: flip, previous/next, shuffle.
- Case-insensitive search/filter within a deck.
- Persistence via LocalStorage (decks, cards, last active deck).
- Responsive layout and keyboard accessibility.
- Import/export deck JSON.
- Simple spaced-repetition rating (Again/Good/Easy) stored per card.
- Keyboard shortcuts: Space flip, ArrowLeft/Right navigate.

## Reflection

- Where AI saved time: AI quickly scaffolded the modal markup, CSS grid layout, and CRUD boilerplate, cutting hours of typing.
- AI bug identified and fixed: The initial AI draft reused the same card id when duplicating list items and left flip state stuck after navigating; I switched to `crypto.randomUUID()` and explicitly remove `.is-flipped` on every navigation/render.
- Code snippet refactored for clarity: Consolidated scattered `localStorage` calls into `loadState()`/`saveState()` with safe parse fallback and validation, instead of ad-hoc reads.
- Accessibility improvement: Added focus trapping in modals, ESC to close, return focus to opener, `aria-label`/`role="dialog"`/`aria-modal`, and visible `:focus-visible` outlines.
- Prompt changes that improved AI output: Asking for "vanilla JS, no frameworks, delegated events, cleanup of listeners" and "accessible modal with focus trap" produced more correct, consistent code than generic "build a modal".

## Project structure

```
index.html, styles.css, app.js   # web app
pyproject.toml, uv.lock          # Python project metadata
src/flashcards_app/              # small stdlib server helper
README.md, .gitignore
```
