import { useFetcher, useLoaderData } from "@remix-run/react";
import { loader } from "./route";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import CarcasseReadAndWrite from "./carcasse-examinateur-edit";
import { Prisma } from "@prisma/client";

export default function CarcassesExaminateur() {
  const { fei } = useLoaderData<typeof loader>();
  const nouvelleCarcasseFetcher = useFetcher();

  // @ts-expect-error no type of action data on fetcher
  const error = nouvelleCarcasseFetcher.data?.error as string;

  return (
    <>
      {fei.Carcasses.map((carcasse) => {
        return <CarcasseReadAndWrite key={carcasse.updated_at} carcasse={carcasse} />;
      })}
      <nouvelleCarcasseFetcher.Form
        method="POST"
        className="fr-fieldset__element flex md:flex-row flex-col md:items-end gap-4 w-full items-stretch"
        action="/action/carcasse/nouvelle"
      >
        <input type="hidden" required name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
        <Input
          label="Numéro de bracelet"
          className="!mb-0 grow"
          state={error ? "error" : "default"}
          stateRelatedMessage={error ?? ""}
          nativeInputProps={{
            type: "text",
            required: true,
            name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
          }}
        />
        <Button type="submit">Ajouter une carcasse</Button>
      </nouvelleCarcasseFetcher.Form>
    </>
  );
}
