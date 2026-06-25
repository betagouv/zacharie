import type { ReactNode } from 'react';

export default function FichesEmptyState({
  iconId = 'fr-icon-inbox-2-line',
  title,
  description,
  action,
}: {
  iconId?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="fr-container">
      <div className="fr-my-7w mx-auto flex max-w-md flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
        <div className="text-action-high-blue-france mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8EDFF]">
          <span
            className={`${iconId} fr-icon--lg`}
            aria-hidden="true"
          />
        </div>
        <h2 className="fr-h5 mb-2 font-bold text-gray-800">{title}</h2>
        <p className="fr-text--regular mb-6 max-w-sm text-gray-600">{description}</p>
        {action}
      </div>
    </div>
  );
}
