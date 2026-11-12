<!--
Sync Impact Report
==================
Version change: (uninitialized template) → 1.0.0
Bump rationale: Initial ratification of project-specific constitution content (MINOR-equivalent
  for a brand-new document; 1.0.0 adopted as the first governed baseline).

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Code Quality First
  - [PRINCIPLE_2_NAME] → II. Test-Driven Development (NON-NEGOTIABLE)
  - [PRINCIPLE_3_NAME] → III. Comprehensive Automated Testing
  - [PRINCIPLE_4_NAME] → IV. Maintainability & Readability
  - [PRINCIPLE_5_NAME] → V. Simplicity & Continuous Refactoring

Added sections:
  - Quality Gates
  - Development Workflow
  - Governance (concretized)

Removed sections: none

Follow-up TODOs: none
-->

# Software Engineering 2 Constitution

## Core Principles

### I. Code Quality First

All code MUST be readable, consistent with the project style guide, and pass automated
linting and static analysis. Every module and function MUST have a single clear purpose;
dead code and commented-out code MUST be removed. Reviewers MUST reject changes that
introduce known code smells or unjustified complexity. Rationale: consistent craftsmanship
lowers defect rates and reduces onboarding cost.

### II. Test-Driven Development (NON-NEGOTIABLE)

Every new behavior MUST begin with a failing automated test written before the
implementation (Red-Green-Refactor). Tests MUST fail for the expected reason before any
production code is added, and no feature or bug fix is complete until its tests pass in CI.
Rationale: TDD keeps requirements testable and prevents regressions.

### III. Comprehensive Automated Testing

Unit tests MUST cover all business logic, and integration tests MUST cover cross-module and
external boundaries. Test suites MUST run on every commit and MUST be deterministic and
hermetic — no reliance on shared mutable state or live network services. Code coverage MUST
be measured, MUST meet the project threshold, and MUST NOT decrease without documented
justification. Rationale: fast, reliable feedback is what makes testing valuable over time.

### IV. Maintainability & Readability

Code MUST be optimized for the reader: clear names, small cohesive units, and documented
public interfaces. Magic numbers, hidden coupling, and duplicated logic MUST be eliminated
or explicitly justified. Public APIs and non-obvious design decisions MUST be documented in
the same change as the code, and significant architectural decisions MUST be recorded.
Rationale: software is read and modified far more often than it is first written.

### V. Simplicity & Continuous Refactoring

The simplest design that satisfies current requirements MUST be preferred (YAGNI), and
speculative generality MUST be rejected. Refactoring MUST happen continuously as part of
normal development rather than being deferred to a separate phase. New dependencies and
complexity MUST be justified in the change description; unjustified complexity MUST block
merge. Rationale: reducing accidental complexity keeps the codebase adaptable and testable.

## Quality Gates

All changes MUST pass linting, static analysis, and the full test suite in CI before merge.
Every change MUST receive review from at least one reviewer, and reviewers MUST verify
compliance with these principles. Coverage thresholds, performance budgets, and
dependency-vulnerability checks MUST be enforced as blocking gates. A build that fails any
gate MUST NOT be deployed.

## Development Workflow

Work MUST be delivered through small, focused changes that are easy to review and revert.
Each change MUST include its tests, documentation updates, and a clear description of its
intent and risk. The default branch MUST always remain releasable; a broken build MUST be
fixed or reverted immediately. Commits MUST be atomic, and commit messages MUST describe
both the "what" and the "why" of the change.

## Governance

This constitution supersedes all other development practices; conflicting guidance MUST be
resolved in its favor. Amendments MUST be proposed as documented changes, reviewed and
approved by project maintainers, and accompanied by a migration plan when behavior changes.
Versioning follows semantic rules: MAJOR for backward-incompatible principle removals or
redefinitions, MINOR for new or materially expanded principles or sections, and PATCH for
clarifications and non-semantic refinements. Every review and pull request MUST verify
compliance, and any deviation MUST be documented and justified. Compliance MUST be reviewed
at least once per release cycle, and unresolved violations MUST be tracked to resolution.

**Version**: 1.0.0 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-12
