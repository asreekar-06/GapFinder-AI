   import { Suspense } from "react";
   import Chat from "./Chat";

   export default function Page() {
     return (
       <Suspense fallback={<p>Loading...</p>}>
         <Chat />
       </Suspense>
     );
   }