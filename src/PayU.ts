import crypto from "crypto";
import ky, { HTTPError, type KyInstance } from "ky";
import { OAuth } from "./auth/OAuth.js";
import { OrderCreateResponse } from "./orders/OrderCreateResponse.js";
import { Order } from "./orders/Order.js";
import { OrderEndpoint } from "./endpoints.js";
import { PayUError } from "./errors/PayUError.js";
import { OrderStatusResponse } from "./orders/OrderStatusResponse.js";
import { SandboxIPs, ProductionIPs } from "./ips.js";

const SANDBOX_ENDPOINT = "https://secure.snd.payu.com";
const PRODUCTION_ENDPOINT = "https://secure.payu.com";

export interface PayUOptions {
  sandbox?: boolean;
}

export class PayU {
  private readonly baseEndpoint: string;
  private readonly client: KyInstance;
  private oAuth: OAuth;
  private ips: string[];

  /**
   * Creates an instance of PayU.
   * @param {number} clientId - client id for merchant
   * @param {string} clientSecret - client secret from panel
   * @param {number} merchantPosId - pos id from panel
   * @param {string} secondKey - second key from panel
   * @param {PayUOptions} [options={ sandbox: false }] - additional options
   * @memberof PayU
   */
  constructor(
    private readonly clientId: number,
    private readonly clientSecret: string,
    private readonly merchantPosId: number,
    private readonly secondKey: string,
    private readonly options: PayUOptions = { sandbox: false },
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.merchantPosId = merchantPosId;
    this.secondKey = secondKey;
    this.options = options;

    this.baseEndpoint = !this.options.sandbox
      ? PRODUCTION_ENDPOINT
      : SANDBOX_ENDPOINT;
    this.ips = !this.options.sandbox
      ? ProductionIPs
      : SandboxIPs;
    this.client = ky.create({ prefixUrl: this.baseEndpoint });

    this.oAuth = new OAuth(
      this.client,
      this.clientId,
      this.clientSecret,
    );
  }

  /**
   * Get access token
   *
   * @returns {Promise<string>}
   * @throws {AuthenticationError}
   * @memberof PayU
   */
  public async getAccessToken(): Promise<string> {
    return this.oAuth.getAccessToken();
  }

  /**
   * Create a new order
   *
   * @param {Order} order - order to be created
   * @returns {Promise<OrderCreateResponse>}
   * @throws {PayUError}
   * @memberof PayU
   */
  public async createOrder(
    order: Order,
  ): Promise<OrderCreateResponse> {
    const token = await this.oAuth.getAccessToken();
    const data = {
      ...order,
      merchantPosId: this.merchantPosId,
    };
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const response = await this.client.post(OrderEndpoint, {
      json: data,
      headers: headers,
      redirect: "manual",
      throwHttpErrors: false,
    });

    if (![200, 201, 302].includes(response.status)) {
      const resp = <OrderStatusResponse>await response.json();
      throw new PayUError(
        resp.status.statusCode,
        resp.status.code || "",
        resp.status.codeLiteral,
        resp.status.statusDesc,
      );
    }

    return response.json<OrderCreateResponse>();
  }

  /**
   * Captures an order from payU making it approved
   *
   * @param {string} orderId
   * @returns {Promise<OrderStatusResponse>}
   * @throws {PayUError}
   * @memberof PayU
   */
  public async captureOrder(
    orderId: string,
  ): Promise<OrderStatusResponse> {
    const token = await this.oAuth.getAccessToken();
    const data = {
      orderId: orderId,
      orderStatus: "COMPLETED",
    };
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      return this.client
        .put(`${OrderEndpoint}/${orderId}/status`, {
          json: data,
          headers: headers,
        })
        .json<OrderStatusResponse>();
    } catch (error) {
      if (error instanceof HTTPError) {
        const resp = <OrderStatusResponse>(
          await error.response?.json()
        );

        throw new PayUError(
          resp.status.statusCode,
          resp.status.code || "",
          resp.status.codeLiteral,
          resp.status.statusDesc,
        );
      }

      throw error;
    }
  }

  /**
   * Cancels a PayU order
   *
   * @param {string} orderId
   * @returns {Promise<OrderStatusResponse>}
   * @memberof PayU
   */
  public async cancelOrder(
    orderId: string,
  ): Promise<OrderStatusResponse> {
    const token = await this.oAuth.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      return this.client
        .delete(`${OrderEndpoint}/${orderId}`, {
          headers: headers,
        })
        .json<OrderStatusResponse>();
    } catch (error) {
      if (error instanceof HTTPError) {
        const resp = <OrderStatusResponse>(
          await error.response?.json()
        );
        throw new PayUError(
          resp.status.statusCode,
          resp.status.code || "",
          resp.status.codeLiteral,
          resp.status.statusDesc,
        );
      }

      throw error;
    }
  }

  /**
   * Refunds a PayU order
   *
   * @param {string} orderId - payu order id
   * @param {string} description - description for refund
   * @returns {Promise<OrderStatusResponse>}
   * @memberof PayU
   */
  public async refundOrder(
    orderId: string,
    description: string,
  ): Promise<OrderStatusResponse> {
    const token = await this.oAuth.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      return this.client
        .post(`${OrderEndpoint}/${orderId}/refund`, {
          json: {
            refund: {
              description,
            },
          },
          headers: headers,
        })
        .json<OrderStatusResponse>();
    } catch (error) {
      if (error instanceof HTTPError) {
        const resp = <OrderStatusResponse>(
          await error.response?.json()
        );
        throw new PayUError(
          resp.status.statusCode,
          resp.status.code || "",
          resp.status.codeLiteral,
          resp.status.statusDesc,
        );
      }

      throw error;
    }
  }

  /**
   * Convert a key=value; list to json
   *
   * @private
   * @param {string} data - key value string
   * @returns {Record<string, string>}
   * @memberof PayU
   */
  private parseHeaderToJson(
    data: string,
  ): Record<string, string> {
    return data.split(";").reduce(
      (acc, curr) => {
        if (curr) {
          const [key, val] = curr.split("=");
          acc[key] = val;
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * Verify notification result with signature
   *
   * @param {string} payuHeader - header string from **OpenPayu-Signature**
   * @param {string} jsonNotification - notification body as a string
   * @returns {boolean}
   * @memberof PayU
   */
  public verifyNotification(
    payuHeader: string,
    jsonNotification: string,
  ): boolean {
    const tokens = this.parseHeaderToJson(payuHeader);
    if (
      !tokens["signature"] ||
      tokens["signature"] === "" ||
      !tokens["algorithm"] ||
      tokens["algorithm"] === ""
    ) {
      return false;
    }

    const concatnated = jsonNotification + this.secondKey;
    const exceptedSignature = crypto
      .createHash("md5")
      .update(concatnated)
      .digest("hex");
    const incomingSignature = tokens["signature"];

    return exceptedSignature === incomingSignature;
  }

  /**
   * Validates the IP address with PayU servers
   *
   * @param {string} ip - ip address
   * @returns {boolean}
   * @memberof PayU
   */
  public isIpValid(ip: string): boolean {
    return this.ips.includes(ip);
  }
}
