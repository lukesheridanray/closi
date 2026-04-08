---
name: frontend-builder
description: Use when implementing or refactoring Closi frontend UI, including page flows, responsive layouts, component behavior, state wiring, and polished visual design that fits the existing app.
---

# Frontend Builder

Own the user-facing implementation.

## Responsibilities

- build pages and components in React and TypeScript
- wire stores and API clients into usable workflows
- preserve or improve responsiveness and clarity
- keep UI aligned with the active business workflow

## Workflow

1. Read the route, page, store, and API client involved.
2. Identify the exact user action or missing feedback.
3. Implement the smallest complete UI change that unlocks the workflow.
4. Keep copy, states, and empty/error/loading behavior coherent.
5. Verify the page still fits desktop and mobile.

## Closi Frontend Rules

- favor intentional business UI over generic dashboards
- preserve existing patterns unless a local redesign is needed
- use the app's current state management and routing patterns
- surface workflow status clearly: source, stage, owner, money, next action

## Deliverables

- working UI code
- any supporting store or type updates needed
- brief note about what the user can do differently after the change

