# Changelog

## Unreleased / Pilot — 2026-07-19

This is the first working build of the ctcHealth Command Center, shared for pilot feedback.
Expect rough edges — things will change daily.

- **Foundation** — Prisma 7 + SQLite data model (projects, milestones, people, ideas), seed
  data, and a shared project-health calculation (green/amber/red) used across every view.
- **Login** — persona picker for signing in as a teammate, plus creating a new person. Sessions
  are signed cookies; every page and action checks you're signed in.
- **Projects list** — sortable, filterable table of all projects with a side panel for viewing
  and editing project details and milestones.
- **Timeline** — Gantt-style view of every project's start/end dates and milestones.
- **Board** — kanban view of projects grouped by status, drag-and-drop to update status.
- **Notifications** — heads-up banner for deadlines coming up soon, plus an archived-projects
  page to unarchive old work.
- **Notes** — rich-text notes per project (bold, italic, headings, lists), autosaved as you type.
- **Ideas** — a lightweight way to submit feedback or feature ideas from anywhere in the app.

Known gaps: no email/notification delivery outside the in-app banner, no bulk import/export,
no audit history view (only optimistic-locking conflict detection under the hood).
