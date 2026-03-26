import { Button } from '@codegouvfr/react-dsfr/Button';
const DASHBOARD_URL = 'https://metabase.zacharie.beta.gouv.fr/public/dashboard/45c24085-9a52-4357-afe6-419bd8542f20';

export default function Stats() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <title>Statistiques | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Statistiques</h1>
        <Button
          className="m-0"
          priority={'tertiary'}
          linkProps={{
            to: '/stats/matrice-impact',
          }}
        >
          Voir la matrice d'impact
        </Button>
      </div>
      <section className="space-y-4">
        <iframe src={DASHBOARD_URL} className="w-full" height={1900} allowTransparency={true} />
      </section>
    </main>
  );
}
