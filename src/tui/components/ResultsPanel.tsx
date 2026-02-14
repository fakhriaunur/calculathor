import React from 'react';
import type { JSX } from 'react';
import { Box, Text } from 'ink';

interface Result {
  expression: string;
  result: number | string;
}

interface ResultsPanelProps {
  results: Result[];
}

export function ResultsPanel({ results }: ResultsPanelProps): JSX.Element {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {results.length === 0 ? (
        <Text color="gray" dimColor>
          No calculations yet. Enter an expression and press Enter.
        </Text>
      ) : (
        results.map((item, index) => (
          <Box key={index} marginY={1}>
            <Text color="gray">{item.expression}</Text>
            <Text>{' = '}</Text>
            <Text color="green" bold>
              {typeof item.result === 'number' ? formatNumber(item.result) : item.result}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}

function formatNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toString();
  }
  if (Math.abs(num) < 0.0001 || Math.abs(num) > 1e10) {
    return num.toExponential(6);
  }
  return num.toFixed(6).replace(/\.?0+$/, '');
}
