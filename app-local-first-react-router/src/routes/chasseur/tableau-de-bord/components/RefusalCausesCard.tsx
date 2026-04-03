import { Tooltip } from '@codegouvfr/react-dsfr/Tooltip';

interface RefusalCause {
  label: string;
  count: number;
}

interface RefusalCausesCardProps {
  causes: RefusalCause[];
}

export default function RefusalCausesCard({ causes }: RefusalCausesCardProps) {
  return (
    <div className="col-span-2 flex flex-col rounded-3xl bg-white p-6 shadow-sm md:col-span-1">
      <div className="text-action-high-blue-france-light mb-4 text-xl font-bold">
        Causes de refus fréquents
      </div>
      <div className="space-y-3">
        {causes.slice(0, 3).map((cause, index) => (
          <div
            key={index}
            className="text-action-high-blue-france-light flex flex-row items-center justify-between"
          >
            <span className="text-base font-bold">{cause.count}</span>
            <span className="ml-3 flex-1 text-base">{cause.label}</span>
          </div>
        ))}
        {causes.length === 0 && <div className="italic">Aucune raison de refus trouvée</div>}
      </div>
      <div className="mt-auto flex justify-center">
        <Tooltip
          style={{ textAlign: 'center' }}
          kind="hover"
          title="Principales raisons de refus des carcasses de grand gibier sauvage lors du contrôle sanitaire."
        />
      </div>
    </div>
  );
}
