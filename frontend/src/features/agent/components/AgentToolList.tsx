import React from 'react';
import ToolCard from './ToolCard';
import { AgentToolState } from '../xstates/agentThink';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

type AgentToolListProps = {
  tools: Record<
    string,
    {
      name: string;
      status: AgentToolState;
      input?: { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
      content?: string;
    }
  >;
};

const AgentToolList: React.FC<AgentToolListProps> = ({ tools }) => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
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

      <div className="text-gray-700 text-md mt-4 flex items-center text-left">
        <AiOutlineLoading3Quarters className="mr-2 animate-spin" />
        思考中...
      </div>
    </div>
  );
};

export default AgentToolList;
