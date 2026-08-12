export default function Chargement() {
  return (
    <div
      id="chargement"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 px-6 py-12"
    >
      <span className="chargement-halo relative flex size-16 items-center justify-center rounded-full">
        <span
          aria-hidden="true"
          className="chargement-ring"
        />
        <img
          src="/logo_zacharie_solo_small.svg"
          alt=""
          aria-hidden="true"
          className="h-8 w-auto"
        />
      </span>
      <p className="fr-text--sm chargement-label">
        <span className="fr-sr-only">Chargement en cours, </span>Zach'arrive&nbsp;!
      </p>
    </div>
  );
}
