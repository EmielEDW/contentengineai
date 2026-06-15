import { Inngest } from "inngest";
import type { Events } from "./events";

export const inngest = new Inngest({
  id: "contentengineai",
  schemas: undefined, // typed via the `Events` helper on send/createFunction below
});

export type AppEvents = Events;
