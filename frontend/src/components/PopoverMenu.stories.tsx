import { useTranslation } from 'react-i18next';
import PopoverMenu from './PopoverMenu';
import ButtonPopover from './PopoverMenu';
import PopoverItem from './PopoverItem';
import {
  PiUsers,
  PiGlobe,
  PiTrashBold,
  PiPencilLine,
  PiLink,
} from 'react-icons/pi';

export const PopOverMenu = () => {
  const { t } = useTranslation();
  return (
    <PopoverMenu className="h-8" target="bottom-right">
      <PopoverItem onClick={() => {}}>
        <PiUsers />
        {t('bot.button.share')}
      </PopoverItem>
      <PopoverItem onClick={() => {}}>
        <PiGlobe />
        {t('bot.button.apiSettings')}
      </PopoverItem>
      <PopoverItem className="font-bold text-red" onClick={() => {}}>
        <PiTrashBold />
        {t('bot.button.delete')}
      </PopoverItem>
    </PopoverMenu>
  );
};

export const ButtonPopOver = () => {
  const { t } = useTranslation();
  return (
    <ButtonPopover className="mx-1" target="bottom-right">
      <PopoverItem onClick={() => {}}>
        <PiPencilLine />
        {t('bot.titleSubmenu.edit')}
      </PopoverItem>
      <PopoverItem onClick={() => {}}>
        <PiLink />
        {t('bot.titleSubmenu.copyLink')}
      </PopoverItem>
    </ButtonPopover>
  );
};
