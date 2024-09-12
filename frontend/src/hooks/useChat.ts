import { useCallback, useEffect, useMemo } from 'react';
import useConversationApi from './useConversationApi';
import { produce } from 'immer';
import {
  MessageContent,
  DisplayMessageContent,
  MessageMap,
  Model,
  PostMessageRequest,
  RelatedDocument,
  Conversation,
  PutFeedbackRequest,
} from '../@types/conversation';
import useConversation from './useConversation';
import { create } from 'zustand';
import usePostMessageStreaming from './usePostMessageStreaming';
import { ulid } from 'ulid';
import { convertMessageMapToArray } from '../utils/MessageUtils';
import useModel from './useModel';
import useFeedbackApi from './useFeedbackApi';

type ChatStateType = {
  [id: string]: MessageMap;
};

type BotInputType = {
  botId: string;
};

export type AttachmentType = {
  fileName: string;
  fileType: string;
  extractedContent: string;
};

export type ThinkingAction =
  | {
      type: 'doing';
    }
  | { type: 'init' };

const NEW_MESSAGE_ID = {
  USER: 'new-message',
  ASSISTANT: 'new-message-assistant',
};

const useChatState = create<{
  conversationId: string;
  setConversationId: (s: string) => void;
  postingMessage: boolean;
  setPostingMessage: (b: boolean) => void;
  chats: ChatStateType;
  relatedDocuments: {
    [messageId: string]: RelatedDocument[];
  };
  setMessages: (id: string, messageMap: MessageMap) => void;
  copyMessages: (fromId: string, toId: string) => void;
  pushMessage: (
    id: string,
    parentMessageId: string | null,
    currentMessageId: string,
    content: MessageContent
  ) => void;
  removeMessage: (id: string, messageId: string) => void;
  editMessage: (id: string, messageId: string, content: string) => void;
  getMessages: (
    id: string,
    currentMessageId: string
  ) => DisplayMessageContent[];
  setRelatedDocuments: (
    messageId: string,
    documents: RelatedDocument[]
  ) => void;
  moveRelatedDocuments: (fromMessageId: string, toMessageId: string) => void;
  currentMessageId: string;
  setCurrentMessageId: (s: string) => void;
  isGeneratedTitle: boolean;
  setIsGeneratedTitle: (b: boolean) => void;
  getPostedModel: () => Model;
  shouldUpdateMessages: (currentConversation: Conversation) => boolean;
  shouldContinue: boolean;
  setShouldContinue: (b: boolean) => void;
  getShouldContinue: () => boolean;
}>((set, get) => {
  return {
    conversationId: '',
    setConversationId: (s) => {
      set(() => {
        return {
          conversationId: s,
        };
      });
    },
    postingMessage: false,
    setPostingMessage: (b) => {
      set(() => ({
        postingMessage: b,
      }));
    },
    chats: {},
    relatedDocuments: {},
    setMessages: (id: string, messageMap: MessageMap) => {
      set((state) => ({
        chats: produce(state.chats, (draft) => {
          draft[id] = messageMap;
        }),
      }));
    },
    copyMessages: (fromId: string, toId: string) => {
      set((state) => ({
        chats: produce(state.chats, (draft) => {
          draft[toId] = JSON.parse(JSON.stringify(draft[fromId]));
        }),
      }));
    },
    pushMessage: (
      id: string,
      parentMessageId: string | null,
      currentMessageId: string,
      content: MessageContent
    ) => {
      set(() => ({
        chats: produce(get().chats, (draft) => {
          // 추가 대상이 자녀 노드인 경우 부모 노드에 참조 정보 추가
          if (draft[id] && parentMessageId && parentMessageId !== 'system') {
            draft[id][parentMessageId] = {
              ...draft[id][parentMessageId],
              children: [
                ...draft[id][parentMessageId].children,
                currentMessageId,
              ],
            };
            draft[id][currentMessageId] = {
              ...content,
              parent: parentMessageId,
              children: [],
            };
          } else {
            draft[id] = {
              [currentMessageId]: {
                ...content,
                children: [],
                parent: null,
              },
            };
          }
        }),
      }));
    },
    editMessage: (id: string, messageId: string, content: string) => {
      set(() => ({
        chats: produce(get().chats, (draft) => {
          draft[id][messageId].content[0].body = content;
        }),
      }));
    },
    removeMessage: (id: string, messageId: string) => {
      set((state) => ({
        chats: produce(state.chats, (draft) => {
          const childrenIds = [...draft[id][messageId].children];

          // children 으로 설정되어 있는 노드도 모두 삭제
          while (childrenIds.length > 0) {
            const targetId = childrenIds.pop()!;
            childrenIds.push(...draft[id][targetId].children);
            delete draft[id][targetId];
          }

          // 삭제 대상 노드를 다른 노드 참조에서 삭제
          Object.keys(draft[id]).forEach((key) => {
            const idx = draft[id][key].children.findIndex(
              (c) => c === messageId
            );
            if (idx > -1) {
              draft[id][key].children.splice(idx, 1);
            }
          });
          delete draft[id][messageId];
        }),
      }));
    },
    getMessages: (id: string, currentMessageId: string) => {
      return convertMessageMapToArray(get().chats[id] ?? {}, currentMessageId);
    },
    setRelatedDocuments: (messageId, documents) => {
      set((state) => ({
        relatedDocuments: produce(state.relatedDocuments, (draft) => {
          draft[messageId] = documents;
        }),
      }));
    },
    moveRelatedDocuments: (fromId, toId) => {
      set(() => ({
        relatedDocuments: produce(get().relatedDocuments, (draft) => {
          draft[toId] = get().relatedDocuments[fromId];
          draft[fromId] = [];
        }),
      }));
    },
    currentMessageId: '',
    setCurrentMessageId: (s: string) => {
      set(() => ({
        currentMessageId: s,
      }));
    },
    isGeneratedTitle: false,
    setIsGeneratedTitle: (b: boolean) => {
      set(() => ({
        isGeneratedTitle: b,
      }));
    },
    getPostedModel: () => {
      return (
        get().chats[get().conversationId]?.system?.model ??
        // 화면에 즉시 반영하기 위해 NEW_MESSAGE 평가
        get().chats['']?.[NEW_MESSAGE_ID.ASSISTANT]?.model
      );
    },
    shouldUpdateMessages: (currentConversation) => {
      return (
        !!get().conversationId &&
        currentConversation.id === get().conversationId &&
        !get().postingMessage &&
        get().currentMessageId !== currentConversation.lastMessageId
      );
    },
    getShouldContinue: () => {
      return get().shouldContinue;
    },
    setShouldContinue: (b) => {
      set(() => ({
        shouldContinue: b,
      }));
    },
    shouldContinue: false,
  };
});

const useChat = () => {
  const {
    chats,
    conversationId,
    setConversationId,
    postingMessage,
    setPostingMessage,
    setMessages,
    pushMessage,
    editMessage,
    copyMessages,
    removeMessage,
    getMessages,
    currentMessageId,
    setCurrentMessageId,
    isGeneratedTitle,
    setIsGeneratedTitle,
    getPostedModel,
    relatedDocuments,
    setRelatedDocuments,
    moveRelatedDocuments,
    shouldUpdateMessages,
    getShouldContinue,
    setShouldContinue,
  } = useChatState();

  const { post: postStreaming } = usePostMessageStreaming();
  const { modelId, setModelId } = useModel();

  const conversationApi = useConversationApi();
  const feedbackApi = useFeedbackApi();
  const {
    data,
    mutate,
    isLoading: loadingConversation,
    error: conversationError,
  } = conversationApi.getConversation(conversationId);
  const { syncConversations } = useConversation();

  const messages = useMemo(() => {
    return getMessages(conversationId, currentMessageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, chats, currentMessageId]);

  const newChat = useCallback(() => {
    setConversationId('');
    setMessages('', {});
  }, [setConversationId, setMessages]);

  // when updated messages
  useEffect(() => {
    if (data && shouldUpdateMessages(data)) {
      setMessages(conversationId, data.messageMap);
      setCurrentMessageId(data.lastMessageId);
      setModelId(getPostedModel());
      if ((relatedDocuments[NEW_MESSAGE_ID.ASSISTANT]?.length ?? 0) > 0) {
        moveRelatedDocuments(NEW_MESSAGE_ID.ASSISTANT, data.lastMessageId);
      }
    }
    if (data && data.shouldContinue !== getShouldContinue()) {
      setShouldContinue(data.shouldContinue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, data]);

  useEffect(() => {
    setIsGeneratedTitle(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // 화면에 즉시 반영하기 위해 State 업데이트 처리
  const pushNewMessage = (
    parentMessageId: string | null,
    messageContent: MessageContent
  ) => {
    pushMessage(
      conversationId ?? '',
      parentMessageId,
      NEW_MESSAGE_ID.USER,
      messageContent
    );
    pushMessage(
      conversationId ?? '',
      NEW_MESSAGE_ID.USER,
      NEW_MESSAGE_ID.ASSISTANT,
      {
        role: 'assistant',
        content: [
          {
            contentType: 'text',
            body: '',
          },
        ],
        model: messageContent.model,
        feedback: messageContent.feedback,
        usedChunks: messageContent.usedChunks,
      }
    );
  };

  const postChat = (params: {
    content: string;
    base64EncodedImages?: string[];
    attachments?: AttachmentType[];
    bot?: BotInputType;
  }) => {
    const { content, bot, base64EncodedImages, attachments } = params;
    const isNewChat = conversationId ? false : true;
    const newConversationId = ulid();

    // error retry 시에 동기화가 늦기 때문에 State를 직접 참조
    const tmpMessages = convertMessageMapToArray(
      useChatState.getState().chats[conversationId] ?? {},
      currentMessageId
    );

    const parentMessageId = isNewChat
      ? 'system'
      : tmpMessages[tmpMessages.length - 1].id;

    const modelToPost = isNewChat ? modelId : getPostedModel();
    const imageContents: MessageContent['content'] = (
      base64EncodedImages ?? []
    ).map((encodedImage) => {
      const result =
        /data:(?<mediaType>image\/.+);base64,(?<encodedImage>.+)/.exec(
          encodedImage
        );

      return {
        body: result!.groups!.encodedImage,
        contentType: 'image',
        mediaType: result!.groups!.mediaType,
      };
    });

    const attachContents: MessageContent['content'] = (attachments ?? []).map(
      (attachment) => {
        return {
          body: attachment.extractedContent,
          contentType: 'attachment',
          mediaType: attachment.fileType,
          fileName: attachment.fileName,
        };
      }
    );

    const messageContent: MessageContent = {
      content: [
        ...attachContents,
        ...imageContents,
        {
          body: content,
          contentType: 'text',
        },
      ],
      model: modelToPost,
      role: 'user',
      feedback: null,
      usedChunks: null,
    };
    const input: PostMessageRequest = {
      conversationId: isNewChat ? newConversationId : conversationId,
      message: {
        ...messageContent,
        parentMessageId: parentMessageId,
      },
      botId: bot?.botId,
    };
    const createNewConversation = () => {
      // Copy State to prevent screen flicker
      copyMessages('', newConversationId);

      conversationApi
        .updateTitleWithGeneratedTitle(newConversationId)
        .then(() => {
          setConversationId(newConversationId);
        })
        .finally(() => {
          syncConversations().then(() => {
            setIsGeneratedTitle(true);
          });
        });
    };

    setPostingMessage(true);

    // Update State for immediate reflection on screen
    pushNewMessage(parentMessageId, messageContent);

    // post message
    const postPromise: Promise<string> = new Promise((resolve, reject) => {
      postStreaming({
        input,
        dispatch: (c: string) => {
          editMessage(conversationId, NEW_MESSAGE_ID.ASSISTANT, c);
        },
      })
        .then((message) => {
          resolve(message);
        })
        .catch((e) => {
          reject(e);
        });
    });

    postPromise
      .then(() => {
        if (isNewChat) {
          createNewConversation();
        } else {
          mutate();
        }
      })
      .catch((e) => {
        console.error(e);
        removeMessage(conversationId, NEW_MESSAGE_ID.ASSISTANT);
      })
      .finally(() => {
        setPostingMessage(false);
      });

    // get related document (for RAG)
    const documents: RelatedDocument[] = [];
    if (input.botId) {
      conversationApi
        .getRelatedDocuments({
          botId: input.botId,
          conversationId: input.conversationId!,
          message: input.message,
        })
        .then((res) => {
          if (res.data) {
            documents.push(...res.data);
            setRelatedDocuments(NEW_MESSAGE_ID.ASSISTANT, documents);
          }
        });
    }
  };

  /**
   * Continue to generate
   */
  const continueGenerate = (params?: {
    messageId?: string;
    bot?: BotInputType;
  }) => {
    setPostingMessage(true);

    const messageContent: MessageContent = {
      content: [],
      model: getPostedModel(),
      role: 'user',
      feedback: null,
      usedChunks: null,
    };
    const input: PostMessageRequest = {
      conversationId: conversationId,
      message: {
        ...messageContent,
        parentMessageId: messages[messages.length - 1].id,
      },
      botId: params?.bot?.botId,
      continueGenerate: true,
    };

    const currentContentBody = messages[messages.length - 1].content[0].body;
    const currentMessage = messages[messages.length - 1];

    // WARNING: Non-streaming is not supported from the UI side as it is planned to be DEPRECATED.
    postStreaming({
      input,
      dispatch: (c: string) => {
        editMessage(conversationId, currentMessage.id, currentContentBody + c);
      },
    })
      .then(() => {
        mutate();
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        setPostingMessage(false);
      });
  };

  const hasError = useMemo(() => {
    const length_ = messages.length;
    return length_ === 0 ? false : messages[length_ - 1].role === 'user';
  }, [messages]);

  return {
    hasError,
    setConversationId,
    conversationId,
    loadingConversation,
    conversationError,
    postingMessage: postingMessage || loadingConversation,
    isGeneratedTitle,
    setIsGeneratedTitle,
    newChat,
    messages,
    setCurrentMessageId,
    postChat,
    getPostedModel,
    getShouldContinue,
    continueGenerate,
    getRelatedDocuments: (messageId: string) => {
      return relatedDocuments[messageId] ?? [];
    },
    giveFeedback: (messageId: string, feedback: PutFeedbackRequest) => {
      return feedbackApi
        .putFeedback(conversationId, messageId, feedback)
        .then(() => {
          mutate();
        });
    },
  };
};

export default useChat;
