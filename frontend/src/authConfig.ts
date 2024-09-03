import { Configuration, PopupRequest } from "@azure/msal-browser";

// Config object to be passed to Msal on creation
export const msalConfig: Configuration = {
    auth: {
        clientId: "1f85072c-d63d-4cf3-9adc-5c5999fcfbf6",
        authority: "https://login.microsoftonline.com/eeb53a15-a2e4-46de-8608-22657ab58979",
        redirectUri: "/",
        postLogoutRedirectUri: "/"
    },
    system: {
        allowNativeBroker: false // Disables WAM Broker
    },
    cache: {
        cacheLocation: "localStorage", 
        storeAuthStateInCookie: false
    }
};

// Add here scopes for id token to be used at MS Identity Platform endpoints.
export const loginRequest: PopupRequest = {
    scopes: ["User.Read"]
};

// Add here the endpoints for MS Graph API services you would like to use.
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
};
