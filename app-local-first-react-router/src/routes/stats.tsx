import { useEffect, useState } from 'react';

export default function Stats() {
  const [carcassesCumuleUrl, setCarcassesCumuleUrl] = useState('');
  const [especesUrl, setEspecesUrl] = useState('');
  const [saisiesUrl, setSaisiesUrl] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/stats/nombre-de-carcasses-cumule`)
      .then((res) => res.json())
      .then((data) => {
        setCarcassesCumuleUrl(data.data.carcassesCumuleUrl);
        setEspecesUrl(data.data.especesUrl);
        setSaisiesUrl(data.data.saisiesUrl);
      });
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <title>Statistiques | Zacharie | Ministère de l'Agriculture</title>
      <h1 className="text-3xl font-bold mb-6">Statistiques</h1>

      <section className="space-y-4">
        {carcassesCumuleUrl && (
          <iframe src={carcassesCumuleUrl} className="w-full" height={600} allowTransparency={true} />
        )}
        {saisiesUrl && <iframe src={saisiesUrl} className="w-full" height={600} allowTransparency={true} />}
        {especesUrl && <iframe src={especesUrl} className="w-full" height={600} allowTransparency={true} />}
      </section>
    </main>
  );
}
