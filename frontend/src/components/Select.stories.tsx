import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select from './Select';

export const Ideal = () => {
  const { t } = useTranslation();
  const categoryOptions = t('feedbackDialog.categories', {
    returnObjects: true,
  });
  const [category, setCategory] = useState(categoryOptions[0].value);

  return (
    <Select
      label={t('feedbackDialog.categoryLabel')}
      value={category}
      options={categoryOptions}
      onChange={setCategory}
    />
  );
};

export const IdealDisabled = () => {
  const { t } = useTranslation();
  const categoryOptions = t('feedbackDialog.categories', {
    returnObjects: true,
  });

  return (
    <Select
      label={t('feedbackDialog.categoryLabel')}
      value={categoryOptions[0].value}
      options={categoryOptions}
      disabled={true}
      onChange={() => {}}
    />
  );
};

export const Clearable = () => {
  const { t } = useTranslation();
  const categoryOptions = t('feedbackDialog.categories', {
    returnObjects: true,
  });
  const [category, setCategory] = useState(categoryOptions[0].value);

  return (
    <Select
      label={t('feedbackDialog.categoryLabel')}
      value={category}
      options={categoryOptions}
      clearable={true}
      onChange={setCategory}
    />
  );
};

export const ClearableDisabled = () => {
  const { t } = useTranslation();
  const categoryOptions = t('feedbackDialog.categories', {
    returnObjects: true,
  });

  return (
    <Select
      label={t('feedbackDialog.categoryLabel')}
      value={categoryOptions[0].value}
      options={categoryOptions}
      clearable={true}
      disabled={true}
      onChange={() => {}}
    />
  );
};
