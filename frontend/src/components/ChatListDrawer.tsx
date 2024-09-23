import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BaseProps } from '../@types/common';
import { useLocation, useParams } from 'react-router-dom';
import useDrawer from '../hooks/useDrawer';
import ButtonIcon from './ButtonIcon';
import {
  PiChat,
  PiCheck,
  PiCompass,
  PiNotePencil,
  PiPencilLine,
  PiRobot,
  PiShareNetwork,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import { PiCircleNotch } from 'react-icons/pi';
import LazyOutputText from './LazyOutputText';
import { ConversationMeta } from '../@types/conversation';
import { BotListItem } from '../@types/bot';
import { isMobile } from 'react-device-detect';
import useChat from '../hooks/useChat';
import { useTranslation } from 'react-i18next';
import Menu from './Menu';
import DrawerItem from './DrawerItem';
import ExpandableDrawerGroup from './ExpandableDrawerGroup';
import { usePageLabel } from '../routes';

type Props = BaseProps & {
  isAdmin: boolean;
  conversations?: ConversationMeta[];
  starredBots?: BotListItem[];
  recentlyUsedUnstarredBots?: BotListItem[];
  updateConversationTitle: (
    conversationId: string,
    title: string
  ) => Promise<void>;
  onSignOut: () => void;
  onDeleteConversation: (conversation: ConversationMeta) => void;
  onClearConversations: () => void;
  onSelectLanguage: () => void;
};

type ItemProps = BaseProps & {
  label: string;
  conversationId: string;
  generatedTitle?: boolean;
  updateTitle: (conversationId: string, title: string) => Promise<void>;
  onClick: () => void;
  onDelete: () => void;
};

const Item: React.FC<ItemProps> = (props) => {
  const { pathname } = useLocation();
  const { conversationId: pathParam } = useParams();
  const { conversationId } = useChat();
  const [tempLabel, setTempLabel] = useState('');
  const [editing, setEditing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const active = useMemo<boolean>(() => {
    return (
      pathParam === props.conversationId ||
      ((pathname === '/' || pathname.startsWith('/bot/')) &&
        conversationId == props.conversationId)
    );
  }, [conversationId, pathParam, pathname, props.conversationId]);

  const onClickEdit = useCallback(() => {
    setEditing(true);
    setTempLabel(props.label);
  }, [props.label]);

  const onClickUpdate = useCallback(() => {
    props.updateTitle(props.conversationId, tempLabel).then(() => {
      setEditing(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempLabel, props.conversationId, props.updateTitle]);

  const onClickDelete = useCallback(() => {
    props.onDelete();
  }, [props]);

  useLayoutEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  useLayoutEffect(() => {
    if (editing) {
      const listener = (e: DocumentEventMap['keypress']) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();

          // dispatch 처리 중에서 동기화를 위해서 title 갱신
          setTempLabel((newLabel) => {
            props.updateTitle(props.conversationId, newLabel).then(() => {
              setEditing(false);
            });
            return newLabel;
          });
        }
      };
      inputRef.current?.addEventListener('keypress', listener);

      inputRef.current?.focus();

      return () => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputRef.current?.removeEventListener('keypress', listener);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <DrawerItem
      isActive={active}
      isBlur={!editing}
      to={`/${props.conversationId}`}
      onClick={props.onClick}
      icon={<PiChat />}
      labelComponent={
        <>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-transparent"
              value={tempLabel}
              onChange={(e) => {
                setTempLabel(e.target.value);
              }}
            />
          ) : (
            <>
              {props.generatedTitle ? (
                <LazyOutputText text={props.label} />
              ) : (
                <>{props.label}</>
              )}
            </>
          )}
        </>
      }
      actionComponent={
        <>
          {active && !editing && (
            <>
              <ButtonIcon className="text-base" onClick={onClickEdit}>
                <PiPencilLine />
              </ButtonIcon>

              <ButtonIcon className="text-base" onClick={onClickDelete}>
                <PiTrash />
              </ButtonIcon>
            </>
          )}
          {editing && (
            <>
              <ButtonIcon className="text-base" onClick={onClickUpdate}>
                <PiCheck />
              </ButtonIcon>

              <ButtonIcon
                className="text-base"
                onClick={() => {
                  setEditing(false);
                }}>
                <PiX />
              </ButtonIcon>
            </>
          )}
        </>
      }
    />
  );
};

const ChatListDrawer: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { getPageLabel } = usePageLabel();
  const { opened, switchOpen } = useDrawer();
  const { conversations, starredBots, recentlyUsedUnstarredBots } = props;

  const [prevConversations, setPrevConversations] =
    useState<typeof conversations>();
  const [generateTitleIndex, setGenerateTitleIndex] = useState(-1);

  const { newChat, conversationId } = useChat();
  const { botId } = useParams();

  useEffect(() => {
    setPrevConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    // 새로운 채팅 시에는 title 을 lazy loading
    if (!conversations || !prevConversations) {
      return;
    }
    if (conversations.length > prevConversations?.length) {
      setGenerateTitleIndex(
        conversations?.findIndex(
          (c) =>
            (prevConversations?.findIndex((pc) => c.id === pc.id) ?? -1) < 0
        ) ?? -1
      );
    }
  }, [conversations, prevConversations]);

  const onClickNewChat = useCallback(() => {
    newChat();
    closeSmallDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClickNewBotChat = useCallback(
    () => {
      newChat();
      closeSmallDrawer();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const smallDrawer = useRef<HTMLDivElement>(null);

  const closeSmallDrawer = useCallback(() => {
    if (smallDrawer.current?.classList.contains('visible')) {
      switchOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    // 리사이즈 이벤트 감지하여 상태 업데이트
    const onResize = () => {
      if (isMobile) {
        return;
      }

      // 작은 화면의 Drawer 가 표시되어 있었으니 화면 크기가 커지면 상태 업데이트
      if (!smallDrawer.current?.checkVisibility() && opened) {
        switchOpen();
      }
    };
    onResize();

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  return (
    <>
      <div className="relative h-full overflow-y-auto bg-aws-squid-ink scrollbar-thin scrollbar-track-white scrollbar-thumb-aws-squid-ink/30 ">
        <nav
          className={`lg:visible lg:w-64 ${
            opened ? 'visible w-64' : 'invisible w-0'
          } text-sm  text-white transition-width`}>
          <div className="absolute top-0 w-full overflow-y-auto overflow-x-hidden pb-12">
            <DrawerItem
              isActive={false}
              icon={<PiNotePencil />}
              to="/"
              onClick={onClickNewChat}
              labelComponent={t('button.newChat')}
            />
            <DrawerItem
              isActive={false}
              icon={<PiCompass />}
              to="/bot/explore"
              labelComponent={getPageLabel('/bot/explore')}
              onClick={closeSmallDrawer}
            />
            {props.isAdmin && (
              <ExpandableDrawerGroup
                label={t('app.adminConsoles')}
                className="border-t pt-1">
                <DrawerItem
                  isActive={false}
                  icon={<PiShareNetwork />}
                  to="/admin/shared-bot-analytics"
                  labelComponent={getPageLabel('/admin/shared-bot-analytics')}
                  onClick={closeSmallDrawer}
                />
                {/* <DrawerItem
                  isActive={false}
                  icon={<PiGlobe />}
                  to="/admin/api-management"
                  labelComponent={getPageLabel('/admin/api-management')}
                  onClick={closeSmallDrawer}
                /> */}
                {/* FIXME: 메뉴 삭제 */}
              </ExpandableDrawerGroup>
            )}

            <ExpandableDrawerGroup
              label={t('app.starredBots')}
              className="border-t pt-1">
              {starredBots?.map((bot) => (
                <DrawerItem
                  key={bot.id}
                  isActive={botId === bot.id && !conversationId}
                  to={`/bot/${bot.id}`}
                  icon={<PiRobot />}
                  labelComponent={bot.title}
                  onClick={onClickNewBotChat}
                />
              ))}
            </ExpandableDrawerGroup>

            <ExpandableDrawerGroup
              label={t('app.recentlyUsedBots')}
              className="border-t pt-1">
              {recentlyUsedUnstarredBots
                ?.slice(0, 3)
                .map((bot) => (
                  <DrawerItem
                    key={bot.id}
                    isActive={false}
                    to={`/bot/${bot.id}`}
                    icon={<PiRobot />}
                    labelComponent={bot.title}
                    onClick={onClickNewBotChat}
                  />
                ))}
            </ExpandableDrawerGroup>

            <ExpandableDrawerGroup
              label={t('app.conversationHistory')}
              className="border-t pt-1">
              {conversations === undefined && (
                <div className="flex animate-spin items-center justify-center p-4">
                  <PiCircleNotch size={24} />
                </div>
              )}
              {conversations?.map((conversation, idx) => (
                <Item
                  key={idx}
                  className="grow"
                  label={conversation.title}
                  conversationId={conversation.id}
                  generatedTitle={idx === generateTitleIndex}
                  updateTitle={props.updateConversationTitle}
                  onClick={closeSmallDrawer}
                  onDelete={() => props.onDeleteConversation(conversation)}
                />
              ))}
            </ExpandableDrawerGroup>
          </div>

          <div
            className={`${
              opened ? 'w-64' : 'w-0'
            } fixed bottom-0 flex h-12 items-center justify-start border-t bg-aws-squid-ink transition-width lg:w-64`}>
            <Menu
              onSignOut={props.onSignOut}
              onSelectLanguage={props.onSelectLanguage}
              onClearConversations={props.onClearConversations}
            />
          </div>
        </nav>
      </div>

      <div
        ref={smallDrawer}
        className={`lg:hidden ${opened ? 'visible' : 'hidden'}`}>
        <ButtonIcon
          className="fixed left-64 top-0 z-50 text-white"
          onClick={switchOpen}>
          <PiX />
        </ButtonIcon>
        <div
          className="fixed z-40 h-dvh w-screen bg-dark-gray/90"
          onClick={switchOpen}></div>
      </div>
    </>
  );
};

export default ChatListDrawer;
