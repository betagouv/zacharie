import { type User } from "@prisma/client";
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

interface State {
  user: User | null;
}

const useUser = create<State>()(
  devtools(
    persist(
      (): State => ({
        user: null,
      }),
      {
        name: "zacharie-zustand-user-store",
        version: 1,
        storage: createJSONStorage(() => window.localStorage),
      }
    )
  )
);

export default useUser;
