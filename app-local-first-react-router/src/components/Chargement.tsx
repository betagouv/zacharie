export default function Chargement() {
  return (
    <div
      id="chargement"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-1 px-6 py-12"
    >
      <img
        src="/logo_zacharie_solo_small.svg"
        alt=""
        aria-hidden="true"
        className="chargement-pulse h-12 w-auto grayscale"
      />
      <p className="fr-text--sm chargement-label mb-0 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="chargement-spinner"
        />
        <span className="fr-sr-only text-black">Chargement en cours, </span>Zach'arrive&nbsp;!
      </p>
    </div>
  );
}
