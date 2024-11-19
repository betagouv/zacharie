export default function BreadcrumbCustom() {
  return (
    <nav
      id="fr-breadcrumb-:r0:"
      role="navigation"
      className="fr-breadcrumb"
      aria-label="vous êtes ici :"
      data-fr-js-breadcrumb="true"
    >
      <button
        className="fr-breadcrumb__button"
        aria-expanded="false"
        aria-controls="breadcrumb-:r1:"
        data-fr-js-collapse-button="true"
      >
        Voir le fil d’Ariane
      </button>
      <div className="fr-collapse" id="breadcrumb-:r1:" data-fr-js-collapse="true">
        <ol className="fr-breadcrumb__list">
          <li>
            <a href="/" className="fr-breadcrumb__link">
              Accueil
            </a>
          </li>
          <li>
            <a href="/segment-1" className="fr-breadcrumb__link">
              Segment 1
            </a>
          </li>
          <li>
            <a href="/segment-1/segment-2" className="fr-breadcrumb__link">
              Segment 2
            </a>
          </li>
          <li>
            <a href="/segment-1/segment-2/segment-3" className="fr-breadcrumb__link">
              Segment 3
            </a>
          </li>
          <li>
            <a href="/segment-1/segment-2/segment-3/segment-4" className="fr-breadcrumb__link">
              Segment 4
            </a>
          </li>
          <li>
            <a className="fr-breadcrumb__link" aria-current="page">
              Page Actuelle
            </a>
          </li>
        </ol>
      </div>
    </nav>
  );
}
