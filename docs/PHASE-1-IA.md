# Habit OS — Phase 1 IA and route coverage

## Old IA

The shell exposed implementation-oriented destinations across separate groups: Today/Calendar, Build (Habits, Goals, Projects, Assignments), Plan (Workload, Deadlines, Week), and Understand (Insights, Achievements, Mind, Record). Mobile used a different four-tab model and placed Habits and Goals in More.

## New IA

The product now has one shared primary model on desktop and mobile:

- **Today** — execution home and today's timeline
- **Work** — Deliverables, Projects, Workload, and Deadlines
- **Habits** — Active, Routines, Calendar, and Week review
- **Goals** — goals, milestones, contributors, and forecasting
- **Insights** — Highlights & Patterns, Deep Dive, Analytics Lab, Mind, Achievements, and Record

Settings remains a system destination. Search, Quick Capture, and Command Center remain available and were not merged in this phase.

## Route mapping

| Existing URL | Canonical location | Compatibility |
| --- | --- | --- |
| `#/today` | Today | canonical |
| `#/projects` | Work → Projects | legacy screen retained; Work is active |
| `#/assignments` | Work → Deliverables | legacy screen retained; Work is active |
| `#/workload` | Work → Workload | legacy screen retained; Work is active |
| `#/timeline` | Work → Deadlines (`#/work?view=deadlines`) | legacy screen retained |
| `#/library` | Habits | legacy screen retained |
| `#/calendar` | Habits → Calendar | legacy screen retained |
| `#/week` | Habits → Week review | legacy screen retained |
| `#/mind` | Insights → Mind (`#/insights?view=mind`) | legacy screen retained |
| `#/record` | Insights → Record (`#/insights?view=record`) | legacy screen retained |
| `#/achievements` | Insights → Achievements (`#/insights?view=achievements`) | legacy screen retained |
| `#/goals` | Goals | canonical |
| `#/insights` | Insights | canonical |
| `#/settings` | Settings | system |

The hash router now preserves query state, so canonical contextual links do not require a second routing framework. Existing detail URLs such as `#/projects/:id`, `#/assignments/:id`, `#/goals/:id`, and `#/habits/:id` remain valid.

## Feature coverage matrix

| Feature | New location | Tested / preserved |
| --- | --- | --- |
| Next Best Action, planning, Focus, Coach, Recovery | Today contextual actions | existing Today tests |
| Assignments / project tasks / deadlines | Work → Deliverables / Deadlines | existing work tests + route tests |
| Projects, milestones, burndown, forecasting | Work → Projects | existing project tests |
| Capacity and overload | Work → Workload | existing work tests |
| Active habits and routines | Habits | existing habit tests |
| Calendar and week review | Habits → Calendar / Week | existing calendar/week tests |
| Goals and GoalAtlas detail mode | Goals | existing goal tests |
| Highlights, patterns, deep dive | Insights | existing insights tests |
| Analytics Lab | Insights → Lab | existing lazy boundary and analytics tests |
| Mind / Achievements / Record | Insights contextual views | existing screen tests |
| Search / Quick Capture / Command Center | global shell action surfaces | existing capture/search tests |
| Settings / auth / migration / sync | Settings/system | existing app and migration tests |

No data model, intelligence engine, Supabase policy, visual theme, or business logic was changed.
