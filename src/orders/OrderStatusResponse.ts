import { Status } from "./Status.js";

export interface OrderStatusResponse {
  status: Status;
  orderId?: string;
  extOrderId?: string;
}
