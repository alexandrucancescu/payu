import { type PaymentStatus } from "./PaymentStatus.js";
import { type Buyer } from "../orders/Buyer.js";
import { Product } from "../orders/Product.js";

export interface PaymentNotification {
  order: NotificationOrder;
  localReceiptDateTime: string;
  properties: Property[];
}

export interface NotificationOrder {
  orderId: string;
  extOrderId: string;
  orderCreateDate: string; // ISO date string, e.g. "2012-12-31T12:00:00"
  notifyUrl: string;
  customerIp: string;
  merchantPosId: string;
  description: string;
  currencyCode: string;
  totalAmount: string;
  buyer: Buyer;
  payMethod: PayMethod;
  products: Product[];
  status: PaymentStatus;
}

export interface PayMethod {
  type: "PBL" | "CARD_TOKEN" | "INSTALLMENTS";
}
export interface Property {
  name: string;
  value: string;
}
