import { APP_NAME } from '../../constants/app.constants';

export interface InviteEmailModel {
  inviterName: string;
  roomTitle: string;
  roomUrl: string;
  roomId: string;
  /** Optional external voice/video call link (Meet / Zoom / Discord…). */
  callUrl?: string;
}

/** Inline brand mark (email-safe data URI — no external image required). */
function brandMarkHtml(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0">
      <tr>
        <td style="vertical-align:middle;padding-right:12px">
          <div style="width:36px;height:36px;line-height:0" aria-hidden="true">
            <img src="data:image/png;base64,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" width="36" height="36" alt="" style="display:block;border:0"/>
          </div>
        </td>
        <td style="vertical-align:middle;font-family:'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.04em;color:#12141a">${APP_NAME}</td>
      </tr>
    </table>`;
}

/**
 * Build invite subject/text/html.
 * When `callUrl` is set, adds a Join call section (URL already validated upstream).
 */
export function buildInviteEmail(model: InviteEmailModel): { subject: string; text: string; html: string } {
  const subject = `${model.inviterName} invited you to “${model.roomTitle}” on ${APP_NAME}`;
  const callUrl = model.callUrl?.trim() || '';
  const textLines = [
    `${model.inviterName} invited you to collaborate in "${model.roomTitle}" on ${APP_NAME}.`,
    '',
    `Open the room: ${model.roomUrl}`,
    `Room id: ${model.roomId}`,
  ];
  if (callUrl) {
    textLines.push('', `Join the live call: ${callUrl}`);
  }
  textLines.push('', `- ${APP_NAME}`);
  const text = textLines.join('\n');

  const callHtml = callUrl
    ? `
          <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#5c6475">
            There’s also a live call for this room:
          </p>
          <p style="margin:10px 0 0">
            <a href="${escapeAttr(callUrl)}"
               style="display:inline-block;background:#12141a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:999px">
              Join call
            </a>
          </p>
          <p style="margin:12px 0 0;font-size:12px;line-height:1.45;color:#8b929e;word-break:break-all">
            Or paste this call link:<br/>
            <a href="${escapeAttr(callUrl)}" style="color:#3d8bfd">${escapeHtml(callUrl)}</a>
          </p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#e8eaef;font-family:'Segoe UI',Arial,sans-serif;color:#12141a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8eaef;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #d5d9e2">
        <tr><td>
          ${brandMarkHtml()}
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;letter-spacing:-0.02em">You’re invited to a room</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#5c6475">
            <strong style="color:#12141a">${escapeHtml(model.inviterName)}</strong>
            invited you to collaborate in
            <strong style="color:#12141a">“${escapeHtml(model.roomTitle)}”</strong>
            on ${APP_NAME}.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5c6475">
            Jump in with sticky notes, shapes, physics, and live presence. No install needed.
          </p>
          <a href="${escapeAttr(model.roomUrl)}"
             style="display:inline-block;background:#ff5c33;color:#12141a;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:999px">
            Open room
          </a>
          <p style="margin:28px 0 0;font-size:12px;line-height:1.45;color:#8b929e;word-break:break-all">
            Or paste this link:<br/>
            <a href="${escapeAttr(model.roomUrl)}" style="color:#3d8bfd">${escapeHtml(model.roomUrl)}</a>
          </p>
          ${callHtml}
          <p style="margin:16px 0 0;font-size:11px;color:#9aa1b2">Room #${escapeHtml(model.roomId)}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9aa1b2">${APP_NAME}: ideas with mass</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
