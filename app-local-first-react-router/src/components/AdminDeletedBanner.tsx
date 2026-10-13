import { Alert } from '@codegouvfr/react-dsfr/Alert';
import dayjs from 'dayjs';

export default function AdminDeletedBanner({
  label,
  deletedAt,
}: {
  label: string;
  deletedAt: Date | string;
}) {
  return (
    <Alert
      severity="error"
      small
      className="mb-4 bg-white"
      description={`${label} le ${dayjs(deletedAt).format('DD/MM/YYYY à HH:mm')}`}
    />
  );
}
