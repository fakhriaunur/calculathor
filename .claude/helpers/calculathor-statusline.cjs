#!/usr/bin/env node
/**
 * Calculathor Project Statusline
 * Displays DDD contexts, ADRs, hooks, and project-specific metrics
 *
 * Usage: node calculathor-statusline.cjs [--json] [--compact]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[0;33m',
  blue: '\x1b[0;34m',
  purple: '\x1b[0;35m',
  cyan: '\x1b[0;36m',
  brightRed: '\x1b[1;31m',
  brightGreen: '\x1b[1;32m',
  brightYellow: '\x1b[1;33m',
  brightBlue: '\x1b[1;34m',
  brightPurple: '\x1b[1;35m',
  brightCyan: '\x1b[1;36m',
  brightWhite: '\x1b[1;37m',
};

// Get user info
function getUserInfo() {
  let name = 'user';
  let gitBranch = '';
  try {
    name = execSync('git config user.name 2>/dev/null || echo "user"', { encoding: 'utf-8' }).trim();
    gitBranch = execSync('git branch --show-current 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();
  } catch (e) {}
  return { name, gitBranch };
}

// Get DDD Bounded Context status
function getDDDStatus() {
  const dddPath = path.join(process.cwd(), 'docs', 'ddd');
  const docsPath = path.join(process.cwd(), 'docs');

  // Auto-discover bounded contexts from ddd folder (DDD-XXX-*.md pattern)
  let contextFiles = [];
  if (fs.existsSync(dddPath)) {
    try {
      const files = fs.readdirSync(dddPath)
        .filter(f => f.endsWith('.md') && f.match(/^DDD-\d{3}/))
        .sort(); // Sort to maintain order (DDD-001, DDD-002, etc.)

      contextFiles = files.map(f => {
        const match = f.match(/^DDD-(\d{3})-(.+)\.md$/);
        const num = match ? match[1] : '000';
        const name = match ? match[2].replace(/-/g, ' ') : f.replace('.md', '');
        const icon = name.includes('core') ? '🔧' :
                     name.includes('persist') ? '💾' :
                     name.includes('transport') ? '📡' : '📄';
        return { name: `DDD-${num}`, file: f, icon, num };
      });
    } catch (e) {}
  }

  // Fallback to known contexts if folder empty
  if (contextFiles.length === 0) {
    contextFiles = [
      { name: 'DDD-001', file: 'DDD-001-core-domain.md', icon: '🔧', num: '001' },
      { name: 'DDD-002', file: 'DDD-002-persistence-context.md', icon: '💾', num: '002' },
      { name: 'DDD-003', file: 'DDD-003-transport-context.md', icon: '📡', num: '003' },
    ];
  }

  const contexts = [];
  for (const ctx of contextFiles) {
    const filePath = path.join(dddPath, ctx.file);
    const exists = fs.existsSync(filePath);
    // Only IMPLEMENTED counts as complete
    const status = 'DOCUMENTED'; // Exists but not yet implemented
    contexts.push({
      name: ctx.name,
      icon: ctx.icon,
      exists,
      size: exists ? fs.statSync(filePath).size : 0,
      num: ctx.num,
      status,
    });
  }

  // Check implementation plan in docs root (not in ddd folder)
  const implPlanFile = 'DDD-implementation-plan.md';
  const implPath = path.join(docsPath, implPlanFile);
  const implExists = fs.existsSync(implPath);

  // Only count as completed if fully implemented (not just documented)
  const completed = 0;
  return { contexts, completed, total: contexts.length, implPlan: { exists: implExists, icon: '📋' } };
}

// Get ADR status
function getADRStatus() {
  const adrPath = path.join(process.cwd(), 'docs', 'adr');
  const adrs = [];

  const adrFiles = [
    { id: '001', name: 'Bun Runtime', file: 'ADR-001-bun-runtime.md' },
    { id: '002', name: 'Pratt Parser', file: 'ADR-002-pratt-parser.md' },
    { id: '003', name: 'Hybrid Daemon', file: 'ADR-003-hybrid-daemon.md' },
    { id: '004', name: 'Ink TUI', file: 'ADR-004-ink-tui.md' },
    { id: '005', name: 'Plugin Security', file: 'ADR-005-plugin-security.md' },
    { id: '006', name: 'Hooks System', file: 'ADR-006-hooks-system.md' },
  ];

  for (const adr of adrFiles) {
    const filePath = path.join(adrPath, adr.file);
    const exists = fs.existsSync(filePath);
    let status = 'PENDING';

    if (exists) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Only IMPLEMENTED counts as complete (not just Accepted)
        if (content.includes('Status: Implemented') || content.includes('**Implemented**')) {
          status = 'IMPLEMENTED';
        } else if (content.includes('Status: Accepted') || content.includes('**Accepted**')) {
          status = 'ACCEPTED';
        } else if (content.includes('Status: Proposed') || content.includes('**Proposed**')) {
          status = 'PROPOSED';
        }
      } catch (e) {}
    }

    adrs.push({ ...adr, exists, status });
  }

  // Only count IMPLEMENTED as completed (not just ACCEPTED)
  const completed = adrs.filter(a => a.status === 'IMPLEMENTED').length;
  return { adrs, completed, total: adrFiles.length };
}

// Get available hooks
function getHooksStatus() {
  const helpersPath = path.join(process.cwd(), '.claude', 'helpers');
  const hooks = [];

  const hookFiles = [
    { name: 'hook-handler', file: 'hook-handler.cjs', type: 'core' },
    { name: 'learning-hooks', file: 'learning-hooks.sh', type: 'learning' },
    { name: 'auto-memory', file: 'auto-memory-hook.mjs', type: 'memory' },
    { name: 'guidance', file: 'guidance-hooks.sh', type: 'guidance' },
    { name: 'swarm-hooks', file: 'swarm-hooks.sh', type: 'swarm' },
    { name: 'session', file: 'session.cjs', type: 'session' },
    { name: 'intelligence', file: 'intelligence.cjs', type: 'intelligence' },
    { name: 'memory', file: 'memory.cjs', type: 'memory' },
  ];

  for (const hook of hookFiles) {
    const filePath = path.join(helpersPath, hook.file);
    hooks.push({
      name: hook.name,
      type: hook.type,
      exists: fs.existsSync(filePath),
    });
  }

  const enabled = hooks.filter(h => h.exists).length;
  return { hooks, enabled, total: hookFiles.length };
}

// Get helper tools status
function getHelpersStatus() {
  const helpersPath = path.join(process.cwd(), '.claude', 'helpers');
  const helpers = [];

  const helperCategories = {
    security: ['security-scanner.sh', 'adr-compliance.sh'],
    performance: ['perf-worker.sh', 'learning-optimizer.sh', 'metrics-db.mjs'],
    devops: ['daemon-manager.sh', 'health-monitor.sh', 'checkpoint-manager.sh'],
    github: ['github-setup.sh', 'github-safe.js', 'auto-commit.sh'],
    swarm: ['swarm-monitor.sh', 'swarm-comms.sh', 'worker-manager.sh'],
    ddd: ['ddd-tracker.sh'],
  };

  for (const [category, files] of Object.entries(helperCategories)) {
    for (const file of files) {
      const filePath = path.join(helpersPath, file);
      helpers.push({
        name: file.replace(/\.(sh|js|cjs|mjs)$/, ''),
        category,
        exists: fs.existsSync(filePath),
      });
    }
  }

  const enabled = helpers.filter(h => h.exists).length;
  const byCategory = {};
  for (const helper of helpers) {
    if (!byCategory[helper.category]) byCategory[helper.category] = { total: 0, enabled: 0 };
    byCategory[helper.category].total++;
    if (helper.exists) byCategory[helper.category].enabled++;
  }

  return { helpers, enabled, total: helpers.length, byCategory };
}

// Get research/planning status
function getResearchStatus() {
  const plansPath = path.join(process.cwd(), 'plans');
  const docsPath = path.join(process.cwd(), 'docs');

  const researchDocs = [
    'research.md',
    'research-parser.md',
    'research-architecture.md',
    'research-tui.md',
    'research-extensibility.md',
  ];

  const reviewDocs = [
    'review-parser.md',
    'review-architecture.md',
    'review-tui.md',
    'review-extensibility.md',
    'review-overall.md',
  ];

  let researchCompleted = 0;
  let reviewCompleted = 0;

  for (const doc of researchDocs) {
    if (fs.existsSync(path.join(plansPath, doc))) researchCompleted++;
  }

  for (const doc of reviewDocs) {
    if (fs.existsSync(path.join(plansPath, doc))) reviewCompleted++;
  }

  return {
    research: { completed: researchCompleted, total: researchDocs.length },
    review: { completed: reviewCompleted, total: reviewDocs.length },
  };
}

// Get tracer bullet status
function getTracerStatus() {
  // Reset - implementation not started (archived src doesn't count as implemented)
  const completedTracers = 0;

  return {
    completed: completedTracers,
    current: completedTracers + 1,
    total: 4,
    names: ['Core Math', 'TUI Layer', 'Daemon Arch', 'User Functions'],
  };
}

// Generate progress bar
function progressBar(current, total, width = 10) {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// Generate statusline
function generateStatusline() {
  const user = getUserInfo();
  const ddd = getDDDStatus();
  const adrs = getADRStatus();
  const hooks = getHooksStatus();
  const helpers = getHelpersStatus();
  const research = getResearchStatus();
  const tracer = getTracerStatus();
  const lines = [];

  // Header
  let header = `${c.bold}${c.brightPurple}▊ Calculathor ${c.reset}`;
  header += `${c.brightCyan}${user.name}${c.reset}`;
  if (user.gitBranch) {
    header += `  ${c.dim}│${c.reset}  ${c.brightBlue}⎇ ${user.gitBranch}${c.reset}`;
  }
  lines.push(header);
  lines.push(`${c.dim}────────────────────────────────────────────────────────${c.reset}`);

  // DDD Bounded Contexts - numbers only, similar to ADRs
  const dddColor = ddd.completed === ddd.total ? c.brightGreen : ddd.completed > 0 ? c.yellow : c.red;
  let dddLine = `${c.brightCyan}🏗️  DDD Contexts${c.reset}     ${dddColor}${ddd.completed}/${ddd.total}${c.reset}  `;
  for (const ctx of ddd.contexts) {
    const icon = ctx.status === 'IMPLEMENTED' ? '✓' : ctx.exists ? '○' : '·';
    const iconColor = ctx.status === 'IMPLEMENTED' ? c.brightGreen : ctx.exists ? c.yellow : c.dim;
    dddLine += `${iconColor}${ctx.num}${c.reset} `;
  }
  lines.push(dddLine);

  // ADRs - numbers only, no progress bar
  const adrColor = adrs.completed === adrs.total ? c.brightGreen : adrs.completed > 0 ? c.yellow : c.red;
  let adrLine = `${c.brightYellow}📋 ADRs${c.reset}            ${adrColor}${adrs.completed}/${adrs.total}${c.reset}  `;
  for (const adr of adrs.adrs) {
    const icon = adr.status === 'IMPLEMENTED' ? '✓' : adr.exists ? '○' : '·';
    const iconColor = adr.status === 'IMPLEMENTED' ? c.brightGreen : adr.exists ? c.yellow : c.dim;
    adrLine += `${iconColor}${adr.id}${c.reset} `;
  }
  lines.push(adrLine);

  // Hooks - numbers only
  const hooksColor = hooks.enabled === hooks.total ? c.brightGreen : hooks.enabled > 0 ? c.yellow : c.red;
  lines.push(
    `${c.brightPurple}🪝 Hooks${c.reset}            ${hooksColor}${hooks.enabled}/${hooks.total}${c.reset}`
  );

  // Helpers - numbers only
  const helpersColor = helpers.enabled === helpers.total ? c.brightGreen : helpers.enabled > 0 ? c.yellow : c.red;
  lines.push(
    `${c.brightBlue}🛠️  Helpers${c.reset}           ${helpersColor}${helpers.enabled}/${helpers.total}${c.reset}`
  );

  // Research & Reviews - numbers only
  lines.push(
    `${c.brightGreen}📚 Research${c.reset}         ${c.brightGreen}${research.research.completed}/${research.research.total}${c.reset}  ` +
    `${c.dim}│${c.reset}  ${c.cyan}Reviews${c.reset} ${c.brightGreen}${research.review.completed}/${research.review.total}${c.reset}`
  );

  // Tracer Bullets - numbers only
  const tracerColor = tracer.completed === tracer.total ? c.brightGreen : c.yellow;
  lines.push(
    `${c.brightCyan}🎯 Tracers${c.reset}          ${tracerColor}${tracer.completed}/${tracer.total}${c.reset}`
  );

  // Footer with key metrics
  lines.push(`${c.dim}────────────────────────────────────────────────────────${c.reset}`);
  const ready = ddd.completed === ddd.total && adrs.completed === adrs.total;
  const statusText = ready ? '✅ Ready for Implementation' : '📝 Design Phase';
  const statusColor = ready ? c.brightGreen : c.yellow;
  lines.push(`${statusColor}${statusText}${c.reset}`);

  return lines.join('\n');
}

// Generate JSON
function generateJSON() {
  return {
    user: getUserInfo(),
    ddd: getDDDStatus(),
    adrs: getADRStatus(),
    hooks: getHooksStatus(),
    helpers: getHelpersStatus(),
    research: getResearchStatus(),
    tracer: getTracerStatus(),
    lastUpdated: new Date().toISOString(),
  };
}

// Main
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(generateJSON(), null, 2));
} else if (process.argv.includes('--compact')) {
  console.log(JSON.stringify(generateJSON()));
} else {
  console.log(generateStatusline());
}
