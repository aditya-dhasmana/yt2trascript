const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:10000";

async function fetchVideoTranscript(videoId) {
  const response = await fetch(`${BACKEND_URL}/api/transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function generateMetadata({ params }) {
  const { videoId } = await params;
  const result = await fetchVideoTranscript(videoId);
  const title = result?.metadata?.title || "YouTube Video Transcript";

  return {
    title: `Transcript of ${title}`,
    description: `Read and download the YouTube transcript for ${title}.`,
    openGraph: {
      title: `Transcript of ${title}`,
      description: `Read and download the YouTube transcript for ${title}.`,
      images: result?.metadata?.thumbnail ? [result.metadata.thumbnail] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `Transcript of ${title}`,
      description: `Read and download the YouTube transcript for ${title}.`,
      images: result?.metadata?.thumbnail ? [result.metadata.thumbnail] : [],
    },
  };
}

export default async function VideoTranscriptPage({ params }) {
  const { videoId } = await params;
  const result = await fetchVideoTranscript(videoId);

  if (!result) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-12 text-zinc-950">
        <section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Transcript unavailable</h1>
          <p className="mt-3 text-zinc-600">
            This video transcript could not be fetched right now. It may be private, removed, region restricted, or captions may be disabled.
          </p>
        </section>
      </main>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: result.metadata.title,
    thumbnailUrl: result.metadata.thumbnail ? [result.metadata.thumbnail] : [],
    uploadDate: result.metadata.publishedAt || undefined,
    description: `Transcript of ${result.metadata.title}`,
  };

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10 text-zinc-950 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[320px_1fr]">
        <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-4">
          <img
            src={result.metadata.thumbnail}
            alt={result.metadata.title}
            className="aspect-video w-full rounded-md bg-zinc-100 object-cover"
          />
          <h1 className="mt-4 text-2xl font-black leading-tight">
            Transcript of {result.metadata.title}
          </h1>
          <p className="mt-3 text-sm text-zinc-600">{result.metadata.channel}</p>
          <a
            className="mt-5 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
            href={`https://www.youtube.com/watch?v=${videoId}`}
          >
            Open Video
          </a>
        </aside>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-bold">Original Transcript</h2>
          <pre className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
            {result.transcript.text}
          </pre>
        </section>
      </article>
    </main>
  );
}
