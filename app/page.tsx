import { Suspense } from "react";
import GapFinder from "./GapFinder";

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <GapFinder />
    </Suspense>
  );
}