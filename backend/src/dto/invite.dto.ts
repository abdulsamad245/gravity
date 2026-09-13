export interface InviteResponseDto {
  /** Always true for the UI — delivery issues are logged server-side. */
  ok: true;
  accepted: number;
  /**
   * queued = accepted into the background SMTP queue
   * deferred = no SMTP creds (logged only; still queued for consistent path)
   */
  mode: 'queued' | 'deferred';
}
