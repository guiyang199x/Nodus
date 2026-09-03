import 'server-only';

import { Resend } from 'resend';

import type { WorkspaceRole } from '@knowledge/domain';

export type InvitationEmail = {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  acceptUrl: string;
  expiresAt: string;
};

export interface InvitationMailer {
  send(input: InvitationEmail): Promise<void>;
}

const ROLE_LABELS: Record<Exclude<WorkspaceRole, 'owner'>, string> = {
  admin: '管理员',
  editor: '编辑者',
  viewer: '只读成员',
};

/** Plain text only: the invitation carries a one-time token, not marketing. */
function composeMessage(input: InvitationEmail) {
  return {
    subject: `${input.inviterName} 邀请你加入 ${input.workspaceName}`,
    text: [
      `${input.inviterName} 邀请你以${ROLE_LABELS[input.role]}身份加入 ${input.workspaceName}。`,
      `请在 ${input.expiresAt} 前使用一次性链接接受邀请：`,
      input.acceptUrl,
    ].join('\n\n'),
  };
}

function createResendMailer(apiKey: string): InvitationMailer {
  const resend = new Resend(apiKey);
  return {
    async send(input) {
      const { error } = await resend.emails.send({
        from: process.env.INVITATION_EMAIL_FROM!,
        to: input.to,
        ...composeMessage(input),
      });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Local development has no Resend key. Rather than making invitations
 * untestable, or logging a one-time token where it would land in server logs,
 * the message goes to the same local mail catcher that already receives
 * sign-in email. Read it at http://127.0.0.1:54324.
 */
function createLocalSmtpMailer(): InvitationMailer {
  return {
    async send(input) {
      const { createTransport } = await import('nodemailer');
      const transport = createTransport({
        host: process.env.LOCAL_SMTP_HOST ?? '127.0.0.1',
        port: Number(process.env.LOCAL_SMTP_PORT ?? 54325),
        secure: false,
        ignoreTLS: true,
      });
      await transport.sendMail({
        from: process.env.INVITATION_EMAIL_FROM ?? '知识工作台 <invites@example.test>',
        to: input.to,
        ...composeMessage(input),
      });
    },
  };
}

export function createInvitationMailer(): InvitationMailer {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? createResendMailer(apiKey) : createLocalSmtpMailer();
}
