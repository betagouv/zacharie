// Le nombre de larves d'un pool est réservé aux laboratoires : omis de toutes les requêtes, les
// lectures destinées aux laboratoires le réintègrent avec `omit: avecNombreLarves`
export const omit = {
  trichinePool: { nombre_larves_lvd: true, nombre_larves_lnr: true },
} as const;

export const avecNombreLarves = { nombre_larves_lvd: false, nombre_larves_lnr: false } as const;
