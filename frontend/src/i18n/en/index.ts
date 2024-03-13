const translation = {
  translation: {
    app: {
      name: 'Bedrock Claude Chat',
      inputMessage: 'Send a message',
      starredBots: 'Starred Bots',
      recentlyUsedBots: 'Recently Used Bots',
      conversationHistory: 'History',
      chatWaitingSymbol: '▍',
    },
    bot: {
      label: {
        myBots: 'My Bots',
        recentlyUsedBots: 'Recently Used Shared Bots',
        knowledge: 'Knowledge',
        url: 'URL',
        sitemap: 'Sitemap URL',
        file: 'File',
        loadingBot: 'Loading...',
        normalChat: 'Chat',
        notAvailableBot: '[NOT Available]',
        notAvailableBotInputMessage: 'This bot is NOT available.',
        noDescription: 'No Description',
        notAvailable: 'This bot is NOT available.',
        noBots: 'No Bots.',
        noBotsRecentlyUsed: 'No Recently Used Shared Bots.',
        retrievingKnowledge: '[Retrieving Knowledge...]',
        dndFileUpload:
          'You can upload files by drag and drop.\nSupported files: {{fileExtensions}}',
        uploadError: 'Error Message',
        syncStatus: {
          queue: 'Waiting Sync',
          running: 'Syncing',
          success: 'Completed Sync',
          fail: 'Failed Sync',
        },
        fileUploadStatus: {
          uploading: 'Uploading...',
          uploaded: 'Uploaded',
          error: 'ERROR',
        },
        apiSettings: {
          usagePlan: 'Usage Plan',
          allowOrigins: 'Allow Origins',
          apiKeys: 'API Keys',
          period: {
            day: 'Per day',
            week: 'Per week',
            month: 'Per month',
          },
        },
      },
      titleSubmenu: {
        edit: 'Edit',
        copyLink: 'Copy Link',
        copiedLink: 'Copied',
      },
      help: {
        overview:
          'Bots operate according to predefined instructions. Chat does not work as intended unless the context is defined in the message, but with bots, there is no need to define the context.',
        instructions:
          'Define how the bot should behave. Giving ambiguous instructions may lead to unpredictable movements, so provide clear and specific instructions.',
        knowledge: {
          overview:
            'By providing external knowledge to the bot, it becomes able to handle data that it has not been pre-trained on.',
          url: 'The information from the specified URL will be used as Knowledge. If you set the URL of a YouTube video, the transcript of that video will be used as Knowledge.',
          sitemap:
            'By specifying the URL of the sitemap, the information obtained through automatically scraping websites within it will be used as Knowledge.',
          file: 'The uploaded files will be used as Knowledge.',
        },
        apiSettings: {
          usagePlan:
            'Usage plans specify the number or rate of requests that your API accepts from a client. Associate an API key with a usage plan to track the requests your API receives.',
          throttling: 'Limit the rate that users can call your API.',
          rateLimit:
            'Enter the rate, in requests per second, that clients can call your API.',
          burstLimit:
            'Enter the number of concurrent requests that a client can make to your API.',
          quota:
            'Turn on quotas to limit the number of requests a user can make to your API in a given time period.',
          requestLimit:
            'Enter the total number of requests that a user can make in the time period you select in the dropdown list.',
          allowOrigins:
            'Allowed client origins for access. If the origin is not allowed, the caller receives a 403 Forbidden response and is denied access to the API. The Origin must follow the format: (http|https)://host-name or (http|https)://host-name:port. ',
          allowOriginsExample:
            'e.g. [https://your-host-name.com], [http://localhost:8000] ',
          apiKeys:
            'An API key is an alphanumeric string that used to identify a client of your API. Otherwise, the caller receives a 403 Forbidden response and is denied access to the API.',
        },
      },
      alert: {
        sync: {
          error: {
            title: 'Knowledge Sync Error',
            body: 'An error occurred while synchronizing Knowledge. Please check the following message:',
          },
          incomplete: {
            title: 'NOT Ready',
            body: 'This bot has not completed the knowledge synchronization, so the knowledge before the update is used.',
          },
        },
        botUnshared: {
          title: 'Please Share The Bot',
          body: 'You cannot publish an API for the bot that is not shared.',
        },
      },
      samples: {
        title: 'Instructions Samples',
        reference:
          'Reference: https://docs.anthropic.com/claude/docs/how-to-use-system-prompts',
        pythonCodeAssistant: {
          title: 'Python Coding Assistant',
          prompt: `Write a short and high-quality python script for the given task, something a very skilled python expert would write. You are writing code for an experienced developer so only add comments for things that are non-obvious. Make sure to include any imports required. 
NEVER write anything before the \`\`\`python\`\`\` block. After you are done generating the code and after the \`\`\`python\`\`\` block, check your work carefully to make sure there are no mistakes, errors, or inconsistencies. If there are errors, list those errors in <error> tags, then generate a new version with those errors fixed. If there are no errors, write "CHECKED: NO ERRORS" in <error> tags.`,
        },
        mailCategorizer: {
          title: 'Mail Categorizer',
          prompt: `You are a customer service agent tasked with classifying emails by type. Please output your answer and then justify your classification. 

The classification categories are: 
(A) Pre-sale question 
(B) Broken or defective item 
(C) Billing question 
(D) Other (please explain)

How would you categorize this email?`,
        },
        fitnessCoach: {
          title: 'Personal Fitness Coach',
          prompt: `You are an upbeat, enthusiastic personal fitness coach named Sam. Sam is passionate about helping clients get fit and lead healthier lifestyles. You write in an encouraging and friendly tone and always try to guide your clients toward better fitness goals. If the user asks you something unrelated to fitness, either bring the topic back to fitness, or say that you cannot answer.`,
        },
      },
      create: {
        pageTitle: 'Create My Bot',
      },
      edit: {
        pageTitle: 'Edit My Bot',
      },
      apiSettings: {
        pageTitle: 'Shared Bot API Settings',
      },
      item: {
        title: 'Name',
        description: 'Description',
        instruction: 'Instructions',
        apiSettings: {
          throttling: 'Throttling',
          burstLimit: 'Burst',
          rateLimit: 'Rate',
          quota: 'Quota',
          requestLimit: 'Requests',
          offset: 'Offset',
        },
      },
      button: {
        newBot: 'Create New Bot',
        create: 'Create',
        edit: 'Edit',
        delete: 'Delete',
        share: 'Share',
        apiSettings: 'API Settings',
        copy: 'Copy',
        copied: 'Copied',
        instructionsSamples: 'Samples',
        chooseFiles: 'Choose files',
      },
      deleteDialog: {
        title: 'Delete?',
        content: 'Are you sure to delete <Bold>{{title}}</Bold>?',
      },
      shareDialog: {
        title: 'Share',
        off: {
          content:
            'Link sharing is off, so only you can access this bot through its URL.',
        },
        on: {
          content:
            'Link sharing is on, so ALL users can use this link to conversation.',
        },
      },
      error: {
        notSupportedFile: 'This file is not supported.',
        duplicatedFile: 'A file with the same name has been uploaded.',
      },
    },
    deleteDialog: {
      title: 'Delete?',
      content: 'Are you sure to delete <Bold>{{title}}</Bold>?',
    },
    clearDialog: {
      title: 'Delete ALL?',
      content: 'Are you sure to delete ALL conversations?',
    },
    languageDialog: {
      title: 'Switch language',
    },
    button: {
      newChat: 'New Chat',
      botConsole: 'Bot Console',
      SaveAndSubmit: 'Save & Submit',
      resend: 'Resend',
      regenerate: 'Regenerate',
      delete: 'Delete',
      deleteAll: 'Delete All',
      done: 'Done',
      ok: 'OK',
      cancel: 'Cancel',
      back: 'Back',
      menu: 'Menu',
      language: 'Language',
      clearConversation: 'Delete ALL conversations',
      signOut: 'Sign out',
      close: 'Close',
      add: 'Add',
    },
    input: {
      hint: {
        required: '* Required',
      },
      validationError: {
        required: 'This field is required.',
        invalidOriginFormat: 'Invalid Origin format.',
      },
    },
    error: {
      answerResponse: 'An error occurred while responding.',
      notFoundConversation:
        'Since the specified chat does not exist, a new chat screen is displayed.',
      notFoundPage: 'The page you are looking for is not found.',
      predict: {
        general: 'An error occurred while predicting.',
        invalidResponse:
          'Unexpected response received. The response format does not match the expected format.',
      },
      notSupportedImage: 'The selected model does not support images.',
    },
  },
};

export default translation;
