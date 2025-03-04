import dayjs from "dayjs";
import { HTTPError, type KyInstance } from "ky";
import { AuthenticationResponse } from "./Authentication.js";
import { AuthorizeEndpoint } from "../endpoints.js";
import { AuthenticationErrorResponse } from "./AuthenticationErrorResponse.js";
import { AuthenticationError } from "../errors/AuthenticationError.js";

export class OAuth {
  private accessToken: string;
  private expiry: Date;

  /**
   *Creates an instance of OAuth.
   * @param {KyInstance} client - configured axios client for proper backend
   * @param {number} clientId - client id
   * @param {string} clientSecret - client secret
   * @memberof OAuth
   */
  constructor(
    private readonly client: KyInstance,

    private readonly clientId: number,
    private readonly clientSecret: string,
  ) {
    // initialize the authenticater to have invalidated expiry date
    // so it will fetch new one on first try
    this.expiry = dayjs().subtract(1, "minute").toDate();
    this.accessToken = "";
  }

  private async _fetchAccessToken(): Promise<AuthenticationResponse> {
    const data = {
      grant_type: "client_credentials",
      client_id: this.clientId.toString(),
      client_secret: this.clientSecret,
    };

    try {
      return await this.client
        .post(AuthorizeEndpoint, {
          body: new URLSearchParams(data),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
        .json<AuthenticationResponse>();
    } catch (error) {
      this.accessToken = "";
      this.expiry = dayjs().subtract(1, "minute").toDate();

      const errors = error as Error | HTTPError;

      if (errors instanceof HTTPError) {
        const errResponse = <AuthenticationErrorResponse>(
          await errors.response?.json()
        );
        throw new AuthenticationError(
          errResponse.error,
          errResponse.error_description,
        );
      }

      throw error;
    }
  }

  /**
   * Get access token from PayU service
   *
   * @returns {Promise<string>} - access token
   * @throws {AuthenticationError}
   * @memberof OAuth
   */
  public async getAccessToken(): Promise<string> {
    // valid token(valid for 99%)
    if (
      dayjs().isBefore(this.expiry, "seconds") &&
      this.accessToken !== ""
    ) {
      return this.accessToken;
    }

    const token = await this._fetchAccessToken();
    this.accessToken = token.access_token;
    this.expiry = dayjs()
      .add(token.expires_in, "seconds")
      .toDate();

    return this.accessToken;
  }
}
