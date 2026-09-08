# Habit OS — Phase 2 Omni interaction audit

## Old interaction model

Search (`/`), Command Center (`Cmd/Ctrl+K`), Quick Capture, Today search, mobile capture, page FABs, and Habit OS Coach each exposed overlapping entry points. Search and commands also used separate sheets and separate input semantics.

## New model

The shell now opens one lazy-loaded Omni Panel (`src/components/shell/OmniPanel.jsx`). Its implementation reuses the existing Command Center, quick capture, query parser, command registry, search logic, personalization, and Local Coach.

One input supports:

- Search results
- Create/capture previews
- Commands
- Coach answers
- Existing deterministic query filters

Search and Commands tabs remain as accessible views of the same panel, not separate products. Typing an exact command or capture naturally shows the corresponding result. A search-mode panel focuses directly on local results.

## Entry point aliases

- `/` → Omni Panel focused on Search
- `Cmd+K` / `Ctrl+K` → Omni Panel focused on Commands
- Mobile Capture → Omni Panel focused on Create
- Today Search → Omni Panel focused on Search
- Sidebar Search → Omni Panel focused on Search
- Existing SearchPalette import → compatibility alias to Omni Panel

## Search and deep links

Search remains local-first and now exposes existing search results for habits, routines, projects, project tasks, assignments, subtasks, goals, milestones, notes, dates, and achievements. Results use listbox/option semantics and preserve arrow/Enter/Escape behavior.

Result destinations use canonical routes:

- Project → `#/projects/:id`
- Project task → `#/projects/:id`
- Assignment / subtask → `#/assignments/:id`
- Habit → `#/habits/:id`
- Goal / milestone → `#/goals/:id`
- Achievement → `#/insights?view=achievements`
- Notes → `#/insights?view=record`
- Dates → `#/habits?view=calendar`

## Capture

Capture continues to use `quickCapture.js`, `queryParser.js`, `CaptureBody`, `validateCapture`, `detectDuplicate`, and the existing reducer/sync pipeline. Creation always shows a confirmation preview. No Omni-specific datastore or parser was added.

## Coach

The permanent Today Coach input was removed. Coach access is now routed through the Omni input for questions such as:

- What should I focus on?
- Why is this at risk?
- How did my week go?

It remains local and deterministic: Provider LOCAL, External AI OFF, Cost $0.

## Offline and sync

Search remains over local state. Capture dispatches through the existing reducer and signal pipeline, so offline creation and later sync are unchanged.

## Performance

Omni is lazy-loaded. Analytics Lab remains lazy-loaded. No dependency was added. Build proof continues to enforce three.js lazy-only behavior.
