# Calculathor Research Plan

> **Project**: Calculathor - A powerful yet lightweight calculator
> **Tagline**: Powerful like Thor, light as a feather
> **MVP Focus**: TUI-first, multi-client architecture
> **Approach**: Pragmatic Programmer (Orthogonality, ETC, Tracer Bullets)
> **Phase**: Phase 2 - Prototyping (Decisions Finalized)

## Clarified Decisions

| Question | Decision |
|----------|----------|
| **MVP Math Features** | Arithmetic, trig, logs, exp, **user-defined functions** (`f(x) = x^2`). **NO variables/assignment in MVP** |
| **Persistence** | All survives restart: history, variables, functions, settings (JSONL/SQLite) |
| **Distribution** | Single binary via **Bun**, extensible to GitHub releases |
| **Long-running calc** | Simple blocking evaluation (defer async/cancel) |
| **CAS** | Purely numeric (no symbolic math) |
| **Exponentiation** | `^` operator only (not `**`, no alias - canonical math notation) |
| **Plugin Security** | Math sandbox default, extensible to network access |
| **Runtime** | **Bun** - native Bun APIs (`Bun.listen`, `Bun.connect`), not Node.js compat |

---

## 1. Project Vision & Goals

### Core Philosophy
- **Powerful**: Support complex math, scripting, extensibility
- **Lightweight**: Minimal resource usage, fast startup (<100ms)
- **Multi-client**: Core engine + multiple UIs (TUI, CLI, future GUI)
- **TUI-first MVP**: Rich terminal interface as primary focus

### Success Metrics
| Metric | Target |
|--------|--------|
| Startup time | <100ms |
| Memory footprint | <10MB (core) |
| Expression eval | <1ms |
| TUI responsiveness | 60fps |

---

## 2. Research Domains

### 2.1 Expression Engine
**Questions to answer:**
- Parser strategy: Pratt parser vs Shunting yard vs Parser generator
- Number representation: BigInt, Decimal, arbitrary precision?
- Function registry: How to support extensible built-ins?
- Error handling: Graceful degradation for invalid input

**Deliverables:**
- [ ] Parser comparison document
- [ ] Benchmark prototype for 3 parser approaches
- [ ] Number type decision matrix

### 2.2 Multi-Client Architecture
**Questions to answer:**
- Communication: IPC (stdio), sockets, or shared memory?
- Protocol: JSON-RPC, gRPC, custom binary?
- State management: Server-stateful vs stateless?
- Client discovery: How do clients find the engine?

**Deliverables:**
- [ ] Architecture diagram
- [ ] Protocol specification draft
- [ ] Proof-of-concept IPC implementation

### 2.3 TUI Framework
**Questions to answer:**
- Library choice: Ink (React), Blessed, Bubble Tea (Go), or native?
- Layout system: Responsive grid, fixed panels?
- Input modes: Vim-style, Emacs, or simple?
- History/replay: How to persist and navigate?

**Deliverables:**
- [ ] TUI framework comparison
- [ ] Wireframes for main interface
- [ ] Input handling prototype

### 2.4 Scripting/Extensibility
**Questions to answer:**
- Embedded language: Lua, JavaScript (QuickJS), WASM, or custom DSL?
- Plugin system: Dynamic loading, sandboxing requirements?
- Standard library: Math functions, constants, conversions?

**Deliverables:**
- [ ] Language comparison document
- [ ] Plugin API design sketch
- [ ] Security considerations for user scripts

### 2.5 State & Persistence
**Questions to answer:**
- Session storage: Variables, functions, history
- Config format: TOML, YAML, JSON, or custom?
- History format: Plain text, SQLite, or binary?

**Deliverables:**
- [ ] Storage schema design
- [ ] Migration strategy for future versions

---

## 3. Technical Constraints

### Must Have
- TypeScript (maintainability, type safety)
- **Bun runtime** (single binary compilation, better performance)
- Single binary distribution (`bun build --compile`)
- Cross-platform (Linux, macOS, Windows)

### Nice to Have
- WebAssembly for performance-critical paths
- Built-in unit conversion
- Plotting/graphing capability (future)

---

## Pragmatic Development Approach

Following *The Pragmatic Programmer* principles:

### 1. Orthogonality (DRY)
| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `parser` | Expression → AST | None |
| `evaluator` | AST → Number | `registry` only |
| `registry` | Functions/constants | None |
| `engine` | Session management | `parser`, `evaluator`, `store` |
| `tui` | User interface | `engine` via JSON-RPC |
| `cli` | One-shot calc | `engine` via stdio |
| `store` | Persistence | None (SQLite) |

**Rule**: Changes in one component don't cascade to others.

### 2. Easier to Change (ETC)
- Function registry allows adding math ops without touching parser
- Plugin API allows user extensions without engine changes
- Transport layer (sockets/stdio) swappable without client changes
- Storage backend (JSONL/SQLite) abstracted behind interface

### 3. Functional Core, Imperative Shell

Separating pure business logic from side effects:

**Functional Core** (Pure, Testable, Side-Effect Free):
| Module | Responsibility | Pure Functions |
|--------|---------------|----------------|
| `parser` | String → AST | `parse(expression): AST` |
| `evaluator` | AST → Number | `evaluate(ast, context): number` |
| `registry` | Function lookup | `lookup(name): FunctionDef` |
| `transforms` | AST optimization | `optimize(ast): AST` |

**Imperative Shell** (I/O, State, Side Effects):
| Module | Responsibility | Side Effects |
|--------|---------------|--------------|
| `cli` | Input/output | `process.stdin`, `console.log` |
| `tui` | Terminal UI | Ink rendering, key events |
| `daemon` | Socket server | Unix sockets, TCP |
| `store` | Persistence | SQLite, file system |
| `engine` | Orchestration | Session state, client mgmt |

**Benefits**:
- Core logic is 100% testable without mocks
- Side effects isolated at the edges
- Easy to swap I/O mechanisms (stdio ↔ socket ↔ web)
- Parallel evaluation possible in core

### 4. Tracer Bullet Development (Vertical Slices)
Instead of horizontal layers, build end-to-end thin slices:

**Tracer 1**: Basic arithmetic (no persistence, no daemon)
- CLI only → Parser → Evaluator → Print result
- Validates core math pipeline

**Tracer 2**: Add TUI
- Same parser/evaluator → Ink interface
- Validates UI layer

**Tracer 3**: Add daemon + persistence
- Unix sockets → SQLite storage
- Validates architecture

**Tracer 4**: User-defined functions
- Function registry → Storage
- Validates extensibility

Each tracer is a working product. No "big bang" integration.

---

## 4. Research Tasks

### Phase 1: Research ✓ COMPLETE
| Task | Status | Output |
|------|--------|--------|
| Parser research | ✅ | Pratt Parser selected |
| Architecture research | ✅ | Daemon + JSON-RPC 2.0 |
| TUI research | ✅ | Ink 5.x selected |
| Extensibility research | ✅ | QuickJS (Phase 1) |

### Phase 2: Tracer Bullets (Current)

**Tracer 1: Core Math Pipeline** (No persistence, no daemon)
| Task | Owner | Output |
|------|-------|--------|
| Tokenizer | coder | `/src/parser/tokenizer.ts` |
| Pratt parser | coder | `/src/parser/pratt.ts` |
| Evaluator | coder | `/src/evaluator/` |
| CLI client | coder | `/src/cli.ts` |
| **Integration** | - | `echo "2 + 3 * 4" \| bun run cli` works |

**Tracer 2: TUI Layer**
| Task | Owner | Output |
|------|-------|--------|
| Ink setup | coder | `/src/tui/` |
| Input component | coder | Syntax-highlighted input |
| Results panel | coder | Scrollable history |
| **Integration** | - | Interactive TUI runs standalone |

**Tracer 3: Daemon Architecture**
| Task | Owner | Output |
|------|-------|--------|
| JSON-RPC protocol | coder | `/src/protocol/` |
| Unix socket transport | coder | `/src/transport/` |
| SQLite persistence | coder | `/src/store/` |
| **Integration** | - | TUI ↔ Daemon ↔ Storage works |

**Tracer 4: User Functions**
| Task | Owner | Output |
|------|-------|--------|
| Function registry | coder | `/src/registry/` |
| Function storage | coder | SQLite table |
| Parser support | coder | `f(x) = x^2` syntax |
| **Integration** | - | Define and call user functions |

### Phase 3: Polish & Distribution
| Task | Owner | Output |
|------|-------|--------|
| Bun compile config | coder | Single binary build |
| GitHub Actions | coder | Release automation |
| Documentation | coder | README + examples |
| **Release** | - | v0.1.0 binary published |

---

## 5. Decisions Log

| Date | Question | Decision |
|------|----------|----------|
| 2026-02-14 | Daemon vs spawn? | Hybrid: Daemon for TUI, spawn-per-client for CLI |
| 2026-02-14 | Long-running calc? | Simple blocking (defer async) |
| 2026-02-14 | CAS features? | Numeric only, no symbolic math |
| 2026-02-14 | MVP scope? | NO variables/assignment. YES user-defined functions (`f(x) = x^2`) |
| 2026-02-14 | Persistence scope? | All state: history, vars, functions, settings |
| 2026-02-14 | Distribution? | Single binary via Bun |
| 2026-02-14 | Exponentiation? | `^` operator only (not `**`) |
| 2026-02-14 | Bun APIs? | Native Bun APIs (`Bun.listen`, not Node `net`) |
| 2026-02-14 | Plugin network? | Sandbox default, extensible to network |

---

## 6. References

- [ ] `bc` - Arbitrary precision calculator
- [ ] `qalc`/`qalculate` - Multi-purpose calculator
- [ ] `kalker` - TUI calculator with functions
- [ ] `insect` - Unit-aware calculator
- [ ] `fx` - Terminal JSON viewer (good TUI reference)

---

**Next Step**: Review research plan with hierarchical-mesh swarm before implementation.
