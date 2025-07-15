import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CarcasseCertificat, CarcasseCertificatType } from '@prisma/client';
import dayjs from 'dayjs';
import { Button } from '@codegouvfr/react-dsfr/Button';
import useZustandStore from '@app/zustand/store';

type Certificat = CarcasseCertificat & { remplace_par_certificat_id: string };

export default function CarcasseSVICertificats() {
  const params = useParams();
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id as string];

  const [certificats, setCertificats] = useState<Array<Certificat>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (carcasse.is_synced) {
      setIsLoading(true);
      fetch(`${import.meta.env.VITE_API_URL}/certificat/${params.zacharie_carcasse_id}/all`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          setCertificats(data);
          setIsLoading(false);
        });
    }
  }, [params.zacharie_carcasse_id, carcasse.is_synced, carcasse.svi_ipm1_date, carcasse.svi_ipm2_date]);

  if (isLoading) {
    return <p>Chargement des certificats...</p>;
  }

  if (certificats.length === 0) {
    return <p>Aucun certificat encore généré</p>;
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {certificats.map((certificat) => (
        <CertificatCard key={certificat.certificat_id} certificat={certificat} />
      ))}
    </div>
  );
}

function CertificatCard({ certificat }: { certificat: Certificat }) {
  const handleDownload = () => {
    fetch(`${import.meta.env.VITE_API_URL}/certificat/${certificat.certificat_id}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = mapCertificatTypeToDocName(certificat)!;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      });
  };

  return (
    <div
      className={[
        'flex basis-full flex-row items-center justify-between border border-solid border-gray-200 bg-white text-left',
        certificat.remplace_par_certificat_id && 'opacity-50',
      ].join(' ')}
    >
      <button type="button" className="flex flex-1 flex-col p-4 text-left" onClick={handleDownload}>
        <p className="order-1 text-base font-bold">{mapCertificatTypeToLabel(certificat.type!)}</p>
        <p className="order-2 text-sm/4 font-medium text-gray-600">N° {certificat.certificat_id}</p>
        <p className="order-3 text-sm/4 text-gray-500">{dayjs(certificat.created_at).format('DD/MM/YYYY')}</p>
        {certificat.remplace_par_certificat_id && (
          <p className="order-4 text-sm/4 text-gray-500">
            Remplacé par {certificat.remplace_par_certificat_id}
          </p>
        )}
        {certificat.remplace_certificat_id && (
          <p className="order-4 text-sm/4 text-gray-500">
            Annule et remplace {certificat.remplace_certificat_id}
          </p>
        )}
      </button>
      <div className="flex flex-row gap-2 pr-4">
        <Button
          type="button"
          iconId="fr-icon-download-line"
          onClick={handleDownload}
          title="Télécharger le certificat"
          priority="tertiary no outline"
        />
      </div>
    </div>
  );
}

function mapCertificatTypeToLabel(type: CarcasseCertificatType) {
  switch (type) {
    case CarcasseCertificatType.CC:
      return 'Certificat de consigne';
    case CarcasseCertificatType.CSP:
      return 'Certificat de saisie partielle';
    case CarcasseCertificatType.CST:
      return 'Certificat de saisie totale';
    case CarcasseCertificatType.LC:
      return 'Certificat de levée de consigne';
    case CarcasseCertificatType.LPS:
      return 'Laissez-passer sanitaire';
  }
}

function mapCertificatTypeToDocName(certificat: CarcasseCertificat) {
  switch (certificat.type) {
    case CarcasseCertificatType.CC:
      return `consigne-${certificat.certificat_id}.docx`;
    case CarcasseCertificatType.CSP:
      return `saisie-partielle-${certificat.certificat_id}.docx`;
    case CarcasseCertificatType.CST:
      return `saisie-totale-${certificat.certificat_id}.docx`;
    case CarcasseCertificatType.LC:
      return `levée-consigne-${certificat.certificat_id}.docx`;
    case CarcasseCertificatType.LPS:
      return `laissez-passer-sanitaire-${certificat.certificat_id}.docx`;
  }
}
