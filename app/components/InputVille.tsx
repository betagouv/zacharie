import { Input, InputProps } from "@codegouvfr/react-dsfr/Input";
import { useState, ChangeEvent, useEffect, useRef } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import villes from "~/data/villes.json";

type OnlyInput = Omit<InputProps, "nativeTextAreaProps" | "textArea">;
interface InputVilleProps extends OnlyInput {
  trimPostCode?: boolean;
  postCode?: string;
}
export default function InputVille(props: InputVilleProps) {
  const { trimPostCode, postCode, ...inputProps } = props;
  const [villeSearched, setVilleSearched] = useState<string>(() => {
    const defaultValue = props.nativeInputProps?.defaultValue;
    return typeof defaultValue === "string" ? defaultValue : "";
  });
  const debouncedVilleSearched = useDebounce(
    `${postCode ? postCode + " " : ""}${villeSearched.toLocaleUpperCase()}`,
    300,
  );
  const [villesResults, setVillesResults] = useState<string[]>([]);
  const canSearch = useRef(false);

  function normalizeSearch(search: string) {
    const searchUpperCased = search.toLocaleUpperCase();
    const removeSaint = searchUpperCased.replace("SAINT ", "ST ");
    const regexCodePostal = /\d{5}/;
    const removeCodePostal = removeSaint.replace(regexCodePostal, "");
    // replace all accents with normal letters
    const searchNormalized = removeCodePostal.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return searchNormalized;
  }

  useEffect(() => {
    if (!debouncedVilleSearched || !canSearch.current) {
      return;
    }

    const multipleWords = debouncedVilleSearched
      .split(" ")
      .join("-")
      .split("-")
      .filter((word) => word.length > 2);
    const normalizedVille = normalizeSearch(debouncedVilleSearched);
    const searchCodePostal = normalizedVille.match(/\d{5}/)?.[0] ?? "";

    const search_code_postal_ville = searchCodePostal ? `${searchCodePostal} ${normalizedVille}` : normalizedVille;
    const multipleNormalizedWords = normalizedVille
      .split(" ")
      .join("-")
      .split("-")
      .filter((word) => word.length > 2);

    const itemsNameStartWithWord = [];
    const itemsNameStartWithWordWithNoAccent = [];
    const itemsNameStartsWithOneOfTheWords = [];
    const itemsNameStartsWithOneOfTheWordsWithNoAccent = [];
    const itemsNameContainsTheWord = [];
    const itemsNameContainsOneOfTheWords = [];
    const itemsNameContainsOneOfTheWordsWithNoAccent = [];

    for (const item of villes as Array<{ code_postal: string; ville: string; code_postal_ville: string }>) {
      const { code_postal, ville, code_postal_ville } = item;
      if (code_postal_ville.startsWith(debouncedVilleSearched)) {
        itemsNameStartWithWord.push(code_postal_ville);
        continue;
      }
      if (code_postal_ville.startsWith(search_code_postal_ville)) {
        itemsNameStartWithWordWithNoAccent.push(code_postal_ville);
        continue;
      }
      if (ville.startsWith(debouncedVilleSearched)) {
        itemsNameStartWithWord.push(code_postal_ville);
        continue;
      }
      if (ville.startsWith(normalizedVille)) {
        itemsNameStartWithWordWithNoAccent.push(code_postal_ville);
        continue;
      }
      if (searchCodePostal && code_postal.startsWith(searchCodePostal)) {
        itemsNameStartWithWord.push(code_postal_ville);
        continue;
      }
      if (ville.includes(normalizedVille)) {
        itemsNameContainsTheWord.push(code_postal_ville);
        continue;
      }
      for (const word of multipleWords) {
        if (code_postal_ville.startsWith(word)) {
          itemsNameStartsWithOneOfTheWords.push(code_postal_ville);
          break;
        }
      }
      for (const word of multipleNormalizedWords) {
        if (code_postal_ville.startsWith(word)) {
          itemsNameStartsWithOneOfTheWordsWithNoAccent.push(code_postal_ville);
          break;
        }
      }
      for (const word of multipleWords) {
        if (code_postal_ville.includes(word)) {
          itemsNameContainsOneOfTheWords.push(code_postal_ville);
          break;
        }
      }
      for (const word of multipleNormalizedWords) {
        if (code_postal_ville.includes(word)) {
          itemsNameContainsOneOfTheWordsWithNoAccent.push(code_postal_ville);
          break;
        }
      }
    }
    const results = [
      ...new Set([
        ...itemsNameStartWithWord,
        ...itemsNameStartWithWordWithNoAccent,
        ...itemsNameStartsWithOneOfTheWords,
        ...itemsNameStartsWithOneOfTheWordsWithNoAccent,
        ...itemsNameContainsTheWord,
        ...itemsNameContainsOneOfTheWords,
        ...itemsNameContainsOneOfTheWordsWithNoAccent,
      ]),
    ].slice(0, 5);
    setVillesResults(results);
  }, [debouncedVilleSearched, postCode]);

  useEffect(() => {
    if (!villeSearched && postCode && postCode?.length >= 5) {
      const results = [];
      for (const item of villes as Array<{ code_postal: string; ville: string; code_postal_ville: string }>) {
        const { code_postal, code_postal_ville } = item;
        if (code_postal === postCode) {
          results.push(code_postal_ville);
        }
        if (results.length >= 5) {
          break;
        }
      }
      setVillesResults(results);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postCode]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    canSearch.current = true;
    setVilleSearched(e.target.value);
  };

  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <Input
        {...inputProps}
        nativeInputProps={{
          ...props.nativeInputProps,
          ref: ref,
          type: "text",
          defaultValue: undefined,
          value: villeSearched,
          onChange: handleChange,
        }}
      />
      <div className="-mt-6 flex w-full flex-col border border-gray-200">
        {villesResults.map((ville) => {
          return (
            <button
              key={ville}
              onClick={() => {
                if (trimPostCode) {
                  const codePostal = ville.split(" ")[0];
                  setVilleSearched(ville.replace(codePostal, "").trim());
                } else {
                  setVilleSearched(ville);
                }
                setVillesResults([]);
                // the parent form is submitted on blur
                // trigger a focus event then a blur again to submit the form
                // this is a hack to submit the form on blur again
                ref.current?.focus();
                ref.current?.blur();
                canSearch.current = false;
              }}
              type="button"
              className="block !border-b-2 border-b-gray-200 py-1 pl-4 text-left"
            >
              {ville}
            </button>
          );
        })}
      </div>
    </>
  );
}
