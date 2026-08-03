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

export interface SendMentionEmailOptions {
  to: string;
  name?: string;
  actorName: string | null;
  bodyPreview: string;
  commentLink: string;
}

export abstract class EmailService {
  abstract sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<void>;

  abstract sendPasswordResetEmail(
    options: SendPasswordResetEmailOptions,
  ): Promise<void>;

  abstract sendMentionEmail(options: SendMentionEmailOptions): Promise<void>;
}
