export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
        };
      };

      picker: GooglePickerNamespace;
    };

    gapi?: {
      load: (libraries: string, callback: () => void) => void;
    };
  }

  interface GoogleTokenResponse {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  }

  interface GoogleTokenClient {
    requestAccessToken: (options?: { prompt?: string }) => void;
  }

  interface GooglePickerNamespace {
    PickerBuilder: new () => GooglePickerBuilder;

    View: new (viewId: string) => GooglePickerView;

    DocsView: new (viewId: string) => GooglePickerView;

    ViewId: {
      DOCS: string;
    };

    Feature: {
      MULTISELECT_ENABLED: string;
      NAV_HIDDEN: string;
    };

    Action: {
      PICKED: string;
      CANCEL: string;
    };

    Response: {
      DOCUMENTS: string;
    };

    Document: {
      ID: string;
      NAME: string;
      MIME_TYPE: string;
      SIZE_BYTES: string;
      URL: string;
    };
  }

  interface GooglePickerView {
    setMimeTypes: (mimeTypes: string) => GooglePickerView;
    setIncludeFolders: (included: boolean) => GooglePickerView;
    setSelectFolderEnabled: (enabled: boolean) => GooglePickerView;
  }

  interface GooglePickerBuilder {
    enableFeature: (feature: string) => GooglePickerBuilder;
    setDeveloperKey: (key: string) => GooglePickerBuilder;
    setAppId: (appId: string) => GooglePickerBuilder;
    setOAuthToken: (token: string) => GooglePickerBuilder;
    addView: (view: GooglePickerView | string) => GooglePickerBuilder;
    setCallback: (callback: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
    setTitle: (title: string) => GooglePickerBuilder;
    build: () => GooglePicker;
  }

  interface GooglePicker {
    setVisible: (visible: boolean) => void;
    dispose: () => void;
  }

  interface GooglePickerDocument {
    [key: string]: string | number | undefined;
  }

  interface GooglePickerResponse {
    action: string;
    [key: string]: unknown;
  }
}
