import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  AiOutlineLoading3Quarters,
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineDown,
  AiOutlineRight,
} from 'react-icons/ai';
import { AgentToolState } from '../xstates/agentThink';

type ToolCardProps = {
  toolUseId: string;
  name: string;
  status: AgentToolState;
  input?: { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  content?: string;
};

const ToolCard: React.FC<ToolCardProps> = ({
  name,
  status,
  input,
  content,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation();

  let displayContent =
    content !== undefined && content !== null
      ? typeof content === 'string'
        ? content
        : JSON.stringify(content, null, 2)
      : '';

  if (displayContent.length > 100) {
    displayContent = displayContent.slice(0, 100) + ' [...] truncated';
  }

  const toggleExpand = () => setIsExpanded(!isExpanded);

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

      {input && (
        <div
          className="mt-2 flex cursor-pointer items-center text-sm text-aws-font-color"
          onClick={toggleExpand}>
          <p className="font-bold">{t('agent.progressCard.toolInput')}</p>
          {isExpanded ? (
            <AiOutlineDown className="ml-2" />
          ) : (
            <AiOutlineRight className="ml-2" />
          )}
        </div>
      )}

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
        {input && (
          <div className="ml-4 mt-2 text-sm text-aws-font-color">
            <ul className="list-disc">
              {Object.entries(input).map(([key, value]) => (
                <li key={key}>
                  <span className="font-semibold">{key}:</span> {value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {status === 'success' && displayContent && (
        <div className="mt-2 rounded-md bg-light-gray p-2">
          <pre className="whitespace-pre-wrap text-sm text-dark-gray">
            {displayContent}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ToolCard;
