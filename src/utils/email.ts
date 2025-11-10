import { env } from '../config/env';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using configured email service
 * Currently uses console.log for development, but can be extended to use:
 * - SendGrid
 * - Resend
 * - Nodemailer
 * - AWS SES
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, html, text } = options;

  // In development/test, log the email
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    console.log('\n📧 EMAIL SENT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (text) {
      console.log('Text:', text);
    }
    console.log('HTML:', html);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  // In production, integrate with actual email service
  // Example with SendGrid:
  // import sgMail from '@sendgrid/mail';
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  // await sgMail.send({
  //   to,
  //   from: process.env.EMAIL_FROM!,
  //   subject,
  //   html,
  //   text,
  // });

  // Example with Resend:
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.EMAIL_FROM!,
  //   to,
  //   subject,
  //   html,
  // });

  // For now, log in production too (should be replaced with actual service)
  console.log(`[EMAIL] Sending email to ${to}: ${subject}`);
}
