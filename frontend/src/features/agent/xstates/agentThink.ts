import { setup, assign } from 'xstate';

export const AgentState = {
  SLEEPING: 'sleeping',
  THINKING: 'thinking',
  LEAVING: 'leaving',
} as const;

export type AgentToolState = 'running' | 'success' | 'error';

export type AgentState = (typeof AgentState)[keyof typeof AgentState];

export type AgentEvent =
  | { type: 'wakeup' }
  | { type: 'go-on'; toolUseId: string; name: string; input: any }
  | {
      type: 'tool-result';
      toolUseId: string;
      status: AgentToolState;
      content: string;
    }
  | { type: 'goodbye' };

export type AgentEventKeys = AgentEvent['type'];

export const agentThinkingState = setup({
  types: {
    context: {} as {
      count: number;
      tools: Record<
        string,
        {
          name: string;
          input: any; // eslint-disable-line @typescript-eslint/no-explicit-any
          status: string;
          content?: string;
        }
      >;
    },
    events: {} as AgentEvent,
  },
  actions: {
    reset: assign({
      count: () => 0,
      tools: () => ({}),
    }),
    addTool: assign({
      tools: ({ context, event }) => {
        if (event.type === 'go-on') {
          return {
            ...context.tools,
            [event.toolUseId]: {
              name: event.name,
              input: event.input,
              status: 'running',
            },
          };
        }
        return context.tools;
      },
    }),
    updateToolResult: assign({
      tools: ({ context, event }) => {
        if (event.type === 'tool-result') {
          return {
            ...context.tools,
            [event.toolUseId]: {
              ...context.tools[event.toolUseId],
              status: event.status,
              // Preview of content
              content: event.content.slice(0, 20),
            },
          };
        }
        return context.tools;
      },
    }),
    close: assign({
      count: () => 100,
    }),
  },
}).createMachine({
  context: {
    count: 0,
    tools: {},
  },
  initial: 'sleeping',
  states: {
    sleeping: {
      on: {
        wakeup: {
          actions: 'reset',
          target: 'thinking',
        },
      },
    },
    thinking: {
      on: {
        'go-on': {
          actions: 'addTool',
        },
        'tool-result': {
          actions: 'updateToolResult',
        },
        goodbye: {
          actions: 'close',
          target: 'leaving',
        },
      },
    },
    leaving: {
      after: {
        2500: { target: 'sleeping' },
      },
    },
  },
});
