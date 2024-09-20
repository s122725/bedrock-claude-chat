import React, { useEffect } from 'react';
import { translations } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import '@aws-amplify/ui-react/styles.css';
import AuthAmplify from './components/AuthAmplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { useTranslation } from 'react-i18next';
import './i18n';
import AppContent from './components/AppContent';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from './pages/ErrorFallback';

const App: React.FC = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // set header title
    document.title = t('app.name');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 코그니토 설정
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_APP_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_APP_USER_POOL_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: import.meta.env.VITE_APP_COGNITO_DOMAIN,
            scopes: ['openid', 'email'],
            redirectSignIn: [import.meta.env.VITE_APP_REDIRECT_SIGNIN_URL],
            redirectSignOut: [import.meta.env.VITE_APP_REDIRECT_SIGNOUT_URL],
            responseType: 'code',
          },
        },
      },
    },
  });

  I18n.putVocabularies(translations);
  I18n.setLanguage(i18n.language);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-7 items-center gap-4 bg-aws-squid-ink p-[1.5rem] text-white">
        <img
          src="/launch_center_icon.png"
          className="rounded-[10%] w-[40px] h-[40px]"
        />
        <h1 className="text-lg text-white">Quick Start for Developer</h1>
        <p>Generative AI Chatbot with Amazon Bedrock</p>
      </div>
      <div className="flex h-full flex-auto p-0">
        <ErrorBoundary fallback={<ErrorFallback />}>
          <Authenticator.Provider>
            <AuthAmplify>
              <AppContent />
            </AuthAmplify>
          </Authenticator.Provider>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;
