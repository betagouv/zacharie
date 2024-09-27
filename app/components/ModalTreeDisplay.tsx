import React from "react";
import { createModal } from "@codegouvfr/react-dsfr/Modal";

type TreeNode = {
  [key: string]: string[] | TreeNode;
};

interface HierarchicalDataModalProps {
  data: TreeNode;
  modal: ReturnType<typeof createModal>;
  title: string;
  onItemClick: (item: string) => void;
}

const renderNestedDetails = (
  data: TreeNode | string[],
  onItemClick: (item: string) => void,
  parent: string = "",
): React.ReactNode => {
  if (Array.isArray(data)) {
    return (
      <ul className="ml-4 list-inside list-disc">
        {data.map((item, index) => (
          <li key={index} className="block">
            <button
              type="button"
              onClick={() => {
                onItemClick(`${parent} - ${item}`)
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

  return Object.entries(data).map(([key, value]) => (
    <details key={key} className="mb-2">
      <summary className="cursor-pointer font-semibold hover:text-action-high-blue-france focus:outline-none">
        {key}
      </summary>
      <div className="ml-4 mt-2">{renderNestedDetails(value, onItemClick, key)}</div>
    </details>
  ));
};

const ModalTreeDisplay: React.FC<HierarchicalDataModalProps> = ({ modal, data, title, onItemClick }) => {
  const _onItemClick = (item: string) => {
    onItemClick(item);
    modal.close();
  }

  return (
    <modal.Component
      title={title}
      iconId="fr-icon-information-line"
      buttons={[
        {
          doClosesModal: true,
          children: "Fermer",
        },
      ]}
    >
      <div className="max-h-[70vh] overflow-y-auto p-4">{renderNestedDetails(data, _onItemClick, "")}</div>
    </modal.Component>
  );
};

export default ModalTreeDisplay;
