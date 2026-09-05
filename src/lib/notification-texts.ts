/**
 * Notification bodies, Duolingo-style: short, playful, a little pushy.
 * One is picked per reminder per day (rotating by day and slot), so the
 * same text rarely repeats back to back.
 */
export const NOTIFICATION_TEXTS: string[] = [
  'Your words miss you. They are taking it personally.',
  'The plate is empty. The word list is not.',
  "Quick — what does 'ephemeral' mean? Exactly. Let's fix that.",
  'A two-minute swipe beats an hour of regret.',
  'That word you flagged is still waiting for its comeback.',
  'Brains drop most of a new word within a day. Fight back.',
  'Your future self voted for studying. They are watching.',
  'Feed the brain: it burns calories too. Allegedly.',
  'Even one swipe counts. Loudly.',
  'Word review: cheaper than therapy, surprisingly effective.',
  'The feed is warm, the words are ready. Dive in.',
  "Somewhere, 'ephemeral' is feeling neglected.",
  'Small sips beat big gulps — one small session today?',
  "Your vocabulary called. It said: 'anytime now.'",
  'Forgetting is free. Remembering is two minutes.',
  'Round after round — that is how strangers become friends.',
  'That flag you set? Prove it wrong today.',
  'You have watched longer videos for worse reasons.',
  'One word now beats twenty words someday.',
  'Skipping today makes tomorrow guiltier. Just saying.',
];

/** Picks a random playful nudge; called fresh at every scheduling sync. */
export function pickNotificationText(): string {
  return NOTIFICATION_TEXTS[Math.floor(Math.random() * NOTIFICATION_TEXTS.length)];
}
