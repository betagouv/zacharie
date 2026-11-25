import { describe, expect, test } from 'vitest';
import type { UserForFei } from '@api/src/types/user';
import { mergeUserPartenaire } from './merge-user-partenaire';

const partenaire = {
  id: 'U-1',
  prenom: 'Pierre',
  nom_de_famille: 'Petit',
  email: 'pierre@example.fr',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-02-01'),
};

describe('mergeUserPartenaire', () => {
  test('garde le téléphone et l’adresse déjà reçus avec les fiches', () => {
    const existing: UserForFei = {
      ...partenaire,
      telephone: '0606060606',
      addresse_ligne_1: '1 rue des Bois',
      addresse_ligne_2: null,
      code_postal: '03000',
      ville: 'Moulins',
      est_forme_a_l_examen_initial: true,
      numero_cfei: 'CFEI-03-1',
    };
    expect(mergeUserPartenaire(existing, { ...partenaire, prenom: 'Pierrot' })).toEqual({
      ...existing,
      prenom: 'Pierrot',
    });
  });

  test('sans fiche commune : pas de coordonnées', () => {
    const merged = mergeUserPartenaire(undefined, partenaire);
    expect(merged.telephone).toBeNull();
    expect(merged.addresse_ligne_1).toBeNull();
    expect(merged.prenom).toBe('Pierre');
  });
});
