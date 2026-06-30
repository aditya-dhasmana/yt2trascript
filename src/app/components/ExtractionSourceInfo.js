import { getExtractionSource } from "../../lib/extractionSources";

export default function ExtractionSourceInfo({ mode, compact = false }) {
  const source = getExtractionSource(mode);
  if (!source) return null;

  return (
    <section className={`rounded-md border border-emerald-200 bg-emerald-50 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
          Extraction source: {source.mode}
        </p>
        <span className="rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white">
          Backend YouTube fetch: {source.backendYouTubeFetch ? "Yes" : "No"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-emerald-950 sm:grid-cols-2">
        <div>
          <dt className="font-semibold">YouTube fetch</dt>
          <dd>{source.youtubeFetch}</dd>
        </div>
        {source.renderUsage && (
          <div>
            <dt className="font-semibold">Render used</dt>
            <dd>{source.renderUsage}</dd>
          </div>
        )}
        {source.blockingRisk && (
          <div>
            <dt className="font-semibold">Blocking risk</dt>
            <dd>{source.blockingRisk}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs leading-5 text-emerald-900">{source.message}</p>
    </section>
  );
}
