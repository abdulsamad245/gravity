/** Flat mini-layout previews for template cards (no gradients). */
export function TemplatePreview({ preview }: { preview: string }) {
  return (
    <div className={`template-thumb preview-${preview}`} aria-hidden>
      {preview === 'brainstorm' && (
        <>
          <span className="tp-dot d1" />
          <span className="tp-dot d2" />
          <span className="tp-dot d3" />
          <span className="tp-dot d4" />
          <span className="tp-dot d5" />
          <span className="tp-dot d6" />
        </>
      )}
      {preview === 'affinity' && (
        <>
          <span className="tp-cluster c1" />
          <span className="tp-cluster c2" />
          <span className="tp-cluster c3" />
        </>
      )}
      {(preview === 'matrix' || preview === 'swot') && (
        <>
          <span className="tp-cell tl" />
          <span className="tp-cell tr" />
          <span className="tp-cell bl" />
          <span className="tp-cell br" />
        </>
      )}
      {(preview === 'retro' || preview === 'lean' || preview === 'kanban' || preview === 'standup') && (
        <>
          <span className="tp-col" />
          <span className="tp-col" />
          <span className="tp-col" />
        </>
      )}
      {preview === 'sprint' && (
        <>
          <span className="tp-col slim" />
          <span className="tp-col slim" />
          <span className="tp-col slim" />
          <span className="tp-col slim" />
        </>
      )}
      {preview === 'flow' && (
        <>
          <span className="tp-node oval" />
          <span className="tp-node box" />
          <span className="tp-node dia" />
          <span className="tp-node oval end" />
        </>
      )}
      {preview === 'journey' && (
        <>
          <span className="tp-stage" />
          <span className="tp-stage" />
          <span className="tp-stage" />
          <span className="tp-stage" />
        </>
      )}
      {preview === 'swim' && (
        <>
          <span className="tp-lane" />
          <span className="tp-lane" />
          <span className="tp-lane" />
        </>
      )}
    </div>
  );
}
