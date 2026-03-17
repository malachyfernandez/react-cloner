# Agent Handbook

This document captures the current state of the `react-visual-clone` CLI, why the strict "visual-strip" approach exists, and how to debug or extend the tool without regressing into the earlier brittle behavior.

## Mental Model

- The CLI is not a prop-mocking harness. It is a **visual subtree compiler**.
- Mirrored files live under `.visual-clone/mirrored/` inside the copied project.
- Mirrored components must be **pure visual shells**: no props, no hooks, no business logic.
- Ignored folders (e.g. `app/components/ui`, `app/components/layout`) stay real. Everything else is mirrored.
- The copied project is the only place we mutate. The source project is never touched.

## Current Architecture Overview

1. **CLI (`src/cli-final.ts`)**
   - Copies the project (Phase 1).
   - Builds the subtree graph (Phase 3).
   - Optional `--mirror-all` flag scans the entire project for additional `.tsx/.jsx` files and forces them into the mirror set so nothing relies on real logic.
   - Mirrors components via `mirrorComponent` (Phase 4).
   - Patches the copied base file via `overwriteWithShell` (Phase 5).

2. **Strict Visual-Strip Transformer (`mirrorComponent`)**
   - Removes interface definitions and prop signatures.
   - Inserts preview bindings (`__preview_text`, `__preview_number`, etc.).
   - Deletes hook imports and any `hooks/` references.
   - Sanitizes JSX line-by-line: drops maps/conditionals/control flow, replaces handlers with noops, normalizes class names, and rewrites dynamic expressions to preview bindings.
   - Ensures mirrored files parse cleanly (validated via a parser pass before Expo).

3. **Verification Workflow**
   - `npm run build` inside `react-cloner`.
   - `node dist/cli-final.js generate ... --mirror-all --base-mode overwrite-shell`.
   - `(cd preview && npm install)` so Expo has dependencies.
   - `npx expo start --web --port <port>` to confirm bundling/runtime success.
   - Parser check over `.visual-clone/mirrored/**` before Expo helps catch malformed JSX fast.

## Why We Abandoned the Old Approach

**Old behavior (failed):**
- Tried to keep props and selectively replace expressions.
- Left hooks/business logic in place, so mirrored files still depended on real runtime data.
- Minimal regex edits corrupted imports (`import "Lorem ipsum" from ...`) and left dangling expressions (`game.value.name`), causing continuous runtime errors (`game is undefined`, `gameInfo[0] is undefined`).
- Debugging was reactive and file-specific, so each new component required ad-hoc fixes.

**New behavior (current):**
- Every mirrored component is rebuilt from scratch: `const Component = () => ...`.
- Hooks, props, handlers, maps, ternaries are removed or simplified before they can crash.
- Preview bindings are synthesized for all JSX identifiers, so nothing references unknown data.
- Parser + Expo verification after each generation catches issues before the user sees them.
- `--mirror-all` ensures we never rely on an unmirrored helper file when the target component expands.

## Debugging Playbook

1. **Sanity check CLI output**: look for the "Found N components" + "mirror-all added" lines to confirm coverage.
2. **Run the parser script** against `.visual-clone/mirrored` to catch syntax issues.
3. **Inspect mirrored files** if parser errors mention a file/line.
4. **Rerun Expo** only after the parser passes.
5. **If Expo still fails**, read `.expo/web/cache/development/bundles` logs or browser console; fix the mirror transformer rather than patching generated files manually.

## Extension Guidelines

- When adding new transformations, prefer AST-based edits inside `mirrorComponent`. The current implementation is still regex-heavy; future work should move toward an AST-driven JSX simplifier.
- Keep the aggressive defaults: if an expression is risky, replace it with a safe preview value.
- Always update the README + agent notes if the workflow changes (new flags, new verification steps, etc.).

## TL;DR for Future Agents

- Run the full build → generate (`--mirror-all`) → npm install → Expo → README/agent verification loop.
- Do not reintroduce prop-based mirroring. It causes cascading runtime failures.
- Treat `.visual-clone/mirrored` as a deterministic render tree generator. If something crashes, fix the transformer so *every* component benefits.
- Document your debugging approach here before you leave, so the next agent can keep pushing forward without repeating old mistakes.
