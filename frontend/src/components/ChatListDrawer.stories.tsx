import type { Story, StoryDefault } from '@ladle/react';
import { msw } from '@ladle/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ChatListDrawer from "./ChatListDrawer";
import { BotListItem } from '../@types/bot';
import { ConversationMeta } from '../@types/conversation';

const backendApi = (path: string) => new URL(path, import.meta.env.VITE_APP_API_ENDPOINT).toString();
const conversations: ConversationMeta[] = [
  {
    id: '1',
    title: 'What is RAG?',
    createTime: new Date().getTime(),
    lastMessageId: '',
    model: 'claude-v3.5-sonnet',
    botId: '1',
  },
];
const bots: BotListItem[] = [
  {
    id: '1',
    title: 'Bot 1',
    description: 'Bot 1',
    createTime: new Date(),
    lastUsedTime: new Date(),
    isPublic: false,
    isPinned: false,
    owned: false,
    syncStatus: 'SUCCEEDED',
    available: true,
  },
  {
    id: '2',
    title: 'Bot 2',
    description: 'Bot 2',
    createTime: new Date(),
    lastUsedTime: new Date(),
    isPublic: true,
    isPinned: true,
    owned: true,
    syncStatus: 'SUCCEEDED',
    available: true,
  },
];

export default {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Story />} />
          <Route path="/bot/:botId" element={<Story />} />
          <Route path="/bot/explore" element={<Story />} />
          <Route path="/:conversationId" element={<Story />} />
          <Route path="/admin/shared-bot-analytics" element={<Story />} />
          <Route path="/admin/api-management" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
  msw: [
    msw.http.get(backendApi('conversations'), () => msw.HttpResponse.json(conversations)),
    msw.http.get(backendApi('bot'), (info) => {
      const url = new URL(info.request.url);
      const params = url.searchParams;
      if (params.has('kind', 'private')) {
        return msw.HttpResponse.json(bots);
      }
      else {
        if (params.has('pinned')) {
          return msw.HttpResponse.json(bots.filter(bot => bot.isPinned));
        } else {
          return msw.HttpResponse.json(bots.filter(bot => !bot.isPinned));
        }
      }
    }),
  ],
} satisfies StoryDefault;

export const Admin: Story = () => {
  return (
    <ChatListDrawer
      isAdmin={true}
      updateConversationTitle={async () => {}}
      onSignOut={() => {}}
      onDeleteConversation={() => {}}
      onClearConversations={() => {}}
      onSelectLanguage={() => {}}
    />
  );
};

export const NonAdmin: Story = () => {
  return (
    <ChatListDrawer
      isAdmin={false}
      updateConversationTitle={async () => {}}
      onSignOut={() => {}}
      onDeleteConversation={() => {}}
      onClearConversations={() => {}}
      onSelectLanguage={() => {}}
    />
  );
};
