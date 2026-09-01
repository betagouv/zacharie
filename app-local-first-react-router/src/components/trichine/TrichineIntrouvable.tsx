import { Button } from '@codegouvfr/react-dsfr/Button';

/**
 * Référence saisie ou collée qui ne correspond à rien (faute de frappe, référence d'un
 * collègue, objet supprimé). On explique ce qui s'est passé et on propose la suite,
 * plutôt que d'afficher une page vide qui donne l'impression d'un bug.
 */
export default function TrichineIntrouvable({
  objet,
  reference,
  retour,
  basePath,
}: {
  objet: string;
  reference?: string;
  retour: { to: string; label: string };
  basePath: string;
}) {
  return (
    <div className="py-4">
      <title>{`Référence introuvable | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="mx-auto max-w-xl rounded border border-gray-200 bg-white p-8 text-center">
        <span
          className="fr-icon-search-line fr-icon--lg text-gray-400"
          aria-hidden="true"
        />
        <h1 className="fr-h5 fr-mt-2w fr-mb-1w">
          {reference ? (
            <>
              La référence <span className="break-all">{reference}</span> est introuvable
            </>
          ) : (
            `${objet} introuvable`
          )}
        </h1>
        <p className="fr-text--sm fr-mb-3w text-gray-600">
          Vérifiez la référence : elle peut comporter une faute de frappe, appartenir à un autre utilisateur,
          ou avoir été supprimée.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button linkProps={{ to: retour.to }}>{retour.label}</Button>
          <Button
            priority="secondary"
            linkProps={{ to: basePath }}
          >
            Rechercher une référence
          </Button>
        </div>
      </div>
    </div>
  );
}
