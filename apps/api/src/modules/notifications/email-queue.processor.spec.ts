import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { EmailQueueProcessor } from './email-queue.processor';
import { EMAIL_JOB_MENTION } from './notifications.constants';
import type { MentionEmailJobData } from './notification.types';

const mentionData: MentionEmailJobData = {
  to: 'bob@example.com',
  recipientName: 'Bob',
  actorName: 'Alice',
  boardId: 'board-1',
  threadId: 'thread-1',
  commentId: 'comment-1',
  bodyPreview: 'Re @bob take a look',
  frontendUrl: 'http://localhost:3001',
};

const makeJob = (
  name: string,
  data: MentionEmailJobData,
): Job<MentionEmailJobData, void, string> =>
  ({ name, data }) as Job<MentionEmailJobData, void, string>;

describe('EmailQueueProcessor', () => {
  let emailService: jest.Mocked<Pick<EmailService, 'sendMentionEmail'>>;
  let processor: EmailQueueProcessor;

  beforeEach(() => {
    emailService = {
      sendMentionEmail: jest.fn().mockResolvedValue(undefined),
    };
    processor = new EmailQueueProcessor(
      emailService as unknown as EmailService,
    );
  });

  it('sends a mention email with the deep link to the comment thread', async () => {
    await processor.process(makeJob(EMAIL_JOB_MENTION, mentionData));

    expect(emailService.sendMentionEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendMentionEmail).toHaveBeenCalledWith({
      to: 'bob@example.com',
      name: 'Bob',
      actorName: 'Alice',
      bodyPreview: 'Re @bob take a look',
      commentLink: 'http://localhost:3001/boards/board-1?thread=thread-1',
    });
  });

  it('omits the name when the recipient has none', async () => {
    await processor.process(
      makeJob(EMAIL_JOB_MENTION, { ...mentionData, recipientName: null }),
    );

    expect(emailService.sendMentionEmail).toHaveBeenCalledWith({
      to: 'bob@example.com',
      name: undefined,
      actorName: 'Alice',
      bodyPreview: 'Re @bob take a look',
      commentLink: 'http://localhost:3001/boards/board-1?thread=thread-1',
    });
  });

  it('warns and does not send for an unknown job name', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await processor.process(makeJob('unknown', mentionData));

    expect(warn).toHaveBeenCalledWith('Unknown email job name: unknown');
    expect(emailService.sendMentionEmail).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('propagates email delivery failures for BullMQ retries', async () => {
    emailService.sendMentionEmail.mockRejectedValue(new Error('smtp down'));

    await expect(
      processor.process(makeJob(EMAIL_JOB_MENTION, mentionData)),
    ).rejects.toThrow('smtp down');
  });
});
