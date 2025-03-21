import { useEffect, useState } from 'react';

export default function Stats() {
  const [carcassesCumulIframeUrl, setCarcassesCumulIframeUrl] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/stats/nombre-de-carcasses-cumule`)
      .then((res) => res.json())
      .then((data) => setCarcassesCumulIframeUrl(data.data.iframeUrl));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Statistiques</h1>

      <section className="space-y-4">
        {carcassesCumulIframeUrl && (
          <iframe
            src={carcassesCumulIframeUrl}
            frameBorder={0}
            className="w-full"
            height={600}
            allowTransparency
          />
        )}
      </section>
    </main>
  );
}
