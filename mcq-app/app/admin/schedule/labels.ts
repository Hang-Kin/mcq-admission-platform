// English UI strings for scheduling, sections, and the exam list.
// A later translation sweep should start here.

export const DELETE_CONFIRMATION = "DELETE";

export const labels = {
  archive: "Archive",
  archiving: "Archiving…",
  archiveConfirm: (name: string) =>
    `Archive ${name}? It leaves the active list and can be restored.`,
  restore: "Restore",
  restoring: "Restoring…",
  restoreConfirm: (name: string) => `Restore ${name} to the active list?`,
  showArchived: "Show archived",
  hideArchived: "Hide archived",
  archived: "Archived",
  archivedHeading: "Archived",
  noArchived: "No archived sittings.",
  archiveUnavailable: "Archiving is waiting for a database update.",
  archiveWaiting:
    "Archiving is waiting for a database update. Nothing was changed.",
  couldNotCheckTimes: "Could not check the other times for this exam.",
  archiveFailed: "Could not archive this sitting.",
  restoreFailed: "Could not restore this sitting.",
  deleteTimeConfirm: (name: string) => `Delete ${name}?`,
  deleteTestData: "Delete test data",
  deletingTestData: "Deleting…",
  countingTestData: "Counting…",
  deleteWordLabel: "Type DELETE to confirm",
  deleteWordMismatch: "Type DELETE in capitals to confirm.",
  deleteWaiting:
    "Deleting test data is waiting for a database update. Nothing was changed.",
  deleteFailed: "Could not delete this test data. Nothing was changed.",
  deleteCountFailed: "Could not count what would be removed. Nothing was deleted.",
  adminOnlyDelete: "Only an admin can delete test data.",
  sittingMissing: "This sitting could not be found.",
  startedCannotDelete:
    "A student has started this sitting, so it cannot be deleted. Archive it, or delete the test data.",
  linkedCannotDelete:
    "Students are linked to this sitting, so it was not deleted. Archive it, or delete the test data.",
  timeStays:
    "A student has started, so this time stays as it is.",
  changeTime: "Change this time",
  savingTime: "Saving…",
  saveTime: "Save time",
  dayView: "Day view",
  previousDay: "Previous day",
  nextDay: "Next day",
  noSittingsThisDay: "No sittings on this day.",
  draftOnAnotherDay: "The new time is on another day.",
  newTime: "New time",
  hongKongTime: "Hong Kong time (HKT).",
  dayViewHelp:
    "Hours are Hong Kong time. Overlaps are marked in red. A block opens that sitting.",
  overlaps: (names: string) => `This time overlaps ${names}.`,
  pairOverlaps: (left: string, right: string) => `${left} overlaps ${right}.`,
  archivedSuffix: (name: string) => `${name} (archived)`,
  frozenAt: (list: string) =>
    `Locked because students have started. Frozen at ${list}.`,
  frozenNoNumbers: "Locked because students have started.",
  subjectSettings: (math: number, chinese: number) =>
    `Subject settings: Math ${math} minutes, Chinese ${chinese} minutes.`,
  subjectSettingsUnknown:
    "Minutes follow Subject settings until a student starts.",
  mathBank: "Questions are drawn from the Math question bank.",
  chineseBank: "Questions are drawn from the Chinese question bank.",
  legacySetUsed: (name: string) =>
    `This section has no subject, so it still uses the question set “${name}”.`,
  noQuestionSource: "This section has no question source.",
  sectionsIntro:
    "Math and Chinese questions come from the question bank. Minutes below are what students actually get.",
  subjectSettingsLink: "Subject settings",
  legacyQuestionSet: "Legacy question set",
  legacyQuestionSetHelp:
    "Used only when this section has no subject. Math and Chinese sections draw from the question bank instead.",
  sectionsCreateHelp:
    "Sections run in order. Math and Chinese questions come from the question bank. A section with no subject still uses a question set.",
  examListIntro: "Open an exam for QR codes, sittings, sections, and grades.",
  sittingsColumn: "Sittings",
  openSittings: "Sittings",
  timesHeading: "Times",
} as const;

export function deleteTestDataSummary(counts: {
  students: number;
  answers: number;
  results: number;
}): string {
  return `This will remove ${plural(counts.students, "student")}, ${plural(counts.answers, "answer")}, and ${plural(counts.results, "result")}. The sitting is removed too. Type ${DELETE_CONFIRMATION} to confirm.`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
