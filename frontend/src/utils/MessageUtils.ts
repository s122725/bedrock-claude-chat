import { DisplayMessageContent, MessageMap } from '../@types/conversation';

export const convertMessageMapToArray = (
  messageMap: MessageMap,
  currentMessageId: string
): DisplayMessageContent[] => {
  if (Object.keys(messageMap).length === 0) {
    return [];
  }

  const messageArray: DisplayMessageContent[] = [];
  let key: string | null = currentMessageId;
  let messageContent: MessageMap[string] = messageMap[key];

  //  지정된 Key가 존재하는 경우
  if (messageContent) {
    // 말단의 Key 취득
    while (messageContent.children.length > 0) {
      key = messageContent.children[0];
      messageContent = messageMap[key];
    }

    // 말단부터 순서대로 Array로 설정해 나간다
    while (key) {
      messageContent = messageMap[key];
      // 참조가 중간에 끊어진 경우 처리 중단
      if (!messageContent) {
        messageArray[0].parent = null;
        break;
      }

      // 이미 배열 상에 존재하는 경우 순환참조 상태이므로 처리 중단
      if (
        messageArray.some((a) => {
          return a.id === key || a.children.includes(key ?? '');
        })
      ) {
        messageArray[0].parent = null;
        break;
      }

      messageArray.unshift({
        id: key,
        model: messageContent.model,
        role: messageContent.role,
        content: messageContent.content,
        parent: messageContent.parent,
        children: messageContent.children,
        sibling: [],
        feedback: messageContent.feedback,
        usedChunks: messageContent.usedChunks,
      });

      key = messageContent.parent;
    }

    // 존재하지 않는 Key가 지정된 경우
  } else {
    // 최상위 Key 취득
    key = Object.keys(messageMap).filter(
      (k) => messageMap[k].parent === null
    )[0];

    // 위에서부터 순서대로 Array로 설정한다
    while (key) {
      messageContent = messageMap[key];
      // 참조가 중간에 끊어진 경우 처리 중단
      if (!messageContent) {
        messageArray[messageArray.length - 1].children = [];
        break;
      }

      // 이미 배열 상에 존재하는 경우 순환참조 상태이므로 처리 중단
      if (
        messageArray.some((a) => {
          return a.id === key;
        })
      ) {
        messageArray[messageArray.length - 1].children = [];
        break;
      }

      messageArray.push({
        id: key,
        model: messageContent.model,
        role: messageContent.role,
        content: messageContent.content,
        parent: messageContent.parent,
        children: messageContent.children,
        sibling: [],
        feedback: messageContent.feedback,
        usedChunks: messageContent.usedChunks,
      });
      key = messageContent.children[0];
    }
  }

  // 형제 노드 설정
  messageArray[0].sibling = [messageArray[0].id];
  messageArray.forEach((m, idx) => {
    if (m.children.length > 0) {
      messageArray[idx + 1].sibling = [...m.children];
    }
  });
  // 선두에 system 노드가 설정되어 있는 경우는, 그것을 제거한다
  if (messageArray[0].id === 'system') {
    messageArray.shift();
  }

  return messageArray;
};
