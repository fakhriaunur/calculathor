/**
 * Manual test script for tokenizer
 * Run with: bun tests/manual-test.ts
 */

import { tokenize, Token } from '../src/parser/tokenizer';

function printTokens(tokens: Token[]): void {
  console.log('Tokens:');
  console.log('-------');
  for (const token of tokens) {
    if (token.type === 'EOF') {
      console.log(`  ${token.type.padEnd(12)} (end of input)`);
    } else {
      console.log(
        `  ${token.type.padEnd(12)} "${token.value}" at line ${token.line}, col ${token.column}`
      );
    }
  }
  console.log();
}

// Test cases
const testCases = [
  '2 + 3 * 4',
  'sin(pi/2)',
  'f(x) = x^2',
  '1e10 + 2.5e-3',
  'atan2(1, 2)',
  'x1 + _temp',
  '2 + 3 == 5',
];

console.log('=== Tokenizer Manual Test ===\n');

for (const expr of testCases) {
  console.log(`Expression: "${expr}"`);
  try {
    const tokens = tokenize(expr);
    printTokens(tokens);
  } catch (e) {
    console.log(`  ERROR: ${e}\n`);
  }
}

console.log('=== All tests completed ===');
