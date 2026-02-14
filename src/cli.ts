#!/usr/bin/env bun
import { tokenize } from './parser/tokenizer.js';
import { parse } from './parser/pratt.js';
import { evaluate, createDefaultContext } from './evaluator/index.js';

const VERSION = '0.1.0';
const HELP_TEXT = `Calculathor - Expression Calculator

Usage:
  bun run cli "expression"     Evaluate expression from args
  echo "expr" | bun run cli    Evaluate expression from stdin
  bun run cli                  Start interactive REPL

Options:
  -h, --help     Show this help message
  -v, --version  Show version

Examples:
  bun run cli "2 + 3 * 4"
  bun run cli "sin(pi / 2)"
  bun run cli "sqrt(16) + log(e)"
`;

function calculate(expression: string): number {
  const tokens = tokenize(expression);
  const ast = parse(tokens);
  const context = createDefaultContext();
  return evaluate(ast, context);
}

function formatResult(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  if (Math.abs(value) > 1e6 || (Math.abs(value) < 1e-6 && value !== 0)) {
    return value.toExponential(6);
  }
  return parseFloat(value.toPrecision(12)).toString();
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}

function processExpression(expression: string): void {
  try {
    const result = calculate(expression);
    console.log(formatResult(result));
  } catch (error) {
    handleError(error);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString().trim();
}

async function runInteractive(): Promise<void> {
  console.log('Calculathor REPL (type "exit" or Ctrl+D to quit)');
  console.log();

  while (true) {
    const input = prompt('> ');
    if (input === null || input.trim() === 'exit') {
      break;
    }
    const trimmed = input.trim();
    if (trimmed === '') continue;

    try {
      const result = calculate(trimmed);
      console.log(formatResult(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.length > 0) {
    const arg = args[0];
    if (arg === '-h' || arg === '--help') {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    if (arg === '-v' || arg === '--version') {
      console.log(VERSION);
      process.exit(0);
    }
  }

  // Expression from command line args
  if (args.length > 0) {
    const expression = args.join(' ');
    processExpression(expression);
    return;
  }

  // Check for stdin
  const stdin = await readStdin();
  if (stdin.length > 0) {
    processExpression(stdin);
    return;
  }

  // Interactive mode
  await runInteractive();
}

main();
