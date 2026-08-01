import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { emailDeliveryFailed } from './email.errors';
import {
  passwordResetEmailSubject,
  renderPasswordResetEmail,
  renderVerificationEmail,
  verificationEmailSubject,
} from './email-templates';
import {
  EmailService,
  type SendPasswordResetEmailOptions,
  type SendVerificationEmailOptions,
} from './email.service';

@Injectable()
export class NodemailerEmailService extends EmailService {
  private readonly logger = new Logger(NodemailerEmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(configService: ConfigService) {
    super();
    const host = configService.get<string>('smtp.host');
    this.from =
      configService.get<string>('smtp.from') ??
      'Collaborative Whiteboard <no-reply@example.com>';

    if (host === undefined || host === '') {
      this.transporter = null;
      return;
    }

    const user = configService.get<string>('smtp.user');
    const pass = configService.get<string>('smtp.pass');
    this.transporter = createTransport({
      host,
      port: configService.get<number>('smtp.port') ?? 587,
      secure: configService.get<boolean>('smtp.secure') ?? false,
      auth:
        user === undefined || pass === undefined ? undefined : { user, pass },
    });
  }

  async sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<void> {
    await this.send(
      options.to,
      verificationEmailSubject(),
      renderVerificationEmail({
        name: options.name,
        link: options.verificationLink,
      }),
    );
  }

  async sendPasswordResetEmail(
    options: SendPasswordResetEmailOptions,
  ): Promise<void> {
    await this.send(
      options.to,
      passwordResetEmailSubject(),
      renderPasswordResetEmail({
        name: options.name,
        link: options.resetLink,
      }),
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (this.transporter === null) {
      this.logger.warn(
        `SMTP is not configured; skipping email to ${to} (subject: ${subject})`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to} (subject: ${subject})`,
        error instanceof Error ? error.stack : String(error),
      );
      throw emailDeliveryFailed();
    }
  }
}
