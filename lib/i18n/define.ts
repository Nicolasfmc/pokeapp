/** Each message is a tuple: [English, Português (Brasil)]. */
export type MessageTuple = readonly [en: string, pt: string];

export function defineMessages<const T extends Record<string, MessageTuple>>(messages: T): T {
  return messages;
}
