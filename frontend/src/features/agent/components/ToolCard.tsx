import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  AiOutlineLoading3Quarters,
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineDown,
  AiOutlineRight,
  AiOutlineUp,
} from 'react-icons/ai';
import { AgentToolState } from '../xstates/agentThink';

type ToolCardProps = {
  toolUseId: string;
  name: string;
  status: AgentToolState;
  input: { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  content?: string;
};

const ToolCard: React.FC<ToolCardProps> = ({
  name,
  status,
  input,
  content,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const { t } = useTranslation();

  let displayContent = '';
  let parsedContent: { [key: string]: any } | null = null;

  if (content !== undefined && content !== null) {
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        displayContent = content;
      }
    } else {
      displayContent = JSON.stringify(content, null, 2);
    }
  }

  console.log(`input: ${JSON.stringify(input)}`);
  console.log(`content: ${content}`);
  console.log(`displayContent: ${displayContent}`);
  console.log(`parsedContent: ${JSON.stringify(parsedContent)}`);

  const toggleExpand = () => setIsExpanded(!isExpanded);
  const toggleInputExpand = () => setIsInputExpanded(!isInputExpanded);
  const toggleContentExpand = () => setIsContentExpanded(!isContentExpanded);

  return (
    <div className="relative rounded-lg bg-aws-paper p-4 shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-base">
          {status === 'running' && (
            <AiOutlineLoading3Quarters className="mr-2 animate-spin text-lg text-aws-lab" />
          )}
          {status === 'success' && (
            <AiOutlineCheckCircle className="mr-2 text-lg text-aws-lab" />
          )}
          {status === 'error' && (
            <AiOutlineCloseCircle className="mr-2 text-lg text-red" />
          )}
          <h3 className="text-lg font-semibold text-aws-font-color">{name}</h3>
        </div>
        <div className="cursor-pointer" onClick={toggleExpand}>
          {isExpanded ? (
            <AiOutlineUp className="text-lg" />
          ) : (
            <AiOutlineDown className="text-lg" />
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-full' : 'max-h-0'}`}>
        {input && (
          <div>
            <div
              className="mt-2 flex cursor-pointer items-center text-sm text-aws-font-color"
              onClick={toggleInputExpand}>
              <p className="font-bold">{t('agent.progressCard.toolInput')}</p>
              {isInputExpanded ? (
                <AiOutlineDown className="ml-2" />
              ) : (
                <AiOutlineRight className="ml-2" />
              )}
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isInputExpanded ? 'max-h-96' : 'max-h-0'}`}>
              <div className="ml-4 mt-2 text-sm text-aws-font-color">
                <ul className="list-disc">
                  {Object.entries(input).map(([key, value]) => (
                    <li key={key}>
                      <span className="font-semibold">{key}:</span> {value}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {(status === 'success' || status === 'error') &&
          (displayContent || parsedContent) && (
            <div>
              <div
                className="mt-2 flex cursor-pointer items-center text-sm text-aws-font-color"
                onClick={toggleContentExpand}>
                <p className="font-bold">
                  {t('agent.progressCard.toolOutput')}
                </p>
                {isContentExpanded ? (
                  <AiOutlineDown className="ml-2" />
                ) : (
                  <AiOutlineRight className="ml-2" />
                )}
              </div>

              {/* <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isContentExpanded ? 'max-h-96' : 'max-h-0'}`}>
                <div className="ml-4 mt-2 text-sm text-aws-font-color">
                  {parsedContent ? (
                    <ul className="list-disc">
                      {Object.entries(parsedContent).map(([key, value]) => (
                        <li key={key}>
                          <span className="font-semibold">{key}:</span> {value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-dark-gray">
                      {displayContent}
                    </pre>
                  )}
                </div>
              </div> */}
            </div>
          )}
      </div>
    </div>
  );
};

export default ToolCard;
