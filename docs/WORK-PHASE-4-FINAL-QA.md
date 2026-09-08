# Phase 4 — final Work browser / visual QA

## Actual browser proof

- **Environment:** GitHub Actions, Ubuntu runner, real `Chrome/152.0.7977.0` (Chromium engine), production Vite build.
- **Application fix commit:** `4033a0b718e71e6842af02ea2e900a5cf928fd5b`.
- **Successful CI run:** https://github.com/aaru1yg/habbit-trackerrr/actions/runs/34221716176
- **Execution boundary:** Branch-only QA. No merge, deployment, schema/engine changes, or Phase 5 work.
- **Local browser status:** No local Chromium pass is claimed. The screenshots and browser assertions below were produced in GitHub CI, retrieved through the GitHub Checks API and visually reviewed.

| Viewport | Browser checks passed | Failed | Console errors | Uncaught errors | Failed asset requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 126 | 0 | 0 | 0 | 0 |
| 430×932 | 126 | 0 | 0 | 0 | 0 |
| 1440×900 | 104 | 0 | 0 | 0 | 0 |

**Total: 356 browser assertions passed.** The mobile jobs additionally enforce touch-target dimensions. All three jobs test standard-motion overview rendering and reduced-motion Work navigation, interaction and layouts.

## Failures found and narrowly scoped fixes

### Genuine browser findings

The first CI run and the API-diagnostic rerun found three mobile controls below the 44px target height:

1. Assignment detail → related-project link: **19.5px** high.
2. Work Focus → “Why this action?” disclosure: **22.5px** high.
3. Create assignment → progress range input: **16px** high.

Fix: `src/styles/workspace.css` adds scoped 44px hit areas to those existing controls. No action semantics, layout redesign, schemas or intelligence calculations changed.

### QA harness findings (not application regressions)

The scenario seeder used `page.goto` between hash routes on the same document. Consequently `evaluateOnNewDocument` did not run, the next fixture was not applied, and the project-completion dialog/state leaked into later scenarios. That caused false failures for Workload day selection/Plan, the mobile deadline journey, and the empty state.

Fix: the Work browser seeder first visits `about:blank`, guaranteeing a new application document before installing the fixture. Native pointer input remains in use; the tests were not changed to bypass overlays with JavaScript clicks. This also ensures the reduced-motion media preference is observed when the app initializes.

The sandbox could reach GitHub's API but could not fetch the signed artifact-storage redirects. A QA-only publisher therefore also exposes results and encoded CI screenshot previews through check annotations. Full-resolution PNGs remain in the standard Actions artifacts; no generated screenshots were added to Git.

## Required validation checklist

All rows below passed in the three CI viewport jobs:

| Requirement | Evidence / exercised behavior |
| --- | --- |
| 1. `#/work` opens | Production app, real persisted fixture, canonical heading and route |
| 2. Overview default | Overview navigation link is selected on `#/work` |
| 3. At Risk / Due Soon / Active Work | Summary labels present; active work begins above the fold; screenshots reviewed |
| 4. Deliverables | Actual Work navigation, rows, detail link, screenshot and layout checks |
| 5. Projects | List-first view, original project detail links |
| 6. Project detail | Status, next work, milestones and task controls; screenshot review |
| 7. Project tasks | Native task completion updates persisted state |
| 8. Assignments | Original assignment detail route, deadline, progress and subtasks |
| 9. Assignment Focus | Selected assignment opens Focus; Start advances to Pause |
| 10. Workload | Seven day cells, selected-day change, original contributors |
| 11. Deadlines | Today horizon opens chronological filtered deadline view and original detail |
| 12. Filters | Keyboard All, Overdue, Completed, Active, local query and Today horizon |
| 13. Empty state | Fresh empty fixture, guidance and create action, no empty capacity dashboard |
| 14. Overloaded state | Single explanation, Plan and Recover dialogs open correctly |
| 15. Completed state | Completed assignment is separate and uses quiet completed styling |
| 16. Legacy routes | Projects / Assignments / Workload / Timeline retain hashes and select corresponding Work subviews |
| 17. Deep links | Task and milestone query links focus the original detail/editor targets; assignment links resolve |
| 18. Horizontal overflow | None across captured Work/detail/dialog/legacy states |
| 19. Clipped dialogs | None: Focus, ItemActions, Create work, Create project, Plan, Recover |
| 20. Broken assets | No broken loaded images or failed asset/network requests |
| 21. Console errors | Zero console errors and zero uncaught browser exceptions |
| 22. Keyboard | Enter operates filters/navigation; Focus traps Tab and Escape restores the trigger |
| 23. Reduced motion | Work animation/transition durations disabled; full reduced-motion journeys pass |
| 24. Touch targets | Existing Work/detail/dialog controls meet 44px with 1px layout-rounding tolerance |
| 25. Spatial/gallery opt-in | Not mounted by default; explicit selection mounts gallery; List unmounts it; screenshots reviewed |

## Visual review and artifacts

Reviewed CI-rendered overview, deliverables, project detail and optional gallery at all three sizes, together with Focus/Plan and empty-state evidence. Existing hierarchy/presentation was retained. No additional visual redesign was made.

Each matrix artifact (`work-chromium-390x844`, `work-chromium-430x932`, `work-chromium-1440x900`) includes:

- Standard and reduced-motion overview screenshots.
- Deliverables, Projects, Workload and Deadlines screenshots.
- Assignment detail, project detail and task deep-link screenshots.
- Gallery, completed and empty-state screenshots.
- Focus, ItemActions, Create work, Create project, Plan and Recover dialogs.
- Four legacy-route screenshots.
- Browser/server logs and `results.json` with browser version, tested commit and per-scenario results.

The matching **Work visual evidence** check runs provide API-readable results and JPEG previews when artifact storage is unreachable.

## Final regression gates

Executed locally after the application fix, and repeated successfully in GitHub CI:

- `npm test`: **836 passed in 43 files**.
- `npm run lint`: **passed, zero warnings**.
- `npm run build`: **passed**, unchanged performance budgets; initial JS approximately **233.2 KiB gzip**, CSS **38.3 KiB gzip**.
- `npm run test:schema`: **28 passed**, existing PostgreSQL/RLS isolation checks.
- `git diff --check`: **passed**. CI additionally checks the pushed commit diff.

The final report/documentation commit may follow the application fix; the successful run above identifies the exact application code reviewed. A branch push reruns the same non-deploying matrix and regression gates for that documentation commit as well.

**Phase 5 was not started. Nothing was deployed or merged.**
