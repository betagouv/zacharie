import React from 'react';
import { createModal } from '@codegouvfr/react-dsfr/Modal';

export type TreeNode = {
  [key: string]: string[] | TreeNode;
};

interface HierarchicalDataModalProps {
  data: TreeNode | string[];
  modal: ReturnType<typeof createModal>;
  title: string;
  onItemClick: (item: string) => void;
  skipParent?: boolean;
}

const renderNestedDetails = (
  data: TreeNode | string[],
  onItemClick: (item: string) => void,
  skipParent: boolean = false,
  parent: string = '',
): React.ReactNode => {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <p className="text-sm italic text-gray-500">Aucune donnée disponible</p>;
    }
    return (
      <ul className="ml-4 list-inside list-disc">
        {data.map((item, index) => (
          <li key={index} className="block">
            <button
              type="button"
              onClick={() => {
                if (parent && !skipParent) {
                  onItemClick(`${parent} - ${item}`);
                } else {
                  onItemClick(item);
                }
              }}
              className="!inline text-left hover:underline"
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return Object.entries(data).map(([key, value]) => {
    if (Array.isArray(value) && value.length === 0) {
      return (
        <div key={key} className="mb-2">
          <button
            type="button"
            onClick={() => {
              if (parent) {
                onItemClick(`${parent} - ${key}`);
              } else {
                onItemClick(key);
              }
            }}
            className="!inline text-left hover:underline"
          >
            {key}
          </button>
        </div>
      );
    }
    return (
      <details key={key} className="mb-2">
        <summary className="cursor-pointer font-semibold hover:text-action-high-blue-france focus:outline-hidden">
          {key}
        </summary>
        <div className="ml-4 mt-2">{renderNestedDetails(value, onItemClick, skipParent, key)}</div>
      </details>
    );
  });
};

const ModalTreeDisplay: React.FC<HierarchicalDataModalProps> = ({
  modal,
  data,
  title,
  skipParent,
  onItemClick,
}) => {
  const _onItemClick = (item: string) => {
    onItemClick(item);
    modal.close();
  };

  return (
    <modal.Component
      title={` ${title}`}
      iconId="fr-icon-information-line"
      buttons={[
        {
          doClosesModal: true,
          children: 'Fermer',
        },
      ]}
    >
      <div className="max-h-[70vh] overflow-y-auto p-4">
        {renderNestedDetails(data, _onItemClick, skipParent, '')}
      </div>
    </modal.Component>
  );
};

export default ModalTreeDisplay;
