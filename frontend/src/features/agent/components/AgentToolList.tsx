import React from 'react';
import ToolCard from './ToolCard';
import { AgentToolState } from '../xstates/agentThink';
import { useTranslation } from 'react-i18next';
import { PiCircleNotchBold } from 'react-icons/pi';

export type AgentToolsProps = {
  // Note: key is toolUseId
  [key: string]: {
    name: string;
    status: AgentToolState;
    input: { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    content?: { text: string };
  };
};

type AgentToolListProps = {
  tools: AgentToolsProps;
  isRunning: boolean;
};

const AgentToolList: React.FC<AgentToolListProps> = ({ tools, isRunning }) => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col rounded-lg bg-aws-paper p-4 shadow">
      {isRunning && (
        <div className="mb-2 flex items-center text-aws-font-color">
          <PiCircleNotchBold className="mr-2 animate-spin" />
          {t('agent.progress.label')}
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
