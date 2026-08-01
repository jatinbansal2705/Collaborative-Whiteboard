export interface SendVerificationEmailOptions {
  to: string;
  name?: string;
  verificationLink: string;
}

export interface SendPasswordResetEmailOptions {
  to: string;
  name?: string;
  resetLink: string;
}

export abstract class EmailService {
  abstract sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<void>;

  abstract sendPasswordResetEmail(
    options: SendPasswordResetEmailOptions,
  ): Promise<void>;
}
