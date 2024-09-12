import { Input, InputProps } from "@codegouvfr/react-dsfr/Input";
import { useState, ChangeEvent, useEffect, useRef } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import villes from "~/data/villes.json";

type OnlyInput = Omit<InputProps, "nativeTextAreaProps" | "textArea">;

export default function InputVille(props: OnlyInput) {
  const [villeSearched, setVilleSearched] = useState<string>(() => {
    const defaultValue = props.nativeInputProps?.defaultValue;
    return typeof defaultValue === "string" ? defaultValue : "";
  });
  const debouncedVilleSearched = useDebounce(villeSearched.toLocaleUpperCase(), 300);
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
  }, [debouncedVilleSearched]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    canSearch.current = true;
    setVilleSearched(e.target.value);
  };

  return (
    <>
      <Input
        {...props}
        nativeInputProps={{
          ...props.nativeInputProps,
          type: "text",
          defaultValue: undefined,
          value: villeSearched,
          onChange: handleChange,
        }}
      />
      <div className="flex flex-col w-full -mt-6 border border-gray-200">
        {villesResults.map((ville) => {
          return (
            <button
              key={ville}
              onClick={() => {
                setVilleSearched(ville);
                setVillesResults([]);
                canSearch.current = false;
              }}
              type="button"
              className="block text-left !border-b-2 border-b-gray-200 py-1 pl-4"
            >
              {ville}
            </button>
          );
        })}
      </div>
    </>
  );
}
