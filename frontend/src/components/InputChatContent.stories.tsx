import { useTranslation } from 'react-i18next';
import InputChatContent from './InputChatContent';

export const Ideal = () => (
  <InputChatContent
    hasRegenerate={false}
    hasContinue={false}
    isLoading={false}
    onSend={() => {}}
    onRegenerate={() => {}}
    continueGenerate={() => {}}
  />
);

export const IdealLoading = () => (
  <InputChatContent
    disabledSend={true}
    disabledRegenerate={true}
    disabledContinue={true}
    hasRegenerate={false}
    hasContinue={false}
    isLoading={true}
    onSend={() => {}}
    onRegenerate={() => {}}
    continueGenerate={() => {}}
  />
);

export const IdealDisabled = () => {
  const { t } = useTranslation();
  return (
    <InputChatContent
      hasRegenerate={false}
      hasContinue={false}
      isLoading={false}
      disabled={true}
      placeholder={t('bot.label.notAvailableBotInputMessage')}
      onSend={() => {}}
      onRegenerate={() => {}}
      continueGenerate={() => {}}
    />
  );
};

export const HasRegenerate = () => (
  <InputChatContent
    hasRegenerate={true}
    hasContinue={false}
    isLoading={false}
    onSend={() => {}}
    onRegenerate={() => {}}
    continueGenerate={() => {}}
  />
);

export const HasContinue = () => (
  <InputChatContent
    hasRegenerate={true}
    hasContinue={true}
    isLoading={false}
    onSend={() => {}}
    onRegenerate={() => {}}
    continueGenerate={() => {}}
  />
);
