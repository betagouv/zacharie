import API from '@app/services/api';
import { useEffect, useState } from 'react';

export default function Stats() {
  const [carcassesCumuleUrl, setCarcassesCumuleUrl] = useState('');
  const [especesUrl, setEspecesUrl] = useState('');
  const [saisiesUrl, setSaisiesUrl] = useState('');

  useEffect(() => {
    API.get({
      path: 'stats/nombre-de-carcasses-cumule',
    }).then((data) => {
      setCarcassesCumuleUrl(data.data.carcassesCumuleUrl);
      setEspecesUrl(data.data.especesUrl);
      setSaisiesUrl(data.data.saisiesUrl);
    });
  }, []);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <title>Statistiques | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <h1 className="mb-6 text-3xl font-bold">Statistiques</h1>

      <section className="space-y-4">
        {especesUrl && <iframe src={especesUrl} className="w-full" height={600} allowTransparency={true} />}
        {carcassesCumuleUrl && (
          <iframe src={carcassesCumuleUrl} className="w-full" height={600} allowTransparency={true} />
        )}
        {saisiesUrl && <iframe src={saisiesUrl} className="w-full" height={600} allowTransparency={true} />}
      </section>
    </main>
  );
}
