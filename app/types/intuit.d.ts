declare module 'intuit-oauth' {
  type Env = 'sandbox' | 'production'

  interface OAuthClientOptions {
    clientId: string
    clientSecret: string
    environment: Env
    redirectUri: string
    logging?: boolean | { level?: 'info' | 'error' | 'debug' }
  }

  interface AuthorizeUriOptions {
    scope: string | string[]
    state?: string
    redirectUri?: string
    response_type?: 'code'
  }

  export interface TokenSet {
    token_type: string
    expires_in: number
    access_token: string
    refresh_token: string
    x_refresh_token_expires_in: number
  }

  interface tokenOptions {
    getJson(): Promise<TokenSet>
  }

  export default class OAuthClient {
    constructor(config: OAuthClientOptions)
    authorizeUri<T>(options: AuthorizeUriOptions): T
    createToken(authResponse: { url: string } | string): Promise<tokenOptions>
    refreshUsingToken(refreshToken: string): Promise<tokenOptions>
    getToken(): string
    isAccessTokenValid(): boolean
    makeApiCall(opts: {
      url: string
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      headers?: Record<string, string>
      body?: string
    }): Promise<void>
  }
}
