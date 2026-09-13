import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const b64 = fs.readFileSync(path.join(__dirname, 'mark-email-b64.txt'), 'utf8').trim();
const invitePath = path.resolve(__dirname, '../../backend/src/services/email/invite-template.ts');
let src = fs.readFileSync(invitePath, 'utf8');

const img = `<img src="data:image/png;base64,${b64}" width="36" height="36" alt="" style="display:block;border:0"/>`;
const replaced = src.replace(
  /<div style="width:36px;height:36px;line-height:0" aria-hidden="true">[\s\S]*?<\/div>/,
  `<div style="width:36px;height:36px;line-height:0" aria-hidden="true">\n            ${img}\n          </div>`,
);

if (replaced === src) {
  console.error('Could not find brand mark block in invite-template.ts');
  process.exit(1);
}

fs.writeFileSync(invitePath, replaced);
console.log('Updated invite-template.ts with embedded mark');
