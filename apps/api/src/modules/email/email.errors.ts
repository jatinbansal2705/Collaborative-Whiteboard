export class EmailDeliveryError extends Error {
  constructor(message = 'Email delivery failed') {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

export const emailDeliveryFailed = (): EmailDeliveryError =>
  new EmailDeliveryError();
