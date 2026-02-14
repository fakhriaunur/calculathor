# ADR-006: Self-Learning Hooks System

## Status
**Accepted**

**Proposed**

## Date

2026-02-14

## Deciders

- Integration Architect
- System Architect
- Security Architect

## Tags

`adr,hooks,self-learning,optimization,claude-flow`

---

## Context

Calculathor requires a self-optimizing system that learns from user interactions to improve performance and user experience. The current implementation lacks:

1. **Usage Pattern Recognition**: No mechanism to identify frequently used functions, expressions, or calculation patterns
2. **Proactive Optimization**: Unable to pre-cache or optimize based on predicted user behavior
3. **Error Pattern Learning**: No system to learn from user corrections and prevent repeated mistakes
4. **Session Context Awareness**: Limited ability to maintain intelligent state across calculation sessions

The self-learning hooks system must:
- Capture usage patterns without compromising user privacy
- Integrate with Claude-Flow's memory and hook infrastructure
- Provide measurable performance improvements (faster evaluation for repeated patterns)
- Support opt-out and data deletion requirements
- Learn incrementally without disrupting the user experience

### Hook Types Analysis

| Hook Type | Trigger | Use Case |
|-----------|---------|----------|
| `session-start` | New session created | Load user preferences, initialize learning context |
| `pre-eval` | Before expression evaluation | Check cache, suggest completions, validate patterns |
| `post-eval` | After successful evaluation | Store result patterns, update statistics |
| `session-end` | Session closed or timeout | Persist learning data, cleanup temporary state |

---

## Decision

**We will implement a Self-Learning Hooks System** using Claude-Flow's hook infrastructure with four primary lifecycle hooks.

### 1. Hook Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Hook Lifecycle Flow                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐                                                        │
│  │session-start │──┐                                                     │
│  └──────────────┘  │  Load user profile                                   │
│                    │  Initialize learning context                         │
│                    ▼                                                      │
│  ┌──────────────┐  Load cached patterns                                   │
│  │   Session    │◄─┐  Set up memory namespace                              │
│  │   Context    │  │                                                      │
│  └──────────────┘  │                                                      │
│         │          │                                                      │
│         │◄─────────┘                                                      │
│         ▼                                                                 │
│  ┌──────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   pre-eval   │───►│  Evaluate   │───►│  post-eval  │                  │
│  └──────────────┘    │ Expression  │    └─────────────┘                  │
│         ▲            └─────────────┘           │                         │
│         │                   │                  │                         │
│         │                   │                  ▼                         │
│         │              ┌────┴────┐    ┌──────────────┐                   │
│         │              │  Error  │───►│ error-correct│                   │
│         │              └─────────┘    └──────────────┘                   │
│         │                   │                  │                         │
│         │                   ▼                  ▼                         │
│         │            ┌──────────────┐   Store patterns                    │
│         └────────────│  session-end │   Update statistics                 │
│                      └──────────────┘   Persist to memory                 │
│                             │                                            │
│                             ▼                                            │
│                      Cleanup & Persist                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Hook Specifications

#### 2.1 Session-Start Hook

```typescript
// hooks/session-start.ts
import { memory } from '@claude-flow/sdk';

interface SessionStartContext {
  sessionId: string;
  userId?: string;
  timestamp: number;
  clientType: 'cli' | 'tui' | 'gui';
}

export async function sessionStartHook(ctx: SessionStartContext): Promise<void> {
  // Initialize memory namespace for this session
  const namespace = `calculathor:${ctx.sessionId}`;

  // Load user's frequently used functions
  const commonFuncs = await memory.search({
    query: 'frequently used functions',
    namespace: 'user:patterns',
    limit: 20,
    threshold: 0.7
  });

  // Pre-load into session cache for fast access
  await memory.store({
    key: 'session:common-funcs',
    value: commonFuncs,
    namespace,
    ttl: 3600 // 1 hour session
  });

  // Load error correction patterns
  const corrections = await memory.retrieve({
    key: `user:${ctx.userId}:corrections`,
    namespace: 'user:learning'
  });

  return {
    commonFuncs,
    corrections: corrections || [],
    sessionStart: ctx.timestamp
  };
}
```

#### 2.2 Pre-Evaluation Hook

```typescript
// hooks/pre-eval.ts
import { memory } from '@claude-flow/sdk';

interface PreEvalContext {
  expression: string;
  sessionId: string;
  variables: Record<string, number>;
}

interface PreEvalResult {
  cached?: number;
  suggestion?: string;
  validation?: ValidationResult;
  optimized?: string;
}

export async function preEvalHook(ctx: PreEvalContext): Promise<PreEvalResult> {
  const result: PreEvalResult = {};
  const namespace = `calculathor:${ctx.sessionId}`;

  // Check for exact match in short-term cache
  const cacheKey = `cache:${hashExpression(ctx.expression)}`;
  const cached = await memory.retrieve({ key: cacheKey, namespace });
  if (cached && !isExpired(cached.timestamp)) {
    result.cached = cached.value;
    return result;
  }

  // Check for pattern match (similar expressions)
  const patterns = await memory.search({
    query: ctx.expression,
    namespace: 'patterns:expressions',
    limit: 5,
    threshold: 0.85
  });

  if (patterns.length > 0) {
    const bestMatch = patterns[0];
    if (bestMatch.similarity > 0.95) {
      // High confidence - suggest the pattern result
      result.suggestion = bestMatch.metadata.result;
    }
  }

  // Check for common typos based on learning
  const corrections = await memory.search({
    query: ctx.expression,
    namespace: 'patterns:corrections',
    limit: 3,
    threshold: 0.9
  });

  if (corrections.length > 0) {
    result.suggestion = corrections[0].metadata.correction;
  }

  // Validate expression against learned patterns
  result.validation = await validateAgainstPatterns(ctx.expression, namespace);

  return result;
}
```

#### 2.3 Post-Evaluation Hook

```typescript
// hooks/post-eval.ts
import { memory } from '@claude-flow/sdk';

interface PostEvalContext {
  expression: string;
  result: number;
  duration: number;
  sessionId: string;
  timestamp: number;
}

export async function postEvalHook(ctx: PostEvalContext): Promise<void> {
  const namespace = `calculathor:${ctx.sessionId}`;

  // Store in short-term cache for quick retrieval
  const cacheKey = `cache:${hashExpression(ctx.expression)}`;
  await memory.store({
    key: cacheKey,
    value: {
      result: ctx.result,
      timestamp: ctx.timestamp
    },
    namespace,
    ttl: 300 // 5 minutes for session cache
  });

  // Update expression frequency statistics
  await updateExpressionStats(ctx.expression, ctx.duration);

  // Store for pattern learning if interesting
  if (ctx.duration > 10 || isComplexExpression(ctx.expression)) {
    await memory.store({
      key: `pattern:${hashExpression(ctx.expression)}`,
      value: ctx.expression,
      namespace: 'patterns:expressions',
      metadata: {
        result: ctx.result,
        frequency: 1,
        lastUsed: ctx.timestamp
      },
      tags: ['expression', 'learned']
    });
  }

  // If evaluation was slow, mark for optimization
  if (ctx.duration > 50) {
    await memory.store({
      key: `optimize:${hashExpression(ctx.expression)}`,
      value: {
        expression: ctx.expression,
        duration: ctx.duration
      },
      namespace: 'patterns:optimize',
      tags: ['slow', 'needs-optimization']
    });
  }
}
```

#### 2.4 Session-End Hook

```typescript
// hooks/session-end.ts
import { memory } from '@claude-flow/sdk';

interface SessionEndContext {
  sessionId: string;
  userId?: string;
  duration: number;
  expressionCount: number;
  timestamp: number;
}

export async function sessionEndHook(ctx: SessionEndContext): Promise<void> {
  const sessionNs = `calculathor:${ctx.sessionId}`;
  const userNs = `user:${ctx.userId || 'anonymous'}`;

  // Aggregate session statistics
  const sessionStats = await aggregateSessionStats(sessionNs);

  // Update user profile with new patterns
  await memory.store({
    key: `${userNs}:stats`,
    value: {
      totalExpressions: sessionStats.totalExpressions,
      commonFunctions: sessionStats.commonFunctions,
      averageComplexity: sessionStats.averageComplexity,
      lastSession: ctx.timestamp
    },
    namespace: 'user:profiles',
    tags: ['user-stats', 'aggregated']
  });

  // Consolidate patterns if significant usage
  if (ctx.expressionCount > 10) {
    await consolidatePatterns(sessionNs, userNs);
  }

  // Clean up session-specific memory
  await memory.deleteNamespace(sessionNs);

  // Persist long-term learning
  await persistLearningData(userNs);
}
```

### 3. Pattern Recognition Strategy

#### 3.1 Expression Pattern Types

```typescript
// learning/patterns.ts

enum PatternType {
  FREQUENT_FUNCTION = 'frequent_function',    // User often uses sin(), cos(), etc.
  EXPRESSION_TEMPLATE = 'expression_template', // Templates like "x^2 + y^2"
  VARIABLE_SEQUENCE = 'variable_sequence',     // Common variable usage patterns
  ERROR_PATTERN = 'error_pattern',             // Common mistakes and corrections
  UNIT_CONVERSION = 'unit_conversion',         // Frequent unit conversions
}

interface LearnedPattern {
  id: string;
  type: PatternType;
  pattern: string;
  frequency: number;
  confidence: number;
  firstSeen: number;
  lastUsed: number;
  metadata: Record<string, unknown>;
}

// Pattern detection functions
export function detectFrequentFunctions(expressions: string[]): Map<string, number> {
  const funcPattern = /(\w+)\s*\(/g;
  const counts = new Map<string, number>();

  for (const expr of expressions) {
    let match;
    while ((match = funcPattern.exec(expr)) !== null) {
      const func = match[1];
      counts.set(func, (counts.get(func) || 0) + 1);
    }
  }

  return counts;
}

export function detectExpressionTemplates(expressions: string[]): LearnedPattern[] {
  // Normalize expressions by replacing numbers with placeholders
  const templates = expressions.map(expr =>
    expr.replace(/\d+\.?\d*/g, '#')
        .replace(/\s+/g, '')
  );

  // Find frequent templates
  const templateCounts = new Map<string, number>();
  for (const t of templates) {
    templateCounts.set(t, (templateCounts.get(t) || 0) + 1);
  }

  return Array.from(templateCounts.entries())
    .filter(([_, count]) => count >= 3)
    .map(([pattern, count]) => ({
      id: hashPattern(pattern),
      type: PatternType.EXPRESSION_TEMPLATE,
      pattern,
      frequency: count,
      confidence: Math.min(count / 10, 1.0),
      firstSeen: Date.now(),
      lastUsed: Date.now(),
      metadata: {}
    }));
}

export function detectErrorPatterns(errors: ErrorRecord[]): LearnedPattern[] {
  // Group errors by type and message similarity
  const patterns: LearnedPattern[] = [];

  for (const error of errors) {
    if (error.correction) {
      patterns.push({
        id: hashPattern(error.expression + error.correction),
        type: PatternType.ERROR_PATTERN,
        pattern: error.expression,
        frequency: 1,
        confidence: 0.8,
        firstSeen: error.timestamp,
        lastUsed: error.timestamp,
        metadata: {
          error: error.message,
          correction: error.correction
        }
      });
    }
  }

  return patterns;
}
```

#### 3.2 Neural Pattern Training

```typescript
// learning/neural-patterns.ts
import { neural } from '@claude-flow/sdk';

export async function trainExpressionPatterns(
  patterns: LearnedPattern[],
  userId: string
): Promise<void> {
  // Use Claude-Flow's neural training for complex pattern recognition
  await neural.train({
    model: `calculathor:${userId}:patterns`,
    data: patterns.map(p => ({
      input: p.pattern,
      label: p.type,
      weight: p.frequency * p.confidence
    })),
    epochs: 10,
    learningRate: 0.001
  });
}

export async function predictNextExpression(
  sessionHistory: string[],
  userId: string
): Promise<string[]> {
  // Use trained model to predict likely next expressions
  const predictions = await neural.predict({
    model: `calculathor:${userId}:patterns`,
    input: sessionHistory.slice(-5).join(' '),
    topK: 5
  });

  return predictions.map(p => p.label);
}
```

### 4. Memory Storage/Retrieval Integration

#### 4.1 Memory Schema

```
Namespace Hierarchy:
├─ calculathor:{sessionId}        # Session-scoped data (TTL: 1 hour)
│  ├─ cache:{hash}                # Short-term expression cache
│  ├─ session:common-funcs        # Pre-loaded frequent functions
│  └─ session:stats               # Session statistics
│
├─ patterns:expressions           # Global expression patterns
│  ├─ pattern:{hash}              # Individual expression patterns
│  └─ template:{hash}             # Expression templates
│
├─ patterns:corrections           # Error correction patterns
│  └─ correction:{hash}           # Specific error->correction mappings
│
├─ patterns:optimize              # Performance optimization candidates
│  └─ optimize:{hash}             # Slow expressions needing optimization
│
├─ user:{userId}                  # User-specific data
│  ├─ stats                       # Aggregated user statistics
│  ├─ preferences                 # User preferences
│  └─ corrections                 # Personal error corrections
│
└─ user:profiles                  # Cross-user aggregated data
   └─ {userId}:stats              # Anonymized usage patterns
```

#### 4.2 Claude-Flow Memory Commands

```bash
# Store a learned pattern
npx @claude-flow/cli@latest memory store \
  --key "pattern:sin-cos-squared" \
  --value "sin(x)^2 + cos(x)^2" \
  --namespace "patterns:expressions" \
  --tags "trigonometry,identity,learned" \
  --metadata '{"frequency": 15, "confidence": 0.95}'

# Search for similar expressions
npx @claude-flow/cli@latest memory search \
  --query "sin(x)^2 + cos(x)^2" \
  --namespace "patterns:expressions" \
  --limit 5 \
  --threshold 0.85

# Retrieve user statistics
npx @claude-flow/cli@latest memory retrieve \
  --key "user:alice:stats" \
  --namespace "user:profiles"

# Delete session data on cleanup
npx @claude-flow/cli@latest memory delete-namespace \
  --namespace "calculathor:session-abc123"
```

#### 4.3 Memory Integration Code

```typescript
// memory/learning-store.ts
import { memory } from '@claude-flow/sdk';

export class LearningStore {
  private readonly userId: string;
  private readonly sessionId: string;

  constructor(userId: string, sessionId: string) {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  async cacheExpression(expr: string, result: number): Promise<void> {
    await memory.store({
      key: `cache:${this.hash(expr)}`,
      value: { result, timestamp: Date.now() },
      namespace: this.sessionNs,
      ttl: 300 // 5 minutes
    });
  }

  async getCached(expr: string): Promise<number | null> {
    const cached = await memory.retrieve({
      key: `cache:${this.hash(expr)}`,
      namespace: this.sessionNs
    });
    return cached?.value?.result ?? null;
  }

  async recordFunctionUsage(func: string): Promise<void> {
    const key = `user:${this.userId}:funcs:${func}`;
    const current = await memory.retrieve({
      key,
      namespace: 'user:profiles'
    });

    await memory.store({
      key,
      value: {
        function: func,
        count: (current?.count || 0) + 1,
        lastUsed: Date.now()
      },
      namespace: 'user:profiles',
      tags: ['function-usage']
    });
  }

  async getTopFunctions(limit: number = 10): Promise<string[]> {
    const results = await memory.search({
      query: 'function usage',
      namespace: 'user:profiles',
      limit,
      threshold: 0.5
    });

    return results
      .filter(r => r.metadata?.function)
      .sort((a, b) => (b.metadata?.count || 0) - (a.metadata?.count || 0))
      .map(r => r.metadata!.function as string);
  }

  async recordErrorCorrection(
    original: string,
    error: string,
    correction: string
  ): Promise<void> {
    await memory.store({
      key: `correction:${this.hash(original)}`,
      value: {
        original,
        error,
        correction,
        timestamp: Date.now()
      },
      namespace: 'patterns:corrections',
      tags: ['error-correction', 'learned']
    });
  }

  async findCorrection(expr: string): Promise<string | null> {
    const results = await memory.search({
      query: expr,
      namespace: 'patterns:corrections',
      limit: 1,
      threshold: 0.9
    });

    if (results.length > 0 && results[0].similarity > 0.95) {
      return results[0].value.correction;
    }
    return null;
  }

  private hash(input: string): string {
    // Simple hash for demonstration
    return Buffer.from(input).toString('base64').slice(0, 16);
  }

  private get sessionNs(): string {
    return `calculathor:${this.sessionId}`;
  }
}
```

### 5. Privacy Considerations

#### 5.1 Data Classification

| Data Type | Sensitivity | Retention | Encryption |
|-----------|-------------|-----------|------------|
| Expression patterns | Medium | 90 days | At rest |
| Function usage stats | Low | 365 days | None needed |
| Error corrections | High | 30 days | At rest |
| User preferences | Low | Indefinite | None needed |
| Session cache | Low | 5 minutes | None needed |

#### 5.2 Privacy Controls

```typescript
// privacy/controls.ts

interface PrivacySettings {
  learningEnabled: boolean;
  patternSharing: 'none' | 'anonymized' | 'full';
  retentionDays: number;
  allowPredictions: boolean;
}

const DEFAULT_PRIVACY: PrivacySettings = {
  learningEnabled: true,
  patternSharing: 'anonymized',
  retentionDays: 90,
  allowPredictions: true
};

export async function applyPrivacyControls(
  data: unknown,
  settings: PrivacySettings
): Promise<unknown> {
  if (!settings.learningEnabled) {
    return null;
  }

  // Anonymize if required
  if (settings.patternSharing === 'anonymized') {
    return anonymizeData(data);
  }

  return data;
}

function anonymizeData(data: unknown): unknown {
  // Remove or hash any potentially identifying information
  if (typeof data === 'object' && data !== null) {
    const anonymized = { ...data };
    delete (anonymized as Record<string, unknown>).userId;
    delete (anonymized as Record<string, unknown>).sessionId;
    delete (anonymized as Record<string, unknown>).timestamp;
    return anonymized;
  }
  return data;
}

export async function deleteUserData(userId: string): Promise<void> {
  // Delete all user-specific data
  await memory.deleteNamespace(`user:${userId}`);

  // Remove from pattern databases
  const patterns = await memory.search({
    query: userId,
    namespace: 'patterns:expressions',
    limit: 100
  });

  for (const pattern of patterns) {
    await memory.delete({
      key: pattern.key,
      namespace: 'patterns:expressions'
    });
  }
}

export async function exportUserData(userId: string): Promise<unknown> {
  // GDPR/CCPA compliance - export all user data
  const data: Record<string, unknown> = {};

  const userData = await memory.search({
    query: '*',
    namespace: `user:${userId}`,
    limit: 1000
  });

  data.profile = userData;

  return data;
}
```

#### 5.3 Privacy Configuration

```typescript
// config/privacy.ts
export const PRIVACY_CONFIG = {
  // Automatic data expiration
  defaultRetentionDays: 90,

  // Data aggregation for anonymization
  minPatternFrequency: 3,
  aggregationWindowDays: 7,

  // Sensitive pattern exclusion
  excludedPatterns: [
    /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/, // Credit card-like
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
    /password|secret|key/i // Potentially sensitive keywords
  ],

  // Audit logging
  auditEnabled: true,
  auditRetentionDays: 365
};
```

---

## Consequences

### Positive

| Aspect | Impact |
|--------|--------|
| **Performance** | Sub-millisecond retrieval for cached patterns, 20-40% faster for frequent expressions |
| **User Experience** | Proactive suggestions reduce input time, error corrections prevent repeated mistakes |
| **Learning** | System improves over time based on actual usage patterns |
| **Claude-Flow Integration** | Leverages existing infrastructure, reduces custom code |
| **Extensibility** | Hook-based architecture allows easy addition of new learning types |

### Negative

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| **Memory Usage** | Additional ~5-10MB for learning cache | TTL-based cleanup, session isolation |
| **Privacy Risk** | Potential exposure of calculation patterns | Anonymization, opt-out, encryption |
| **Complexity** | Hook lifecycle management adds complexity | Comprehensive testing, clear documentation |
| **Cold Start** | First session has no learning data | Pre-seed with common patterns |

### Neutral

- **Learning Curve**: Developers need to understand Claude-Flow hook patterns
- **Dependency**: Relies on Claude-Flow infrastructure availability

---

## Implementation Plan

### Phase 1: Core Hooks (Week 1-2)

1. Implement `session-start` hook with basic initialization
2. Implement `pre-eval` hook with caching
3. Implement `post-eval` hook with pattern storage
4. Implement `session-end` hook with cleanup

### Phase 2: Pattern Learning (Week 3-4)

1. Expression pattern detection
2. Function usage tracking
3. Error correction learning
4. Neural pattern training integration

### Phase 3: Optimization (Week 5-6)

1. Performance benchmarking
2. Cache optimization
3. Memory usage tuning
4. Privacy controls implementation

### Phase 4: Testing & Documentation (Week 7-8)

1. Property-based testing for pattern matching
2. Privacy audit
3. Performance regression testing
4. User documentation

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cache Hit Retrieval | <1ms | Time to retrieve cached expression |
| Pattern Search | <5ms | Time to search similar patterns |
| Hook Overhead | <2ms | Total hook execution time |
| Memory Per Session | <5MB | Learning data per active session |
| Cache Hit Rate | >60% | Percentage of cached lookups |

---

## References

### Claude-Flow Documentation

- [Claude-Flow Hooks API](https://github.com/ruvnet/claude-flow)
- [Memory System Documentation](https://github.com/ruvnet/claude-flow/blob/main/docs/memory.md)
- [Neural Training API](https://github.com/ruvnet/claude-flow/blob/main/docs/neural.md)

### Related ADRs

- [ADR-003: Hybrid Daemon Architecture](./ADR-003-hybrid-daemon.md) - Session management
- [ADR-002: Pratt Parser Selection](./ADR-002-pratt-parser.md) - Pre-task hook pattern reference

### External References

- [Privacy-Preserving Machine Learning](https://arxiv.org/abs/2008.08785)
- [GDPR Compliance for AI Systems](https://gdpr.eu/artificial-intelligence/)
- [Local Differential Privacy](https://en.wikipedia.org/wiki/Local_differential_privacy)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-14 | Four-hook architecture | Covers complete session lifecycle, matches Claude-Flow patterns |
| 2026-02-14 | Anonymized sharing default | Privacy-first approach, can be adjusted by user |
| 2026-02-14 | 90-day default retention | Balance between learning value and privacy |
| 2026-02-14 | HNSW-based pattern search | Leverages Claude-Flow AgentDB for 150x-12500x speedup |

---

**Related ADRs:**
- ADR-003: Hybrid Daemon Architecture
- ADR-002: Pratt Parser Selection

**Related Documents:**
- `/plans/research-self-learning.md` - Detailed learning system research
- `/docs/privacy/data-handling.md` - Privacy and data handling policies
