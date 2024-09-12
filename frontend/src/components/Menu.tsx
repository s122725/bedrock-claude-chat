import React, { useEffect, useRef, useState } from 'react';
import Button from './Button';
import { PiList, PiSignOut, PiTranslate, PiTrash } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { BaseProps } from '../@types/common';

type Props = BaseProps & {
  onSignOut: () => void;
  onSelectLanguage: () => void;
  onClearConversations: () => void;
};

// 인증 시 표시하는 메뉴 컴포넌트
const Menu: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 메뉴 외부 클릭 시 핸들링
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleClickOutside = (event: any) => {
      // 메뉴 버튼과 메뉴 이외를 클릭하고 있으면 메뉴 close
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    // 이벤트 리스너 설정
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuRef]);

  return (
    <>
      <Button
        ref={buttonRef}
        className="relative bg-aws-squid-ink"
        text
        icon={<PiList />}
        onClick={() => {
          setIsOpen(!isOpen);
        }}>
        {t('button.menu')}
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-10 left-2 w-60 rounded border border-aws-font-color-white bg-aws-sea-blue text-aws-font-color-white">
          <div
            className="flex w-full cursor-pointer items-center p-2 hover:bg-aws-sea-blue-hover"
            onClick={() => {
              setIsOpen(false);
              props.onSelectLanguage();
            }}>
            <PiTranslate className="mr-2" />
            {t('button.language')}
          </div>
          <div
            className="flex w-full cursor-pointer items-center p-2 hover:bg-aws-sea-blue-hover"
            onClick={() => {
              setIsOpen(false);
              props.onClearConversations();
            }}>
            <PiTrash className="mr-2" />
            {t('button.clearConversation')}
          </div>
          <div
            className="flex w-full cursor-pointer items-center border-t p-2 hover:bg-aws-sea-blue-hover"
            onClick={props.onSignOut}>
            <PiSignOut className="mr-2" />
            {t('button.signOut')}
          </div>
        </div>
      )}
    </>
  );
};

export default Menu;
