import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CarcasseCertificat, CarcasseCertificatType } from '@prisma/client';
import dayjs from 'dayjs';
import TableResponsive from '@app/components/TableResponsive';
import { Button } from '@codegouvfr/react-dsfr/Button';
import useZustandStore from '@app/zustand/store';

export default function CarcasseSVICertificats() {
  const params = useParams();
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id as string];

  const [certificats, setCertificats] = useState<Array<CarcasseCertificat>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (carcasse.is_synced) {
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
    <div>
      <TableResponsive
        headers={['Type', 'Date de création', 'Annule et remplace', 'Actions']}
        data={certificats.map((certificat) => ({
          id: certificat.certificat_id,
          isSynced: true,
          cols: [
            <>
              {mapCertificatTypeToLabel(certificat.type!)}
              <br />
              {certificat.certificat_id}
            </>,
            dayjs(certificat.created_at).format('DD/MM/YYYY'),
            certificat.remplace_certificat_id
              ? `Annule et remplace ${certificat.remplace_certificat_id}`
              : '',
            <>
              <Button
                nativeButtonProps={{
                  onClick: () => {
                    fetch(`${import.meta.env.VITE_API_URL}/certificat/${certificat.certificat_id}`, {
                      method: 'GET',
                      credentials: 'include',
                      headers: {
                        Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'Content-Type':
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
                  },
                }}
              >
                Télécharger
              </Button>
            </>,
          ],
        }))}
        onCheckboxClick={() => {}}
        checkedItemIds={[]}
      />
      <div className="mt-4"></div>
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
