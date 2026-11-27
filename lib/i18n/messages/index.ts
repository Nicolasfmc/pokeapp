import { auth } from "./auth";
import { cards } from "./cards";
import { common, enums } from "./common";
import { deckEditor } from "./deckEditor";
import { decks } from "./decks";
import { home } from "./home";
import { hosted } from "./hosted";
import { inventory } from "./inventory";
import { profile } from "./profile";
import { shell } from "./shell";
import { statistics } from "./statistics";
import { tournaments } from "./tournaments";
import { training } from "./training";

export const messages = {
  ...common,
  ...enums,
  ...shell,
  ...auth,
  ...home,
  ...cards,
  ...decks,
  ...deckEditor,
  ...inventory,
  ...training,
  ...tournaments,
  ...hosted,
  ...statistics,
  ...profile,
} as const;

export type MessageKey = keyof typeof messages;
