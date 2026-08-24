import { describe, test, expect } from 'vitest';
import { redactPersonalData } from '~/utils/redact-personal-data';

describe('redactPersonalData', () => {
  test('masque les noms en cache, e-mails, téléphones et adresses', () => {
    const redacted = redactPersonalData({
      premier_detenteur_name_cache: 'Jean Dupont',
      current_owner_user_name_cache: 'Alice Martin',
      current_owner_entity_name_cache: 'ETG de la Garenne',
      svi_ipm1_user_name_cache: 'Dr Vétérinaire',
      consommateur_final_email: 'jean@example.fr',
      telephone: '0612345678',
      adresse_ligne_1: '10 rue de la paix',
      nom: 'Dupont',
      nom_de_famille: 'Dupont',
      prenom: 'Jean',
    }) as Record<string, unknown>;

    for (const value of Object.values(redacted)) {
      expect(value).toBe('[masqué]');
    }
  });

  test("ne garde que l'id de l'examinateur initial parmi les identifiants d'utilisateur", () => {
    const redacted = redactPersonalData({
      examinateur_initial_user_id: 'user-examinateur',
      created_by_user_id: 'user-createur',
      premier_detenteur_user_id: 'user-pd',
      next_owner_user_id: 'user-next',
      prev_owner_user_id: 'user-prev',
      current_owner_user_id: 'user-current',
      intermediaire_user_id: 'user-inter',
      requested_by_user_id: 'user-demandeur',
      reviewed_by_user_id: 'user-examinateur',
      svi_ipm1_user_id: 'user-svi',
      trichine_retire_de_fei_user_id: 'user-trichine',
    }) as Record<string, unknown>;

    expect(redacted.examinateur_initial_user_id).toBe('user-examinateur');
    const { examinateur_initial_user_id, ...autres } = redacted;
    for (const value of Object.values(autres)) {
      expect(value).toBe('[masqué]');
    }
  });

  // Tout l'intérêt du payload conservé : rejouer la saisie. Ces champs-là doivent survivre.
  test('laisse intactes les données métier nécessaires au rattrapage', () => {
    const body = {
      numero: 'ZACH-20250707-QZ6E0-155242',
      fei_numero: 'ZACH-20250707-QZ6E0-155242',
      zacharie_carcasse_id: 'ZC-1',
      numero_bracelet: 'BR-NEW',
      espece: 'Cerf élaphe',
      nombre_d_animaux: 2,
      nombre_d_animaux_acceptes: 2,
      heure_evisceration: '23:59',
      commune_mise_a_mort: 'Villette',
      examinateur_anomalies_carcasse: ['hématome'],
      next_owner_entity_id: 'entity-etg',
      premier_detenteur_entity_id: 'entity-asso',
      intermediaire_id: 'user-1_FEI-1_155242',
    };

    expect(redactPersonalData(body)).toEqual(body);
  });

  test('les champs vides restent vides — ne pas laisser croire à une valeur masquée', () => {
    expect(
      redactPersonalData({
        premier_detenteur_name_cache: null,
        svi_user_id: '',
        next_owner_user_id: undefined,
      })
    ).toEqual({ premier_detenteur_name_cache: null, svi_user_id: '', next_owner_user_id: undefined });
  });

  test('un body non-objet passe tel quel', () => {
    expect(redactPersonalData(null)).toBe(null);
    expect(redactPersonalData(undefined)).toBe(undefined);
    expect(redactPersonalData('texte')).toBe('texte');
  });
});
