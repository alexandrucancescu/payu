/**
 * Buyer
 *
 * @export
 * @interface Buyer
 */
export interface Buyer {
  extCustomerId?: string;

  /**
   * Buyer's email address
   *
   * @type {string}
   * @memberof Buyer
   */
  email: string;

  /**
   * Buyer's first name
   *
   * @type {string}
   * @memberof Buyer
   */
  firstName?: string;

  /**
   * Buyer's last name
   *
   * @type {string}
   * @memberof Buyer
   */
  lastName?: string;

  /**
   * Buyer's telephone number
   *
   * @type {string}
   * @memberof Buyer
   */
  phone?: string;

  /**
   * Buyer's language
   *
   * @type {string}
   * @memberof Buyer
   */
  language?: string;

  delivery?: {
    postalCode?: string;
    city?: string;
    countryCode?: string;
    state?: string;
    street?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
  };
}
