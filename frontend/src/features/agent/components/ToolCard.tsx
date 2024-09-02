import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AiOutlineLoading3Quarters,
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
} from 'react-icons/ai';
import { AgentToolState } from '../xstates/agentThink';

type ToolCardProps = {
  toolUseId: string;
  name: string;
  status: AgentToolState;
  input?: { [key: string]: string };
  content?: string;
};

const ToolCard: React.FC<ToolCardProps> = ({
  // toolUseId,
  name,
  status,
  input,
  content,
}) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg bg-aws-paper p-4 shadow">
      <h3 className="text-lg font-semibold text-aws-font-color">
        <span className="font-bold">{t('agent.progressCard.toolName')}</span>{' '}
        {name}
      </h3>
      <div
        className={`mt-1 flex items-center text-base ${status === 'error' ? 'text-red' : 'text-aws-font-color'}`}>
        {status === 'running' && (
          <>
            <AiOutlineLoading3Quarters className="mr-2 animate-spin text-lg text-aws-lab" />
            <span className="text-lg">
              {t('agent.progressCard.status.running')}
            </span>
          </>
        )}
        {status === 'success' && (
          <>
            <AiOutlineCheckCircle className="mr-2 text-lg text-aws-lab" />
            <span className="text-lg">
              {t('agent.progressCard.status.success')}
            </span>
          </>
        )}
        {status === 'error' && (
          <>
            <AiOutlineCloseCircle className="mr-2 text-lg text-red" />
            <span className="text-lg">
              {t('agent.progressCard.status.error')}
            </span>
          </>
        )}
      </div>
      {status === 'success' && content && (
        <div className="mt-2 rounded-md bg-light-gray p-2">
          <pre className="whitespace-pre-wrap text-sm text-dark-gray">
            {content}
          </pre>
        </div>
      )}
      {status === 'running' &&
        input && ( // running の場合のみ input を表示
          <div className="mt-2 text-sm text-aws-font-color">
            <p className="font-bold">{t('agent.progressCard.toolInput')}</p>
            <ul className="ml-4 list-disc">
              {Object.entries(input).map(([key, value]) => (
                <li key={key}>
                  <span className="font-semibold">{key}:</span> {value}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
};

export default ToolCard;
