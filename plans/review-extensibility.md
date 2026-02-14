# Code Review: Calculathor Scripting & Extensibility Research

> **Document**: `/plans/research-extensibility.md`
> **Reviewer**: Code Review Agent
> **Date**: 2026-02-14
> **Status**: APPROVED with Minor Recommendations

---

## Executive Summary

The extensibility research document presents a well-reasoned two-tier approach (expressions → QuickJS) that aligns with project constraints and industry best practices. The security model is sound, the phased rollout is pragmatic, and the plugin API design shows good forward-thinking.

**Overall Assessment**: APPROVED for implementation

---

## 1. Two-Tier Approach Analysis

### 1.1 Tier 1: Expression-Based Functions (MVP)

**Assessment**: SOUND

The decision to defer full scripting to Phase 1 and use expression-based function definitions for MVP is excellent:

```
f(x) = x^2 + 2*x + 1
g(x, y) = sqrt(x^2 + y^2)
```

**Strengths**:
- No external dependencies in MVP
- Keeps MVP scope manageable
- Builds on existing expression engine
- User functions are naturally sandboxed (can only use expression syntax)

**Alignment with Research Decisions**:
- Matches `research.md` decision: "NO variables in MVP" but user functions ARE included
- Follows "Tracer Bullet Development" - expression functions validate the extensibility concept before adding QuickJS

### 1.2 Tier 2: QuickJS Integration (Post-MVP)

**Assessment**: SOUND

QuickJS is the right choice for embedded JavaScript:

| Factor | Evaluation |
|--------|------------|
| Security | Built-in sandboxing without native dependencies |
| Performance | Adequate for calculator use cases |
| Bundle Size | ~500KB acceptable for functionality gained |
| Familiarity | JavaScript has lowest learning curve |

**Recommendation**: The comparison matrix correctly identifies QuickJS as the balanced choice.

---

## 2. Security Considerations Review

### 2.1 Threat Model Coverage

**Assessment**: COMPREHENSIVE

The threat model table covers all critical vectors:

| Threat | Status | Notes |
|--------|--------|-------|
| File system access | Addressed | Sandboxed VMs prevent this |
| Network access | Addressed | No host imports for network |
| Infinite loops | Addressed | Execution time limits specified |
| Memory exhaustion | Addressed | Memory limits proposed |
| Prototype pollution | Partial | Needs explicit mention of mitigation |
| Data exfiltration | Addressed | Sandboxing prevents unsanctioned access |

### 2.2 Security Recommendations

**Current Document**: Lists 6 recommendations

**Gap Identified**: Prototype pollution prevention is mentioned in the threat table but lacks specific mitigation strategy in the recommendations.

**Suggested Addition**:
```markdown
7. **Prototype Pollution Prevention**:
   - Freeze `Object.prototype` in QuickJS context
   - Use `Object.create(null)` for internal objects exposed to scripts
   - Avoid exposing constructor functions that could be tampered with
```

### 2.3 QuickJS Sandboxing Details

The document correctly identifies key sandboxing mechanisms:
- `delete this.eval`
- `delete this.Function`
- Controlled global object injection
- Memory limits

**Missing**: CPU time limits via interrupt handlers need more detail.

**Suggested Code Addition**:
```typescript
// In the host implementation sketch, add:
private setupInterruptHandler(vm: QuickJSContext, maxOps: number): void {
  let opCount = 0;
  vm.runtime.setInterruptHandler(() => {
    opCount++;
    if (opCount > maxOps) {
      return true; // Interrupt execution
    }
    return false;
  });
}
```

---

## 3. Plugin API Design Review

### 3.1 API Surface

**Assessment**: WELL-DESIGNED

The proposed API in Section 4.1 is comprehensive:
- Math functions (sin, cos, sqrt, etc.)
- Constants (PI, E, PHI)
- Persistence (setVar, getVar)
- Function registration
- Output utilities

**Strengths**:
- TypeScript definitions provided
- Clear separation between built-ins and user-defined
- Persistence API allows stateful plugins

### 3.2 Plugin Manifest

**Assessment**: GOOD FOUNDATION

The manifest structure includes essential fields:
- name, version, description, author, license
- Main entry point
- API version compatibility
- Dependencies
- Configuration schema

**Concern**: The `dependencies` field for other plugins could introduce complexity.

**Recommendation**: Mark plugin dependencies as "Phase 2+" feature. MVP plugins should be self-contained to reduce complexity.

### 3.3 Future Extensibility

**Positive Indicators**:
- Unit definition API placeholder (`defineUnit`, `convert`)
- Async script support mentioned in roadmap
- WASM plugin support reserved for Phase 3

---

## 4. Alignment with "Functional Core, Imperative Shell"

### 4.1 Architecture Fit

**Assessment**: WELL-ALIGNED

The plugin system fits naturally into the architecture:

| Layer | Plugin System Component | Responsibility |
|-------|------------------------|----------------|
| **Functional Core** | Expression evaluation | Pure function calls, no side effects |
| **Functional Core** | Plugin function registry | Immutable function lookup |
| **Imperative Shell** | QuickJS VM management | VM lifecycle, I/O, state |
| **Imperative Shell** | Plugin loading | File system access, dynamic loading |
| **Imperative Shell** | Persistence API | Variable storage, side effects |

### 4.2 Implementation Guidance

The document should explicitly state that plugin functions, once registered, become part of the pure evaluation context. The QuickJS VM itself is part of the imperative shell, but the functions it registers are pure.

**Suggested Addition**:
```markdown
### Architecture Note: Plugin Functions in Core

Plugin-registered functions (`registerFunction`) become part of the pure functional core.
Once registered, they are called during expression evaluation without side effects.
The plugin loading mechanism (QuickJS VM) is part of the imperative shell.
```

---

## 5. Bun Compatibility Assessment

### 5.1 QuickJS with Bun

**Status**: COMPATIBLE with Caveats

The document does not explicitly address Bun compatibility. Research shows:

| Aspect | Compatibility |
|--------|---------------|
| quickjs-emscripten | Works with Bun (WASM-based) |
| Native modules | Not required for QuickJS |
| Single binary | Bun's `--compile` includes WASM |

**Concern**: The `quickjs-emscripten` package uses Emscripten-compiled WASM. Bun's WASM support is good but the document should verify this in a prototype.

**Recommendation**: Add to Phase 1 tasks:
```markdown
- [ ] Verify QuickJS + Bun compatibility with `bun --compile`
- [ ] Test single binary includes QuickJS WASM
```

### 5.2 Bundle Size with Bun

The document states ~500KB for QuickJS. With Bun's bundling:
- WASM is included as a base64 string or separate file
- May need to configure `bun.build` to handle WASM assets

---

## 6. Resource Limits Definition

### 6.1 Current State

The document proposes resource limits but they are not well-defined:

| Resource | Proposed | Assessment |
|----------|----------|------------|
| Execution time | "5 seconds" | Too high for calculator use |
| Memory | "128MB" | Reasonable upper bound |
| Call stack | Mentioned but no value | Needs limit |
| Loop iterations | Mentioned but no value | Needs limit |

### 6.2 Recommended Limits

For calculator use cases, suggest:

```typescript
const DEFAULT_LIMITS = {
  maxExecutionTimeMs: 1000,     // 1 second is plenty for math
  maxMemoryMB: 32,              // 32MB is generous for calculations
  maxCallStackDepth: 100,       // Prevent runaway recursion
  maxLoopIterations: 100000,    // Prevent infinite loops
  maxOpsPerExecution: 1000000,  // QuickJS instruction limit
};
```

---

## 7. Network Access Implications

### 7.1 Current Position

The document correctly states: "No host imports for network"

This aligns with `research.md` decision: "Math sandbox default, extensible to network access"

### 7.2 Future Considerations

If network access is needed later, the document should mention:
- Network access would require explicit user consent
- Whitelist-based URL access
- Request timeouts and size limits
- CORS considerations for fetched data

---

## 8. Specific Recommendations

### 8.1 Critical (Must Address)

None identified. The document is sound for implementation.

### 8.2 Important (Should Address)

1. **Add prototype pollution mitigation** to security recommendations
2. **Define concrete resource limits** (suggested values provided above)
3. **Add Bun compatibility verification** to Phase 1 tasks
4. **Clarify plugin dependencies** as Phase 2+ only

### 8.3 Minor (Nice to Have)

1. Add explicit architecture note about functional core alignment
2. Include QuickJS interrupt handler example code
3. Mention WASM asset handling in Bun build configuration

---

## 9. Blockers for Implementation

| Blocker | Status | Resolution |
|---------|--------|------------|
| Bun + QuickJS compatibility | None | Verify in prototype phase |
| Security audit of plugin API | None | Address recommendations above |
| Alignment with research.md | None | Confirmed aligned |

**Conclusion**: No blockers identified. Ready for implementation.

---

## 10. Approval Status

### DECISION: APPROVED

The research document is comprehensive, well-reasoned, and ready for implementation.

### Rationale:

1. **Two-tier approach is sound**: Expression functions for MVP, QuickJS for advanced scripting
2. **Security model is adequate**: Sandboxing via QuickJS addresses threat model
3. **Plugin API is extensible**: Clean design supports future enhancements
4. **Aligns with architecture**: Fits "Functional Core, Imperative Shell" pattern
5. **Bun compatible**: No identified blockers (verification recommended)

### Conditions:

- Address "Important" recommendations before or during implementation
- Verify Bun + QuickJS compatibility in early Phase 1
- Prototype resource limit enforcement

---

## 11. Action Items

| Priority | Action | Owner | Phase |
|----------|--------|-------|-------|
| High | Verify QuickJS works with `bun --compile` | Coder | Phase 1 |
| High | Implement concrete resource limits | Coder | Phase 1 |
| Medium | Add prototype pollution prevention | Coder | Phase 1 |
| Medium | Document functional core alignment | Coder | Phase 1 |
| Low | Defer plugin dependencies to Phase 2 | Planner | Planning |

---

## 12. Summary

| Category | Rating | Notes |
|----------|--------|-------|
| Completeness | 9/10 | Minor gaps in resource limits |
| Security | 9/10 | Add prototype pollution mitigation |
| Architecture Alignment | 10/10 | Fits functional core pattern |
| Bun Compatibility | 8/10 | Needs verification |
| Future Extensibility | 9/10 | Good API design |

**Final Verdict**: APPROVED for implementation with minor refinements.

---

*Review completed. Document provides a solid foundation for implementing extensibility in Calculathor.*
