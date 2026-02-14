import React, { useState } from 'react';
import type { JSX } from 'react';
import { Box, Text, useInput } from 'ink';

interface HistoryItem {
  expression: string;
  result: number | string;
}

interface HistorySidebarProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  width?: number;
}

export function HistorySidebar({ items, onSelect, width = 30 }: HistorySidebarProps): JSX.Element {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (items.length === 0) return;

    if (key.upArrow) {
      setSelected(i => Math.max(0, i - 1));
    }
    if (key.downArrow) {
      setSelected(i => Math.min(items.length - 1, i + 1));
    }
    if (key.return) {
      onSelect(items[selected]!);
    }
  });

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      flexDirection="column"
      width={width}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline>
          History
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {items.length === 0 ? (
          <Text color="gray" dimColor>
            No history
          </Text>
        ) : (
          items.map((item, index) => {
            const isSelected = index === selected;
            const displayText =
              item.expression.length > width - 4
                ? item.expression.slice(0, width - 7) + '...'
                : item.expression;

            return (
              <Box key={index}>
                <Text
                  backgroundColor={isSelected ? 'blue' : undefined}
                  color={isSelected ? 'white' : 'gray'}
                >
                  {displayText}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
      {items.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor color="gray">
            Use ↑↓ to navigate
          </Text>
        </Box>
      )}
    </Box>
  );
}
