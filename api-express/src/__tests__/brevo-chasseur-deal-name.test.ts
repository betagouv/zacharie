import { describe, test, expect } from 'vitest';
import { getChasseurDealName } from '~/utils/brevo-chasseur-deal-name';

describe('getChasseurDealName', () => {
  test('prénom et nom remplis', () => {
    expect(getChasseurDealName({ prenom: 'Jean', nom_de_famille: 'Dupont', email: 'jean@example.fr' })).toBe(
      'Jean Dupont'
    );
  });

  test('seul le nom ou seul le prénom est rempli', () => {
    expect(getChasseurDealName({ prenom: null, nom_de_famille: 'Dupont', email: 'jean@example.fr' })).toBe(
      'Dupont'
    );
    expect(getChasseurDealName({ prenom: 'Jean', nom_de_famille: '', email: 'jean@example.fr' })).toBe(
      'Jean'
    );
  });

  test("ni prénom ni nom : l'email sert de nom, jamais une chaîne vide", () => {
    expect(getChasseurDealName({ prenom: '', nom_de_famille: '  ', email: 'jean@example.fr' })).toBe(
      'jean@example.fr'
    );
    expect(getChasseurDealName({ prenom: null, nom_de_famille: null, email: 'jean@example.fr' })).toBe(
      'jean@example.fr'
    );
  });
});
