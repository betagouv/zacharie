import prisma from '~/prisma';

const CODE_PREFIX_REGEX = /^[GP]\d+\.\s/;

function stripPrefix(value: string): string {
  return value.replace(CODE_PREFIX_REGEX, '');
}

const applyMode = process.argv.includes('--apply');

(async () => {
  console.log(applyMode ? 'MODE: APPLY' : 'MODE: DRY RUN (use --apply to update)');

  const carcasses = await prisma.carcasse.findMany({
    where: {
      deleted_at: null,
      OR: [
        { svi_ipm1_lesions_ou_motifs: { isEmpty: false } },
        { svi_ipm2_lesions_ou_motifs: { isEmpty: false } },
      ],
    },
    select: {
      zacharie_carcasse_id: true,
      svi_ipm1_lesions_ou_motifs: true,
      svi_ipm2_lesions_ou_motifs: true,
    },
  });

  let updateCount = 0;

  for (const carcasse of carcasses) {
    const data: Record<string, string[]> = {};

    const ipm1 = carcasse.svi_ipm1_lesions_ou_motifs;
    if (ipm1.some((v) => CODE_PREFIX_REGEX.test(v))) {
      data.svi_ipm1_lesions_ou_motifs = ipm1.map((v) => (CODE_PREFIX_REGEX.test(v) ? stripPrefix(v) : v));
      console.log(`[ipm1] ${carcasse.zacharie_carcasse_id}`);
      console.log(`  old: ${JSON.stringify(ipm1)}`);
      console.log(`  new: ${JSON.stringify(data.svi_ipm1_lesions_ou_motifs)}`);
    }

    const ipm2 = carcasse.svi_ipm2_lesions_ou_motifs;
    if (ipm2.some((v) => CODE_PREFIX_REGEX.test(v))) {
      data.svi_ipm2_lesions_ou_motifs = ipm2.map((v) => (CODE_PREFIX_REGEX.test(v) ? stripPrefix(v) : v));
      console.log(`[ipm2] ${carcasse.zacharie_carcasse_id}`);
      console.log(`  old: ${JSON.stringify(ipm2)}`);
      console.log(`  new: ${JSON.stringify(data.svi_ipm2_lesions_ou_motifs)}`);
    }

    if (Object.keys(data).length > 0) {
      updateCount++;
      if (applyMode) {
        await prisma.carcasse.update({
          where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
          data,
        });
      }
    }
  }

  console.log(`\n${updateCount} carcasse(s) ${applyMode ? 'updated' : 'would be updated'}`);
  console.log('DONE');
})();
