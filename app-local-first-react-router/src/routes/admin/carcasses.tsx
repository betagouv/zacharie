import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import dayjs from 'dayjs';
import type { AdminCarcassesResponse } from '@api/src/types/responses';
import type { Carcasse } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';

export default function AdminCarcasses() {
  const [carcasses, setCarcasses] = useState<Array<Carcasse>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };
    if (searchQuery.trim()) {
      query.search = searchQuery.trim();
    }
    API.get({ path: 'admin/carcasses', query })
      .then((res) => res as AdminCarcassesResponse)
      .then((res) => {
        if (res.ok) {
          setCarcasses(res.data.carcasses);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [page, searchQuery]);

  const totalPages = Math.ceil(total / limit);

  if (loading && carcasses.length === 0) {
    return <Chargement />;
  }

  return (
    <div className="fr-container--fluid fr-my-md-14v">
      <title>Carcasses | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <div className="fr-mb-2w flex items-center justify-between gap-4">
            <h1 className="fr-h2">Carcasses ({total})</h1>
          </div>
          <section className="mb-6 bg-white md:shadow-sm">
            <div className="space-y-4 p-4 md:p-8 md:pb-4">
              <form
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearchQuery(searchInput);
                }}
              >
                <Input
                  label="Rechercher une carcasse"
                  nativeInputProps={{
                    type: 'search',
                    value: searchInput,
                    onChange: (e) => setSearchInput(e.target.value),
                    placeholder: 'Numéro bracelet, espèce, numéro FEI...',
                  }}
                />
                <div className="flex items-end">
                  <Button type="submit">Rechercher</Button>
                </div>
              </form>
            </div>
            <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
              <Table
                fixed
                noCaption
                className="[&_td]:align-top"
                headers={['Bracelet', 'Espèce', 'Type', 'FEI', 'Statut SVI', 'Créée le']}
                data={carcasses.map((carcasse) => [
                  <Link
                    key={carcasse.zacharie_carcasse_id}
                    to={`/app/tableau-de-bord/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                    className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                  >
                    <span className="font-bold">{carcasse.numero_bracelet}</span>
                  </Link>,
                  <Link
                    key={carcasse.zacharie_carcasse_id}
                    to={`/app/tableau-de-bord/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                    className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                  >
                    {carcasse.espece || <span className="italic text-gray-400">Non renseignée</span>}
                  </Link>,
                  <Link
                    key={carcasse.zacharie_carcasse_id}
                    to={`/app/tableau-de-bord/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                    className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                  >
                    {carcasse.type ? (
                      <Badge severity="info" small>
                        {carcasse.type}
                      </Badge>
                    ) : (
                      <span className="italic text-gray-400">-</span>
                    )}
                  </Link>,
                  <Link
                    key={carcasse.zacharie_carcasse_id}
                    to={`/app/tableau-de-bord/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                    className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                  >
                    <span className="text-sm">{carcasse.fei_numero}</span>
                  </Link>,
                  <Link
                    key={carcasse.zacharie_carcasse_id}
                    to={`/app/tableau-de-bord/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                    className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                  >
                    {carcasse.svi_carcasse_status ? (
                      <Badge
                        severity={
                          carcasse.svi_carcasse_status === 'ACCEPTE'
                            ? 'success'
                            : carcasse.svi_carcasse_status === 'SANS_DECISION'
                              ? 'warning'
                              : 'error'
                        }
                        small
                      >
                        {carcasse.svi_carcasse_status}
                      </Badge>
                    ) : (
                      <span className="italic text-gray-400">-</span>
                    )}
                  </Link>,
                  <Link
                    key={carcasse.zacharie_carcasse_id}
                    to={`/app/tableau-de-bord/admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}`}
                    className="inline-flex! size-full flex-col items-start justify-start gap-1 bg-none! no-underline!"
                    suppressHydrationWarning
                  >
                    <span className="text-sm" suppressHydrationWarning>
                      {dayjs(carcasse.created_at).format('DD/MM/YYYY')}
                    </span>
                  </Link>,
                ])}
              />
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 p-4">
                <Button
                  size="small"
                  priority="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Précédent
                </Button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <Button
                  size="small"
                  priority="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Suivant
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
