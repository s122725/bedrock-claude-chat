import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Help from '../components/Help';
import { addDate, formatDate } from '../utils/DateUtils';
import InputText from '../components/InputText';
import Button from '../components/Button';
import { PiArrowDown } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { TooltipDirection } from '../constants';

const DATA_FORMAT = 'YYYYMMDD';

const AdminSharedBotAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();

  const [searchDateFrom, setSearchDateFrom] = useState<null | string>(
    formatDate(addDate(new Date(), -1, 'month'), DATA_FORMAT)
  );
  const [searchDateTo, setSearchDateTo] = useState<null | string>(
    formatDate(new Date(), DATA_FORMAT)
  );
  const [isDescCost, setIsDescCost] = useState(true);

  const validationErrorMessage = useMemo(() => {
    return !!searchDateFrom === !!searchDateTo
      ? null
      : t('admin.validationError.period');
  }, [searchDateFrom, searchDateTo, t]);

  return (
    <>
      <div className="flex h-full justify-center">
        <div className="w-2/3">
          <div className="size-full pt-8">
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold">
                  {t('admin.sharedBotAnalytics.label.pageTitle')}
                </div>
                <Help
                  direction={TooltipDirection.RIGHT}
                  message={t('admin.sharedBotAnalytics.help.overview')}
                />
              </div>
            </div>

            <div className="my-2 rounded border p-2">
              <div className="flex items-center gap-1 text-sm font-bold">
                {t('admin.sharedBotAnalytics.label.SearchCondition.title')}
                <Help
                  message={t('admin.sharedBotAnalytics.help.calculationPeriod')}
                />
              </div>

              <div className="flex gap-2 sm:w-full md:w-3/4">
                <InputText
                  className="w-full"
                  type="date"
                  label={t(
                    'admin.sharedBotAnalytics.label.SearchCondition.from'
                  )}
                  value={formatDate(searchDateFrom, 'YYYY-MM-DD')}
                  onChange={(val) => {
                    if (val === '') {
                      setSearchDateFrom(null);
                      return;
                    }
                    setSearchDateFrom(formatDate(val, DATA_FORMAT));
                  }}
                  errorMessage={
                    searchDateFrom
                      ? undefined
                      : (validationErrorMessage ?? undefined)
                  }
                />
                <InputText
                  className="w-full"
                  type="date"
                  label={t('admin.sharedBotAnalytics.label.SearchCondition.to')}
                  value={formatDate(searchDateTo, 'YYYY-MM-DD')}
                  onChange={(val) => {
                    if (val === '') {
                      setSearchDateTo(null);
                      return;
                    }
                    setSearchDateTo(formatDate(val, DATA_FORMAT));
                  }}
                  errorMessage={
                    searchDateTo
                      ? undefined
                      : (validationErrorMessage ?? undefined)
                  }
                />
              </div>
            </div>

            <div className="my-2 flex justify-end">
              <Button
                outlined
                rightIcon={
                  <PiArrowDown
                    className={twMerge(
                      'transition',
                      isDescCost ? 'rotate-0' : 'rotate-180'
                    )}
                  />
                }
                onClick={() => {
                  setIsDescCost(!isDescCost);
                }}>
                {t('admin.sharedBotAnalytics.label.sortByCost')}
              </Button>
            </div>
            <div className="mt-2 border-b border-gray"></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSharedBotAnalyticsPage;
