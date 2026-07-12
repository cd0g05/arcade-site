---
boundary: "kickoff"
initiative: "arcade-buildout"
---

# Handoff: arcade-buildout

## Just completed
Full spec package (PRD, UX, tech design, approach, tasks) drafted, Builder-reviewed with open questions resolved (subdomain `arcade.cartercripe.com`, Vercel Web Analytics, naming policy), and kicked off: specs promoted to `active/`, initiative registered, `initiative/arcade-buildout` created and pushed.

## Approved/authoritative state
- `.cicadas/active/arcade-buildout/prd.md` → `## Scope`, `## Functional Requirements`, `## Open Questions` (all resolved)
- `.cicadas/active/arcade-buildout/ux.md` → `## Key User Flows`, `## UI States`
- `.cicadas/active/arcade-buildout/tech-design.md` → `## Architecture Decisions (ADRs)`, `## API & Interface Design`
- `.cicadas/active/arcade-buildout/approach.md` → `## Partitions (Feature Branches)`, `### Partitions DAG`
- `.cicadas/active/arcade-buildout/tasks.md` → `## Partition: feat/foundation` (tasks 1–12, all unchecked)
- `.cicadas/active/arcade-buildout/lifecycle.json` → no PR boundaries; direct merges on Builder approval

## Next action
Start the first feature branch: semantic intent check against `registry.json`, then
`python .claude/skills/cicadas/scripts/cicadas.py branch feat/foundation --intent "Scaffold, shared runtime, styles, sprite pipeline, deploy config" --modules "src/lib,src/ui,src/styles,src/sprites,scripts,vite.config.ts,vercel.json" --initiative arcade-buildout`
— then implement tasks 1–12 on task branches off `feat/foundation`, forked from `initiative/arcade-buildout`.

## Reload list
- `.cicadas/active/arcade-buildout/approach.md` (front matter + Partition 1 section)
- `.cicadas/active/arcade-buildout/tasks.md` (front matter + feat/foundation section)
- `.cicadas/active/arcade-buildout/tech-design.md` (full — foundation implements most of it)
- `Arcade Handoff.md` §2 (interaction model) and §5 (style system)
- `Arcade Mockup Claude.html` (reference implementation; read selectively)

## Carry forward
- `.cicadas/` and `instructions.md` are uncommitted on `main` — commit the Cicadas state when the Builder approves.
- Canon is empty (no bootstrap was run); branch-start reloads use the spec front matter instead of `canon/summary.md` until initiative-complete synthesis creates it.
- `src/lib`/`src/ui`/`src/styles` freeze after feat/foundation merges; later changes require a Signal (approach.md risk table).
- Partitions 2–4 are parallel after foundation; P3 owns `cabinet-entry.ts` (Signal if P4 starts first).
- Vercel project creation (task 11) needs Builder's Vercel account access/login.
