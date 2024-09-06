import {
  AgentMessage,
  AgentContent,
  AgentToolUseContent,
  AgentToolResult,
} from '../../../@types/conversation';
import { AgentToolState } from '../xstates/agentThink';
import { AgentToolsProps } from '../components/AgentToolList';

export const convertThinkingLogToAgentToolProps = (
  thinkingLog: AgentMessage[]
): AgentToolsProps => {
  const tools: AgentToolsProps = {};
  thinkingLog.forEach((message) => {
    message.content.forEach((content: AgentContent) => {
      if (content.contentType === 'toolUse') {
        const toolUseContent = content.body as AgentToolUseContent;
        tools[toolUseContent.toolUseId] = {
          name: toolUseContent.name,
          status: 'success',
          input: toolUseContent.input,
        };
      } else if (content.contentType === 'toolResult') {
        const toolResultContent = content.body as AgentToolResult;
        if (tools[toolResultContent.toolUseId]) {
          tools[toolResultContent.toolUseId].status =
            toolResultContent.status as AgentToolState;
          tools[toolResultContent.toolUseId].content = {
            text: toolResultContent.content.text,
          };
        }
      }
    });
  });

  return tools;
};
