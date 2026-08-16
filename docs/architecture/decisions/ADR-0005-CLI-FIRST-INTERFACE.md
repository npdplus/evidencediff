# ADR-0005 — CLI-First Interface

**Status:** Accepted

## Context
V0.1 must prove developer value before investing heavily in a visual application.

## Decision
CLI is the primary V0.1 interface. A local Viewer is optional/later and is not a V0.1 release blocker.

## Consequences
Core/contracts cannot depend on terminal rendering. Future Viewer/CI tools consume the same domain behavior rather than duplicate it.
