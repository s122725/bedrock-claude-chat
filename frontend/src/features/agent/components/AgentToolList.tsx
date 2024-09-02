import React from 'react';
import ToolCard from './ToolCard';
import { AgentToolState } from '../xstates/agentThink';

type AgentToolListProps = {
  tools: Record<
    string,
    {
      name: string;
      status: AgentToolState;
      input?: any;
      content?: string;
    }
  >;
};

const AgentToolList: React.FC<AgentToolListProps> = ({ tools }) => {
  return (
    <div className="flex flex-col gap-4">
      {Object.keys(tools).map((toolUseId) => (
        <ToolCard
          key={toolUseId}
          toolUseId={toolUseId}
          name={tools[toolUseId].name}
          status={tools[toolUseId].status}
          input={
            tools[toolUseId].status === 'running'
              ? tools[toolUseId].input
              : undefined
          }
          content={tools[toolUseId].content}
        />
      ))}
    </div>
  );
};

export default AgentToolList;
