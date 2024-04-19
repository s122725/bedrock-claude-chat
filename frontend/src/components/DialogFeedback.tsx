import React, { useState } from 'react';
import { BaseProps } from '../@types/common';
import Button from './Button';
import ModalDialog from './ModalDialog';
import { useTranslation } from 'react-i18next';
import Textarea from './Textarea';
import Select from './Select';
import { Feedback } from '../@types/conversation';

type Props = BaseProps & {
  isOpen: boolean;
  thumbsUp: boolean;
  feedback?: Feedback;
  onSubmit: (feedback: Feedback) => void;
  onClose: () => void;
};

const DialogFeedback: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const categoryOptions = t('feedbackDialog.categories', {
    returnObjects: true,
  });
  const [category, setCategory] = useState<string>(
    props.feedback?.category || categoryOptions[0].value
  );
  const [comment, setComment] = useState<string>(props.feedback?.comment || '');

  const handleSubmit = () => {
    props.onSubmit({ thumbsUp: props.thumbsUp, category, comment });
  };

  return (
    <ModalDialog title={t('feedbackDialog.title')} {...props}>
      <div className="mb-4">{t('feedbackDialog.content')}</div>

      <div className="mb-2 font-bold">{t('feedbackDialog.categoryLabel')}</div>
      <Select
        value={category}
        options={categoryOptions}
        onChange={(val) => {
          setCategory(val);
        }}
      />
      <div className="my-2 font-bold">{t('feedbackDialog.commentLabel')}</div>
      <Textarea
        value={comment}
        placeholder={t('feedbackDialog.commentPlaceholder')}
        rows={5}
        onChange={(val) => {
          setComment(val);
        }}
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={props.onClose} className="p-2" outlined>
          {t('button.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          className="bg-aws-sea-blue p-2 text-aws-font-color-white"
          outlined>
          {t('button.ok')}
        </Button>
      </div>
    </ModalDialog>
  );
};

export default DialogFeedback;
