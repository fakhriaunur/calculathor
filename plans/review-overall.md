# Overall Architecture Review: Calculathor Research Plan

> **Reviewer**: Senior Architect Reviewer
> **Date**: 2026-02-14
> **Scope**: Full research plan coherence and pragmatic principles alignment
> **Documents Reviewed**:
> - `/plans/research.md` (master plan)
> - `/plans/research-parser.md` (expression engine)
> - `/plans/research-architecture.md` (multi-client architecture)
> - `/plans/research-tui.md` (TUI framework)
> - `/plans/research-extensibility.md` (scripting/plugins)
> - `/plans/review-parser.md` (prior review)
> - `/plans/review-architecture.md` (prior review)
> - `/plans/review-tui.md` (prior review)

---

## Executive Summary

**Approval Status**: APPROVED WITH RECOMMENDATIONS

The Calculathor research plan demonstrates **strong architectural coherence** and **solid alignment with pragmatic principles**. The individual component designs are well-researched and integrate logically. However, several **cross-cutting concerns** require attention before implementation, and **minor contradictions** between documents need resolution.

**Overall Assessment**: 8.5/10
- Pragmatic Principles Alignment: 9/10
- Component Orthogonality: 8/10
- Tracer Bullet Definition: 8/10
- Cross-Cutting Concerns: 7/10
- Documentation Consistency: 8/10

---

## 1. Functional Core, Imperative Shell Assessment

### 1.1 Alignment: STRONG

The architecture correctly applies the "Functional Core, Imperative Shell" principle throughout:

| Layer | Components | Purity | Verification |
|-------|------------|--------|--------------|
| **Functional Core** | Parser, Evaluator, Registry, Transforms | 100% pure | No I/O, no side effects, deterministic |
| **Imperative Shell** | CLI, TUI, Daemon, Store, Engine | Side effects at edges | I/O isolated, testable boundaries |

**Evidence of Correct Application**:

1. **Parser** (`research-parser.md` Section 5):
   - `parse(expression): AST` - pure function, string to AST
   - No global state, no I/O
   - Testable without mocks

2. **Evaluator** (`research-parser.md` Section 6):
   - `evaluate(ast, context): number` - pure function
   - Context passed explicitly, not accessed from global scope
   - Deterministic output for given input

3. **Registry** (`research-parser.md` Section 5.2):
   - Function/operator lookup is pure
   - State is immutable after initialization
   - Runtime registration creates new registry state

4. **TUI** (`research-tui.md`):
   - Correctly positioned as Imperative Shell
   - React components handle side effects (terminal I/O)
   - Delegates to pure engine via JSON-RPC

5. **Store** (`research-architecture.md` Section 5.4):
   - Persistence side effects isolated
   - Clear interface: `load()` and `save()` operations
   - Core logic works with in-memory data structures

### 1.2 Concern: Engine Classification

**Issue**: The `engine` component is listed in the Imperative Shell but has mixed responsibilities.

**Current Definition** (`research.md` Section 3.3):
```
engine: Session management | parser, evaluator, store
```

**Problem**: Session management is stateful, but the engine also orchestrates pure components. This blurs the boundary.

**Recommendation**: Split `engine` into:
```
session: Session state management | store (Imperative Shell)
orchestrator: Delegation to parser/evaluator | parser, evaluator (pure, part of Core)
```

---

## 2. Architecture Orthogonality Assessment

### 2.1 Alignment: STRONG

The architecture demonstrates excellent orthogonality with minimal cross-component dependencies:

| Component | Responsibility | Dependencies | Change Impact |
|-----------|---------------|--------------|---------------|
| `parser` | Expression → AST | None | Isolated |
| `evaluator` | AST → Number | `registry` only | Isolated |
| `registry` | Functions/constants | None | Isolated |
| `store` | Persistence | None (SQLite) | Isolated |
| `engine` | Orchestration | `parser`, `evaluator`, `store` | Contains integration only |
| `tui` | User interface | `engine` via JSON-RPC | Transport-swappable |
| `cli` | One-shot calc | `engine` via stdio | Transport-swappable |
| `daemon` | Socket server | Transport abstraction | Platform-swappable |

### 2.2 Orthogonality Verification

**Test**: "Changes in one component don't cascade to others"

| Change Scenario | Impact | Result |
|-----------------|--------|--------|
| Add new operator to parser | Registry update only | Pass |
| Change TUI framework (Ink → Blessed) | TUI component only | Pass |
| Switch SQLite to JSONL | Store interface only | Pass |
| Add new transport (WebSocket) | New transport class | Pass |
| Modify session timeout | Session manager only | Pass |
| Add plotting capability | New panel in TUI only | Pass |

### 2.3 Minor Coupling Concern

**Issue**: The TUI shows direct tokenizer import in examples (`research-tui.md` Section 7.3):
```typescript
import { tokenize } from '../engine/tokenizer';
```

**Impact**: Syntax highlighting in TUI creates compile-time dependency on parser.

**Resolution**: This is acceptable for Phase 1-2 (direct integration), but Phase 3+ should use JSON-RPC for tokenization to maintain transport abstraction.

---

## 3. Tracer Bullets Assessment

### 3.1 Definition Quality: GOOD

The tracer bullet approach (`research.md` Section 3.4) is well-defined with clear integration points:

**Tracer 1**: Basic Arithmetic Pipeline
```
CLI → Parser → Evaluator → Result
```
- **Goal**: Validate core math pipeline
- **Integration**: `echo "2 + 3" | bun run cli`
- **Status**: Well-defined, achievable

**Tracer 2**: TUI Layer
```
TUI (Ink) → Parser → Evaluator → Display
```
- **Goal**: Validate UI layer
- **Integration**: Interactive TUI runs standalone
- **Status**: Well-defined, achievable

**Tracer 3**: Daemon Architecture
```
TUI ↔ JSON-RPC ↔ Daemon ↔ SQLite
```
- **Goal**: Validate multi-client architecture
- **Integration**: TUI connects to daemon, persists history
- **Status**: Well-defined, complex but achievable

**Tracer 4**: User Functions
```
Function Registry → Storage → Parser Support
```
- **Goal**: Validate extensibility
- **Integration**: Define `f(x) = x^2`, call `f(5)`
- **Status**: Well-defined, depends on Phase 0 decision

### 3.2 Tracer Integration Points

The tracers build on each other logically:

```
Tracer 1: Core math (pure functions)
    ↓
Tracer 2: Add UI (imperative shell)
    ↓
Tracer 3: Add IPC + persistence (architecture)
    ↓
Tracer 4: Add extensibility (registry enhancement)
```

**Risk**: Tracer 3 introduces significant complexity (daemon, sockets, JSON-RPC). Consider splitting:
- Tracer 3a: In-process persistence (SQLite, no daemon)
- Tracer 3b: Full daemon architecture

### 3.3 Concern: Phase 0 Clarification

**Issue**: Tracer 4 depends on "Phase 0" function definitions from `research-extensibility.md`, but MVP scope says "NO variables in MVP" (`research.md` Clarified Decisions).

**Resolution Needed**: Clarify if user-defined functions are:
- (a) Out of MVP entirely (Tracer 4 is Post-MVP)
- (b) MVP includes functions but not variables
- (c) Both out of MVP

**Recommendation**: Option (b) - functions without persistent variables fits "NO variables" while allowing `f(x) = x^2` syntax.

---

## 4. ETC (Easier to Change) Assessment

### 4.1 Alignment: STRONG

The design consistently applies ETC principles:

| Change Scenario | Design Support | ETC Rating |
|-----------------|----------------|------------|
| Add new math function | Registry pattern - one-line registration | Excellent |
| Support new client type | Transport abstraction - implement interface | Excellent |
| Change storage backend | Store interface - swap implementation | Good |
| Add new operator | Operator registry - runtime registration | Excellent |
| Modify UI layout | React components - declarative changes | Good |
| Add plugin system | QuickJS sandbox - isolated extension | Good |
| Change number precision | Abstract number type in evaluator | Moderate |

### 4.2 ETC Patterns in Use

1. **Registry Pattern** (`research-parser.md` Section 5.2):
   - Functions, operators, constants registered at runtime
   - No parser changes needed for new operations
   - ETC: New math operations without code changes

2. **Transport Abstraction** (`research-architecture.md` Section 3.5):
   - Common `Transport` interface
   - Unix socket, TCP, stdio interchangeable
   - ETC: New transport without client changes

3. **AST-Based Evaluation**:
   - Parse once, evaluate multiple times with different contexts
   - ETC: Optimization passes, different evaluation strategies

4. **Plugin API Design** (`research-extensibility.md` Section 4):
   - Well-defined API surface
   - Sandboxed for safety
   - ETC: User extensions without engine modifications

### 4.3 ETC Gap: Number Representation

**Issue**: `parseFloat()` is hardcoded in tokenizer (`research-parser.md` Section 5.3). Changing to BigInt/Decimal requires tokenizer changes.

**Recommendation**: Abstract number parsing:
```typescript
interface NumberParser {
  parse(text: string): NumericValue;
}

// MVP: IEEE 754 double
class Float64Parser implements NumberParser { }

// Future: Arbitrary precision
class DecimalParser implements NumberParser { }
```

---

## 5. Cross-Cutting Concerns Analysis

### 5.1 Bun Runtime Compatibility

**Status**: GENERALLY COMPATIBLE with caveats

| Feature | Bun Support | Risk Level | Mitigation |
|---------|-------------|------------|------------|
| Single binary compile | `bun build --compile` | Low | Test thoroughly |
| Unix sockets | `Bun.listen()` / `Bun.connect()` | Low | Use Bun-native APIs |
| JSON-RPC | No built-in, implement custom | Low | Straightforward |
| SQLite | `bun:sqlite` built-in | Low | Use native module |
| React/JSX | Full support | Low | Verified |
| Ink TUI | Works with Bun | Low | Test `ink-text-input` |
| QuickJS | WASM module | Medium | Test loading |
| Process spawning | `Bun.spawn()` | Low | Different API than Node |

**Action Required**:
1. Proof-of-concept for Bun socket APIs
2. Verify QuickJS WASM loads correctly in compiled binary
3. Test daemon auto-spawn with `Bun.spawn()`

### 5.2 Single Binary Distribution Feasibility

**Status**: FEASIBLE with considerations

The hybrid daemon model complicates single-binary distribution:

**Challenge**: How does compiled binary spawn itself as daemon?

**Solution Pattern**:
```typescript
// Single binary, multiple modes
const mode = detectMode();
switch (mode) {
  case 'daemon': startDaemon(); break;
  case 'stdio': startStdioServer(); break;
  case 'cli': runCli(); break;
  case 'tui': runTui(); break;
}

// Auto-spawn from client
function ensureDaemon() {
  if (!daemonRunning()) {
    Bun.spawn([process.execPath, '--daemon']);
  }
}
```

**Considerations**:
- `process.execPath` works correctly with `bun build --compile`
- Socket file cleanup on crash needs SIGTERM handler
- Windows compatibility requires TCP fallback

### 5.3 Testing Strategy

**Status**: GOOD for pure core, NEEDS CLARIFICATION for integration

| Component | Test Approach | Coverage |
|-----------|--------------|----------|
| Parser | Unit tests, property-based tests | Strong |
| Evaluator | Unit tests with mocked registry | Strong |
| Registry | Unit tests | Strong |
| JSON-RPC | Integration tests needed | Not defined |
| Transport | Integration tests needed | Not defined |
| TUI | E2E tests with simulated terminal | Not defined |
| Daemon | Integration tests, process management | Not defined |

**Gap**: No integration testing strategy for multi-client scenarios.

**Recommendation**: Add testing approach:
```typescript
// Integration test example
describe('daemon-client integration', () => {
  let daemon: DaemonProcess;
  let client: JSONRPCClient;

  beforeAll(async () => {
    daemon = await startTestDaemon();
    client = await connectToDaemon();
  });

  it('evaluates expressions end-to-end', async () => {
    const result = await client.eval('2 + 2');
    expect(result).toBe(4);
  });

  it('persists history across reconnects', async () => {
    await client.eval('x = 5');
    await client.disconnect();
    await client.reconnect();
    const history = await client.getHistory();
    expect(history).toContain('x = 5');
  });
});
```

### 5.4 Error Handling Consistency

**Status**: PARTIALLY DEFINED, NEEDS STANDARDIZATION

| Layer | Error Type | Current Definition | Gap |
|-------|------------|-------------------|-----|
| Parser | SyntaxError | Line, column, message | Good |
| Tokenizer | SyntaxError | Line, column | Good |
| Evaluator | EvaluationError | Not fully defined | Missing |
| JSON-RPC | JSONRPCError | Code, message, data | Good |
| Transport | ConnectionError | Not defined | Missing |

**Recommendation**: Standardize error taxonomy:
```typescript
// Core error types
abstract class CalculathorError extends Error {
  abstract code: string;
  abstract recoverable: boolean;
  position?: SourcePosition;
}

class ParseError extends CalculathorError {
  code = 'PARSE_ERROR';
  recoverable = true;
}

class EvalError extends CalculathorError {
  code = 'EVAL_ERROR';
  recoverable = true;
}

class RuntimeError extends CalculathorError {
  code = 'RUNTIME_ERROR';
  recoverable = false;
}

// Transport errors
class ConnectionError extends CalculathorError {
  code = 'CONN_ERROR';
  recoverable = true; // Can retry
}

class DaemonError extends CalculathorError {
  code = 'DAEMON_ERROR';
  recoverable = false;
}
```

---

## 6. Contradictions and Gaps

### 6.1 Documented Contradictions

#### Contradiction 1: MVP Variable Scope

**Conflict**:
- `research.md` Clarified Decisions: "**NO variables in MVP**"
- `research-parser.md` Section 5.1: Includes `AssignmentNode` AST type
- `research-parser.md` Section 5.2: Includes `=` operator in registry
- `research-architecture.md` Section 3.3: Discusses session variable persistence

**Severity**: HIGH

**Resolution**: Clarify scope:
- Variables: NOT in MVP (per clarified decision)
- Functions: MAYBE in MVP (user-defined `f(x) = x^2`)
- Clarified decision should explicitly address functions

**Action**: Update `research.md` clarified decisions:
```markdown
| MVP Math Features | Arithmetic, trig, logs, exp, user-defined functions (no vars).
| MVP Variables | Excluded (functions OK, variables Post-MVP) |
```

#### Contradiction 2: Operator Syntax

**Conflict**:
- `research-parser.md` Section 5.3: Tokenizer recognizes `**` operator (line 494)
- `research-parser.md` Section 5.2: Registry only registers `^` for exponentiation

**Severity**: MEDIUM

**Resolution**: Choose one:
- Option A: Add `**` as alias for `^` in registry
- Option B: Remove `**` from tokenizer

**Recommendation**: Option B (simpler, `^` is standard in math)

#### Contradiction 3: TUI Integration Approach

**Conflict**:
- `research.md` Section 2.2: Architecture uses JSON-RPC over sockets
- `research-tui.md` Section 7.3: Shows direct import `import { tokenize } from '../engine/tokenizer'`

**Severity**: LOW (documentation issue)

**Resolution**: Document phased approach:
- Phase 1-2 (Tracers 1-2): Direct imports acceptable for rapid prototyping
- Phase 3+ (Tracer 3): Must use JSON-RPC

### 6.2 Undocumented Gaps

#### Gap 1: Number Precision Decision

**Issue**: Research question "Number representation: BigInt, Decimal, arbitrary precision?" from `research.md` Section 2.1 is unanswered.

**Impact**: MVP uses `parseFloat()` (IEEE 754), which has known precision issues.

**Recommendation**: Document decision:
```markdown
**MVP**: IEEE 754 double precision (JavaScript number)
**Rationale**: Simpler implementation, sufficient for most calculations
**Known Limitations**: 15-17 significant digits, 0.1 + 0.2 != 0.3
**Future**: May add decimal.js or similar for arbitrary precision
```

#### Gap 2: Session Variable Persistence Clarification

**Issue**: `research-architecture.md` assumes session variables exist, but `research.md` says no variables in MVP.

**Resolution**: Architecture document should clarify MVP supports:
- Session-scoped function definitions (transient)
- NO persistent variables (per MVP decision)
- Full persistence comes Post-MVP

#### Gap 3: QuickJS MVP Inclusion

**Issue**: `research-extensibility.md` recommends QuickJS for Phase 1 (Post-MVP), but `research.md` Section 2.4 shows "QuickJS (Phase 1)" in research completion table.

**Resolution**: Align terminology:
- Phase 0 (MVP): Expression-based functions only
- Phase 1 (Post-MVP): QuickJS scripting

---

## 7. Recommendations for Implementation

### 7.1 Pre-Implementation Actions

| Priority | Action | Owner | Impact |
|----------|--------|-------|--------|
| **Critical** | Clarify MVP variable/function scope | Project Lead | Prevents scope creep |
| **Critical** | Resolve `**` vs `^` operator | Parser Dev | API consistency |
| **High** | Define evaluator error contract | Architect | Error handling |
| **High** | Document number precision decision | Researcher | User expectations |
| **Medium** | Create Bun socket PoC | Architect | Runtime validation |
| **Medium** | Define integration test strategy | QA Lead | Quality assurance |

### 7.2 Implementation Phase Adjustments

**Phase 1 (Tracer 1)**: Core Math Pipeline
- Focus on pure functions (parser, evaluator, registry)
- No persistence, no variables
- CLI-only with stdio

**Phase 2 (Tracer 2)**: TUI Layer
- Direct imports acceptable for rapid prototyping
- Add Ink components
- Still no persistence

**Phase 3 (Tracer 3)**: Daemon + Persistence
- Switch TUI to JSON-RPC
- Add SQLite persistence
- Implement transport abstraction

**Phase 4 (Tracer 4)**: User Functions
- Function registry enhancement
- Depends on clarified MVP scope

### 7.3 Architectural Adjustments

1. **Split Engine Component**:
   ```
   session-manager: Stateful, Imperative Shell
   orchestrator: Pure delegation, Functional Core boundary
   ```

2. **Abstract Number Parsing**:
   ```typescript
   interface NumberParser {
     parse(text: string): NumericValue;
   }
   ```

3. **Standardize Error Taxonomy**:
   - Base `CalculathorError` class
   - Consistent error codes across layers
   - Recovery hints for recoverable errors

4. **Add Transport Interface**:
   ```typescript
   interface Transport {
     connect(): Promise<void>;
     send(request: JSONRPCRequest): Promise<JSONRPCResponse>;
     close(): Promise<void>;
   }
   ```

### 7.4 Testing Requirements

| Phase | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 1 | Parser, Evaluator | - | CLI smoke |
| 2 | TUI components | - | TUI manual |
| 3 | Transport, Store | Daemon-client | Full flow |
| 4 | Function registry | Plugin loading | User workflow |

---

## 8. Final Assessment

### 8.1 Strengths

1. **Solid Architectural Foundation**: The "Functional Core, Imperative Shell" principle is correctly applied throughout.

2. **Excellent Orthogonality**: Components have clear responsibilities with minimal coupling.

3. **Well-Researched Decisions**: Each major decision (Pratt parser, Ink, JSON-RPC, QuickJS) is justified with analysis.

4. **Pragmatic Tracer Bullets**: Vertical slice approach reduces integration risk.

5. **Strong ETC Principles**: Registry pattern, transport abstraction, and plugin API support future changes.

### 8.2 Concerns

1. **MVP Scope Ambiguity**: Variable vs function scope needs explicit clarification.

2. **Bun-Specific Validation Needed**: Socket APIs, QuickJS WASM loading require PoC.

3. **Integration Testing Gap**: No defined strategy for multi-client scenarios.

4. **Error Handling Inconsistency**: Not standardized across layers.

5. **Single Binary Complexity**: Daemon auto-spawn mechanism needs validation.

### 8.3 Approval Status

**PRIMARY RECOMMENDATION**: **APPROVED FOR IMPLEMENTATION**

The research plan provides a solid foundation for Calculathor. The identified issues are documentation clarifications and implementation details, not architectural flaws.

**Conditions**:
1. Resolve MVP scope ambiguity before Tracer 1 begins
2. Create Bun socket proof-of-concept before Tracer 3
3. Standardize error taxonomy before implementation

**Alternative Path** (if concerns cannot be resolved):
If MVP scope cannot be clarified or Bun compatibility issues arise, recommend a **simplified architecture**:
- Single-process only (no daemon)
- Direct imports (no JSON-RPC for MVP)
- File-based persistence (simpler than SQLite)
- Add daemon architecture Post-MVP

---

## 9. Appendices

### Appendix A: Decision Matrix Summary

| Decision | Document | Alignment | Status |
|----------|----------|-----------|--------|
| Pratt Parser | research-parser.md | Strong | Approved |
| Ink TUI | research-tui.md | Strong | Approved |
| JSON-RPC Protocol | research-architecture.md | Strong | Approved |
| Unix Sockets + TCP | research-architecture.md | Strong | Approved |
| QuickJS Post-MVP | research-extensibility.md | Strong | Approved |
| Hybrid Daemon Model | research-architecture.md | Good | Approved |
| NO Variables MVP | research.md | Needs clarification | Pending |

### Appendix B: Risk Summary

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bun socket API differences | Medium | Low | PoC validation |
| MVP scope creep | Medium | High | Explicit decisions doc |
| Single binary daemon spawn | Medium | Medium | argv[0] pattern |
| QuickJS WASM loading | Low | Medium | Early testing |
| Terminal compatibility | Medium | Low | Test matrix |
| Session timeout handling | Low | Low | Clear implementation |

### Appendix C: Document Cross-Reference

| Concept | Primary Doc | Related Docs | Consistency |
|---------|-------------|--------------|-------------|
| Parser | research-parser.md | research.md | Strong |
| Architecture | research-architecture.md | research.md | Strong |
| TUI | research-tui.md | research.md | Good |
| Extensibility | research-extensibility.md | research.md | Good |
| Tracer Bullets | research.md | All | Good |

---

**Review Completed**: 2026-02-14
**Reviewer**: Senior Architect Reviewer
**Next Step**: Address pre-implementation actions, proceed to implementation
