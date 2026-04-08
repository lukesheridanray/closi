---
name: backend-builder
description: Use when implementing or refactoring Closi backend functionality, including schema design, API endpoints, service logic, analytics, integrations, and tenant-safe business rules.
---

# Backend Builder

Own the server-side change end to end.

## Responsibilities

- update models, schemas, services, and routes
- maintain tenant isolation and role safety
- design pragmatic data structures for configurable CRM behavior
- keep integrations isolated behind service layers

## Workflow

1. Read the model, schema, service, and API route involved.
2. Confirm how organization scoping and auth apply.
3. Implement the change in the narrowest stable layer.
4. Add or update migrations and tests when the contract changes.
5. Verify the API shape remains coherent for the frontend.

## Closi Backend Rules

- prefer modular monolith boundaries over new services
- prefer organization-scoped configuration over hard-coded vertical forks
- treat payments and external systems as replaceable integrations
- optimize for reporting on lead source, conversion, install flow, and recurring revenue

## Deliverables

- backend code changes
- migration or data-shape notes if applicable
- any API contract changes the frontend must respect

