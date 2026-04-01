import { useState, type Ref, useRef, useEffect } from 'react';
import { Prisma } from '@prisma/client';
import { useParams } from 'react-router';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';
import { toast } from 'react-toastify';

import AdminUserHeader from './user-detail/AdminUserHeader';
import AdminUserTabDetails from './user-detail/AdminUserTabDetails';
import AdminUserTabRoles from './user-detail/AdminUserTabRoles';
import AdminUserTabIdentity from './user-detail/AdminUserTabIdentity';
import AdminUserTabRelations from './user-detail/AdminUserTabRelations';
import {
  adminUserDetailInitialState,
  loadAdminUserData,
  type AdminUserDetailState,
} from './user-detail/admin-user-state';
import AdminSegmentedTabs from './user-detail/AdminSegmentedTabs';

const MAIN_TAB_DETAILS = 'details';
const MAIN_TAB_ROLES = 'roles';
const MAIN_TAB_IDENTITY = 'identity';
const MAIN_TAB_RELATIONS = 'relations';

export default function AdminUser() {
  const params = useParams();
  const [userResponseData, setUserResponseData] = useState<AdminUserDetailState>(adminUserDetailInitialState);
  const { user, identityDone, examinateurDone, officialCfei } = userResponseData;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadAdminUserData(params.userId!).then((res) => {
      if (res.ok && res.data) {
        setUserResponseData(res.data as AdminUserDetailState);
      }
    });
  }, [params.userId]);

  const activeFormRef = useRef<HTMLFormElement>(null);
  const idFormRef = useRef<HTMLFormElement>(null);
  const rolesFormRef = useRef<HTMLFormElement>(null);

  const handleUserFormBlur = (formRef: Ref<HTMLFormElement>) => () => {
    const formData = new FormData(formRef.current!);

    const body =
      formRef.current!.id === 'user_roles_form'
        ? {
          roles: formData.getAll('roles'),
          isZacharieAdmin: formData.get(Prisma.UserScalarFieldEnum.isZacharieAdmin) === 'true',
        }
        : Object.fromEntries(formData);

    API.post({
      path: `/user/${params.userId}`,
      body,
    }).then((res) => {
      if (!res.ok) {
        return toast.error("Une erreur est survenue lors de la mise à jour de l'utilisateur");
      }

      loadAdminUserData(params.userId!).then((reload) => {
        if (reload.ok && reload.data) {
          setUserResponseData(reload.data as AdminUserDetailState);
        }
        if (!reload.ok) {
          return toast.error(reload.error);
        }
        toast.success("L'utilisateur a été mis à jour avec succès");
      });
    });
  };

  const [selectedMainTabId, setSelectedMainTabId] = useState(MAIN_TAB_DETAILS);

  const mainTabs = [
    { id: MAIN_TAB_DETAILS, label: 'Détails' },
    { id: MAIN_TAB_ROLES, label: 'Rôles' },
    { id: MAIN_TAB_IDENTITY, label: 'Identité et coordonnées' },
    { id: MAIN_TAB_RELATIONS, label: 'Entités et relations' },
  ];

  if (!user.id) {
    return <Chargement />;
  }

  return (
    <div className="pb-24 md:pb-4">
      <title>
        {`${user.prenom ? `${user.prenom} ${user.nom_de_famille}` : user.email} | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      <div className="rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm md:p-4">
        <AdminUserHeader user={user} />

        <AdminSegmentedTabs
          className="mb-3 pt-1"
          tabs={mainTabs}
          value={selectedMainTabId}
          onChange={setSelectedMainTabId}
          ariaLabel="Sections du profil utilisateur"
        />

        <div className="border-t border-gray-100 pt-3" role="tabpanel">
          {selectedMainTabId === MAIN_TAB_DETAILS && (
            <AdminUserTabDetails
              user={user}
              activeFormRef={activeFormRef}
              onActiveBlur={handleUserFormBlur(activeFormRef)}
            />
          )}
          {selectedMainTabId === MAIN_TAB_ROLES && (
            <AdminUserTabRoles
              user={user}
              rolesFormRef={rolesFormRef}
              onRolesBlur={handleUserFormBlur(rolesFormRef)}
            />
          )}
          {selectedMainTabId === MAIN_TAB_IDENTITY && (
            <AdminUserTabIdentity
              user={user}
              officialCfei={officialCfei}
              identityDone={identityDone}
              examinateurDone={examinateurDone}
              idFormRef={idFormRef}
              onIdentityBlur={handleUserFormBlur(idFormRef)}
            />
          )}
          {selectedMainTabId === MAIN_TAB_RELATIONS && (
            <AdminUserTabRelations
              key={user.id}
              userResponseData={userResponseData}
              setUserResponseData={setUserResponseData}
            />
          )}
        </div>

        <div className="mt-3 mb-2">
          <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left fr-text--sm" href="#top">
            Haut de page
          </a>
        </div>
      </div>
    </div>
  );
}
