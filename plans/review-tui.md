# Code Review: TUI Framework Research Plan

> **Review Date**: 2026-02-14
> **Reviewer**: Code Review Agent
> **Document Reviewed**: `/plans/research-tui.md`
> **Related Document**: `/plans/research.md`

---

## Executive Summary

**Status**: APPROVED with minor recommendations

The TUI framework research plan is thorough, well-reasoned, and aligns excellently with Calculathor's project goals. The recommendation of **Ink 5.x** is justified and appropriate for the TUI-first MVP approach.

---

## 1. Strengths

### 1.1 Comprehensive Framework Evaluation
- All four viable options (Ink, Blessed, Node-pty, Bubble Tea) were evaluated against consistent criteria
- Each option includes realistic pros/cons with concrete impact assessments
- Decision matrix is transparent and data-driven

### 1.2 Alignment with Project Constraints
- **Bun compatibility**: Ink is confirmed to work with Bun (React 18+ support)
- **TypeScript first-class**: Ink provides excellent type definitions
- **Single binary**: Bundle size (~180KB) is acceptable for distribution
- **Performance targets**: ~80ms startup comfortably meets <100ms requirement

### 1.3 Architecture Considerations
- Properly positions TUI as the "Imperative Shell" in the Functional Core/Imperative Shell pattern
- Demonstrates clear separation between engine (functional) and TUI (side effects)
- Component architecture follows React best practices

### 1.4 Practical Code Examples
- Sample implementations for InputPanel, ResultsPanel, HistorySidebar are realistic
- Syntax highlighting approach integrates well with planned tokenizer
- Terminal resize handling is addressed

---

## 2. Specific Concerns

### 2.1 Bun + React Compatibility (Minor)
**Concern**: While Ink works with Bun, the React reconciliation layer adds overhead.

**Evidence**:
- Bun's React support is stable but still maturing
- React's concurrent features may behave differently vs Node.js

**Mitigation**: The plan addresses this with performance benchmarks as a next step.

### 2.2 Terminal Compatibility (Medium)
**Concern**: Cross-platform terminal behavior is mentioned but not deeply analyzed.

**Gaps**:
- Windows CMD/PowerShell compatibility details absent
- Terminal capability detection (256 colors, unicode) not addressed
- No mention of fallback strategies for limited terminals

**Recommendation**: Add testing matrix for Windows Terminal, iTerm2, gnome-terminal, kitty.

### 2.3 Accessibility (Medium)
**Concern**: Screen reader support is not mentioned.

**Issue**:
- Terminal applications should work with screen readers (NVDA, JAWS, VoiceOver)
- Ink provides basic accessibility but custom components may break it
- No mention of aria-label equivalents for calculator output

**Recommendation**: Document accessibility requirements and test with screen readers.

### 2.4 Bundle Size Breakdown (Minor)
**Concern**: The 180KB figure may be optimistic.

**Actual dependencies to account for**:
```
ink: ~150KB (core + yoga-layout)
react: ~40KB (react + react-reconciler)
ink-text-input: ~10KB
@types/react: dev only
```

**Realistic total**: ~200KB gzipped, still well within acceptable bounds.

---

## 3. Alignment Assessment

### 3.1 Functional Core, Imperative Shell
**Rating**: Strong alignment

The plan correctly identifies:
| Layer | Components | Side Effects |
|-------|------------|--------------|
| **Functional Core** | Parser, Evaluator, Registry | None (pure functions) |
| **Imperative Shell** | TUI (Ink), CLI, Store | Terminal I/O, persistence |

**Concern**: The example `handleSubmit` callback in App.tsx shows direct evaluation:
```typescript
const result = evaluate(expression); // Should be via JSON-RPC
```
This should be clarified as a simplified example vs actual implementation.

### 3.2 Performance Targets
**Rating**: Meets targets

| Target | Claimed | Status |
|--------|---------|--------|
| Startup <100ms | ~80ms | Met |
| 60fps rendering | ~16ms frame time | Met |
| Memory <10MB | Not specified | Need benchmark |

**Gap**: Memory usage estimation missing. Ink + React may use 20-30MB at runtime.

### 3.3 Multi-Client Architecture
**Rating**: Needs clarification

The research.md specifies a daemon + JSON-RPC architecture, but research-tui.md shows direct engine imports:
```typescript
import { tokenize } from '../engine/tokenizer';
```

**Recommendation**: Clarify the integration approach:
- **Phase 1 (Tracer 1-2)**: Direct import acceptable for rapid prototyping
- **Phase 2 (Tracer 3+)**: Must switch to JSON-RPC via IPC

---

## 4. Component Architecture Review

### 4.1 Structure Assessment
```
src/tui/
├── App.tsx              # Root - good
├── components/
│   ├── InputPanel.tsx   # Syntax-highlighted input
│   ├── ResultsPanel.tsx # Output display
│   ├── HistorySidebar.tsx
│   ├── VariableExplorer.tsx
│   └── StatusBar.tsx
├── hooks/
│   ├── useTerminalSize.ts
│   ├── useHistory.ts
│   └── useKeyboard.ts
└── index.tsx            # Entry point
```

**Strengths**:
- Clear separation of concerns
- Custom hooks for reusable logic
- Component naming follows conventions

**Suggestions**:
1. Add `components/common/` for shared primitives (Button, ScrollArea)
2. Consider `context/` for engine connection state
3. Add `themes/` for color scheme management

### 4.2 Input Component Complexity
**Concern**: The InputPanel example is simplified.

**Missing considerations**:
- Cursor positioning with syntax-highlighted text
- Multi-line input support (for function definitions)
- Copy/paste handling
- Unicode input (e.g., math symbols)

**Recommendation**: Consider forking `ink-text-input` for full cursor control.

---

## 5. Dependencies Analysis

### 5.1 Production Dependencies
```json
{
  "ink": "^5.0.0",           // Core TUI framework
  "react": "^18.2.0",        // Peer dependency
  "ink-text-input": "^6.0.0" // Input component
}
```

**Assessment**:
- Minimal and focused dependency tree
- All packages actively maintained
- No known security vulnerabilities in recent versions

### 5.2 Bun-Specific Considerations
- React 18 works with Bun's JSX transform
- Need to verify `ink-text-input` compatibility
- Consider using `bun:sqlite` for persistence (already planned)

---

## 6. Risk Assessment Update

| Risk | Severity | Likelihood | Plan Coverage |
|------|----------|------------|---------------|
| Ink performance with large history | Medium | Low | Partial - virtualization mentioned |
| Terminal compatibility issues | Medium | Medium | Insufficient - needs testing matrix |
| React/Bun edge cases | Low | Low | Not addressed |
| Accessibility (screen readers) | Medium | Medium | Not addressed |
| Bundle size growth | Low | Low | Adequate |

---

## 7. Recommendations

### 7.1 Must Address Before Implementation
1. **Clarify architecture phase boundaries**
   - Document when to switch from direct imports to JSON-RPC
   - Add ADR (Architecture Decision Record) for this transition

2. **Add terminal compatibility testing matrix**
   - Windows: Terminal, PowerShell, CMD
   - macOS: iTerm2, Terminal.app
   - Linux: gnome-terminal, kitty, alacritty

### 7.2 Should Address
3. **Document accessibility approach**
   - Test with screen readers
   - Consider adding audio output option for results

4. **Add memory benchmark to next steps**
   - Measure actual runtime memory usage
   - Set limits for history size to prevent bloat

5. **Consider theme/colors system**
   - Support for light/dark terminal backgrounds
   - Configurable color schemes

### 7.3 Nice to Have
6. **Explore alternative input handling**
   - Consider `ink` + `node-readline` for better history/editing
   - Evaluate multi-line input UX

7. **Add graceful degradation**
   - Fallback to simple CLI if terminal doesn't support required features

---

## 8. Approval Status

### APPROVED

The research plan is comprehensive and the Ink 5.x recommendation is sound. The concerns identified are minor and can be addressed during implementation.

### Blockers: None

### Conditions for Proceeding:
1. Add terminal compatibility testing to Phase 2 tasks
2. Clarify the direct-import vs JSON-RPC transition plan
3. Document accessibility testing requirements

---

## 9. Action Items for Implementation

- [ ] Create terminal compatibility test script
- [ ] Set up accessibility testing environment
- [ ] Add memory usage benchmarks to tracer bullets
- [ ] Document color theme requirements
- [ ] Verify `ink-text-input` works with Bun
- [ ] Create ADR for JSON-RPC transition point

---

## 10. Cross-Reference Check

| research.md Decision | research-tui.md Alignment | Status |
|---------------------|---------------------------|--------|
| Bun runtime | Uses Bun-compatible packages | Aligned |
| Single binary | Bundle size considered | Aligned |
| TUI-first MVP | Primary focus | Aligned |
| <100ms startup | ~80ms claimed | Aligned |
| Functional Core | TUI as Imperative Shell | Aligned |
| JSON-RPC protocol | Direct import in examples | Needs clarification |
| <10MB memory | Not quantified | Gap identified |

---

**Review Complete**: The plan is ready for implementation with minor clarifications noted above.
