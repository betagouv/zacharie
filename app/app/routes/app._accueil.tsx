import { Outlet } from "@remix-run/react";
import RootDisplay from "@app/components/RootDisplay";
// import type { MetaFunction } from "@remix-run/node";

// export const meta: MetaFunction = () => {
//   return [
//     { title: "New Remix App" },
//     { name: "description", content: "Welcome to Remix!" },
//   ];
// };

export default function AccueilLayout() {
  return (
    <RootDisplay>
      <Outlet />
    </RootDisplay>
  );
}
