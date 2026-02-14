# Calculathor Research Documents Consistency Report

> **Reviewer**: Architect Agent
> **Date**: 2026-02-14
> **Scope**: Cross-document consistency verification
> **Status**: COMPLETE - Issues Identified

---

## 1. Documents Checked

| Document | Type | Status |
|----------|------|--------|
| `/plans/research.md` | Master Research Plan | Reference Standard |
| `/plans/research-parser.md` | Parser Strategy | Checked |
| `/plans/research-architecture.md` | Multi-Client Architecture | Checked |
| `/plans/research-tui.md` | TUI Framework | Checked |
| `/plans/research-extensibility.md` | Scripting/Plugins | Checked |
| `/plans/review-parser.md` | Parser Review | Checked |
| `/plans/review-architecture.md` | Architecture Review | Checked |
| `/plans/review-tui.md` | TUI Review | Checked |
| `/plans/review-extensibility.md` | Extensibility Review | Checked |
| `/plans/review-overall.md` | Overall Review | Checked |

---

## 2. Alignment with /plans/research.md

### 2.1 Confirmed Alignments

| Decision | research.md Value | Document Alignment | Status |
|----------|-------------------|-------------------|--------|
| **MVP Variables** | NO variables/assignment | review-parser correctly identifies conflict | Partial |
| **MVP Functions** | YES user-defined functions | research-extensibility Phase 0 | Aligned |
| **Exponentiation** | `^` operator only (not `**`) | review-parser identifies conflict | Partial |
| **Runtime** | Bun (native Bun APIs) | research-architecture uses Bun APIs | Aligned |
| **Distribution** | Single binary via Bun | review-overall confirms feasibility | Aligned |
| **Protocol** | JSON-RPC 2.0 | research-architecture implements | Aligned |
| **TUI Framework** | Ink 5.x | research-tui recommends | Aligned |
| **Parser** | Pratt Parser | research-parser selects | Aligned |
| **Persistence** | SQLite (session + history) | research-architecture defines | Aligned |

### 2.2 Overall Alignment Assessment

**Documents Aligned**: 8/10
**Documents with Issues**: 2/10 (parser, architecture - both identified in reviews)

---

## 3. Inconsistencies Found

### 3.1 CRITICAL: Operator Syntax Inconsistency

**Issue**: Exponentiation operator mismatch

| Document | Reference | Content |
|----------|-----------|---------|
| `research.md` | Clarified Decisions | "Exponentiation: `^` operator only (not `**`, no alias)" |
| `research-parser.md` | Section 5.3, line 494 | Tokenizer recognizes `**` as two-character operator |
| `research-parser.md` | Section 5.2 | Registry only registers `^` for exponentiation |
| `review-parser.md` | Section 2.3 | Explicitly flags this as conflict |

**Impact**: Tokenizer allows `**` but registry doesn't define it, causing parse errors

**Resolution Required**: Remove `**` from tokenizer two-character operators list

```typescript
// Current (incorrect):
if (['==', '!=', '<=', '>=', '**'].includes(twoChar))

// Should be:
if (['==', '!=', '<=', '>='].includes(twoChar))
```

---

### 3.2 HIGH: MVP Scope Ambiguity - Variables vs Functions

**Issue**: Conflicting statements about variable support in MVP

| Document | Reference | Statement |
|----------|-----------|-----------|
| `research.md` | Clarified Decisions | "NO variables/assignment in MVP" |
| `research.md` | Decisions Log | "MVP scope? NO variables/assignment. YES user-defined functions" |
| `research-parser.md` | Section 5.1 | Includes `AssignmentNode` AST type |
| `research-parser.md` | Section 5.2 | Includes `=` operator in registry |
| `research-architecture.md` | Section 3.3 | Discusses session variable persistence |
| `review-parser.md` | Section 2.1 | "CRITICAL: MVP Scope Inconsistency" |
| `review-overall.md` | Section 6.1 | "Contradiction 1: MVP Variable Scope" (HIGH severity) |

**Clarified Interpretation**:
- **Variables**: NOT in MVP (assignment, persistent storage)
- **Functions**: INCLUDED in MVP (user-defined `f(x) = x^2` syntax)

**Resolution Required**:
1. Remove `AssignmentNode` from MVP AST types
2. Remove `=` operator from default registry for MVP
3. Keep function definition syntax in parser
4. Update architecture doc to clarify "session function definitions" not variables

---

### 3.3 MEDIUM: Bun API Usage Consistency

**Issue**: Most documents use Bun-native APIs, but some Node.js patterns remain

| Document | Reference | Status |
|----------|-----------|--------|
| `research-architecture.md` | Section 3.1 | Uses `Bun.listen()` / `Bun.connect()` - CORRECT |
| `research-architecture.md` | Section 6.2 | Uses `Bun.spawn()` - CORRECT |
| `research-extensibility.md` | Section 2.1 | Uses `import { readFile } from 'fs/promises'` - Node.js style |
| `review-architecture.md` | Section 3.1 | "Update implementation examples to use Bun-native APIs" |

**Resolution Required**: Update extensibility document examples to use Bun APIs:

```typescript
// Current (Node.js style):
import { readFile } from 'fs/promises';
const content = await readFile(path, 'utf-8');

// Should be (Bun style):
const content = await Bun.file(path).text();
```

---

### 3.4 MEDIUM: TUI Integration Approach Ambiguity

**Issue**: Direct imports vs JSON-RPC protocol inconsistency

| Document | Reference | Approach |
|----------|-----------|----------|
| `research.md` | Architecture | JSON-RPC over sockets for multi-client |
| `research-tui.md` | Section 7.3 | Shows `import { tokenize } from '../engine/tokenizer'` (direct) |
| `review-tui.md` | Section 3.3 | "Needs clarification - research.md specifies JSON-RPC" |
| `review-overall.md` | Section 6.1 | "Contradiction 3: TUI Integration Approach" |

**Resolution**: This is an intentional phased approach:
- **Phase 1-2 (Tracers 1-2)**: Direct imports acceptable for rapid prototyping
- **Phase 3+ (Tracer 3)**: Must switch to JSON-RPC

Documents should explicitly document this transition.

---

### 3.5 LOW: Number Precision Decision Gap

**Issue**: Research question unanswered in final documents

| Document | Reference | Status |
|----------|-----------|--------|
| `research.md` | Section 2.1 | "Number representation: BigInt, Decimal, arbitrary precision?" - open question |
| `research-parser.md` | Section 5.3 | Uses `parseFloat()` (IEEE 754 double) |
| `review-parser.md` | Section 3.2 | "No discussion of number precision" |

**Resolution Required**: Document explicit decision:
- **MVP**: IEEE 754 double precision (JavaScript number)
- **Rationale**: Simpler implementation, sufficient for most calculations
- **Known Limitations**: 15-17 significant digits, floating-point issues

---

### 3.6 LOW: Session Variable Persistence Clarification

**Issue**: Architecture doc assumes variables that MVP excludes

| Document | Reference | Content |
|----------|-----------|---------|
| `research.md` | Clarified Decisions | "Persistence: All survives restart" AND "NO variables/assignment in MVP" |
| `research-architecture.md` | Section 5.4 | "Session variables: Memory + SQLite, Optional persistence" |
| `review-architecture.md` | Section 3.3 | "Conflict: Session Variable Persistence vs MVP Scope" |

**Resolution**: Clarify persistence scope for MVP:
- **MVP persists**: History, settings, user-defined functions
- **MVP does NOT persist**: Variables (excluded from MVP)
- **Post-MVP**: Full variable persistence

---

## 4. Cross-Document Reference Validity

### 4.1 Verified Working References

| Source | Target | Status |
|--------|--------|--------|
| research-parser.md | research.md | Valid |
| research-architecture.md | research.md | Valid |
| research-tui.md | research.md | Valid |
| research-extensibility.md | research.md | Valid |
| All review docs | Their target docs | Valid |

### 4.2 Section References

All internal document section references are valid and resolve correctly.

---

## 5. Summary of Required Actions

### 5.1 Critical (Block Implementation)

| # | Issue | Document | Action |
|---|-------|----------|--------|
| 1 | `**` operator in tokenizer | research-parser.md | Remove `**` from two-char operators |
| 2 | MVP scope ambiguity | research-parser.md | Remove assignment/variables from MVP section |

### 5.2 High (Should Fix)

| # | Issue | Document | Action |
|---|-------|----------|--------|
| 3 | Bun API examples | research-extensibility.md | Update to Bun.file() APIs |
| 4 | TUI integration clarification | research-tui.md | Document phased approach |

### 5.3 Medium (Document)

| # | Issue | Document | Action |
|---|-------|----------|--------|
| 5 | Number precision decision | research-parser.md | Add explicit decision section |
| 6 | Persistence scope | research-architecture.md | Clarify MVP vs Post-MVP |

---

## 6. Confirmation of Alignment with /plans/research.md

After reviewing all documents, I confirm:

### 6.1 Fully Aligned Decisions

| Decision | Confirmation |
|----------|--------------|
| **MVP Math Features** | Arithmetic, trig, logs, exp, user-defined functions - CONFIRMED |
| **NO variables/assignment in MVP** | CONFIRMED (with documentation fixes noted above) |
| **YES user-defined functions** | CONFIRMED (`f(x) = x^2` syntax in Phase 0) |
| **Exponentiation: `^` only** | CONFIRMED (with tokenizer fix) |
| **Bun runtime with native APIs** | CONFIRMED |
| **Single binary distribution** | CONFIRMED |
| **JSON-RPC 2.0 protocol** | CONFIRMED |
| **Pratt parser** | CONFIRMED |
| **Ink TUI** | CONFIRMED |
| **SQLite persistence** | CONFIRMED |
| **QuickJS for Phase 1 (Post-MVP)** | CONFIRMED |

### 6.2 Final Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| MVP Scope Alignment | 8/10 | Variables/functions distinction needs clarification |
| Operator Consistency | 7/10 | `**` vs `^` conflict identified, fix documented |
| Bun API Usage | 9/10 | Minor Node.js style in extensibility doc |
| Cross-Document References | 10/10 | All references valid |
| Overall Consistency | 8.5/10 | Documents align with research.md after noted fixes |

---

## 7. Conclusion

All research documents fundamentally align with `/plans/research.md`. The identified inconsistencies are:

1. **Documentation issues** (clarity, examples) - not architectural conflicts
2. **Fixable with minor edits** - no redesign required
3. **Already identified in review documents** - no new blockers found

**Recommendation**: Address the 6 action items above, then proceed with implementation.

---

**Report Generated**: 2026-02-14
**Reviewer**: Architect Agent
**Status**: Complete
