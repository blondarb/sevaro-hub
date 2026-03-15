import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'us-east-2' });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyToken(token);
  if (!user?.isAdmin) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { to, appName, resolutionNote, summary } = body;

  if (!to) {
    return NextResponse.json({ error: 'Recipient email required' }, { status: 400 });
  }

  const subject = `Your feedback on ${appName || 'Sevaro'} has been addressed`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Feedback Update</h2>
      <p style="color: #374151; line-height: 1.6;">
        Thank you for your feedback on <strong>${appName || 'Sevaro'}</strong>. We wanted to let you know that your feedback has been reviewed and addressed.
      </p>
      ${summary ? `
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 0.85rem; margin: 0 0 4px 0; font-weight: 600;">Your feedback:</p>
          <p style="color: #374151; margin: 0; line-height: 1.5;">${summary}</p>
        </div>
      ` : ''}
      ${resolutionNote ? `
        <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981;">
          <p style="color: #065f46; font-size: 0.85rem; margin: 0 0 4px 0; font-weight: 600;">Resolution:</p>
          <p style="color: #374151; margin: 0; line-height: 1.5;">${resolutionNote}</p>
        </div>
      ` : ''}
      <p style="color: #6b7280; font-size: 0.85rem; margin-top: 24px;">
        &mdash; Sevaro Team
      </p>
    </div>
  `;

  try {
    await ses.send(new SendEmailCommand({
      Source: 'feedback@neuroplans.app',
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
          Text: { Data: `Your feedback on ${appName || 'Sevaro'} has been addressed.\n\n${resolutionNote ? `Resolution: ${resolutionNote}` : ''}\n\nSession: ${id}` },
        },
      },
    }));

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('SES send error:', err);
    return NextResponse.json(
      { error: 'Failed to send email', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
