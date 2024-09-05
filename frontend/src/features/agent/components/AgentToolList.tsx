import React from 'react';
import ToolCard from './ToolCard';
import { AgentToolState } from '../xstates/agentThink';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export type AgentToolsProps = {
  // Note: key is toolUseId
  [key: string]: {
    name: string;
    status: AgentToolState;
    input: { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    content?: string;
  };
};

type AgentToolListProps = {
  tools: AgentToolsProps;
  isRunning: boolean;
};

const AgentToolList: React.FC<AgentToolListProps> = ({ tools, isRunning }) => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-lg bg-aws-paper p-4 shadow">
      {isRunning && (
        <div className="text-md mb-4 flex items-center text-aws-font-color">
          <AiOutlineLoading3Quarters className="mr-2 animate-spin" />
          思考中...
        </div>
      )}

      {Object.keys(tools).map((toolUseId) => (
        <ToolCard
          key={toolUseId}
          toolUseId={toolUseId}
          name={tools[toolUseId].name}
          status={tools[toolUseId].status}
          input={tools[toolUseId].input}
          content={tools[toolUseId].content}
        />
      ))}
    </div>
  );
};

export default AgentToolList;
