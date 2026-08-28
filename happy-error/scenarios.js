export const scenarios = [
  {
    id: "deceptive-quota",
    title: "🎭 Deceptive 200 (Hero)",
    badge: "Deceptive Error",
    description: "Looks like a success at a glance, but contains a silent failure and actionable recovery instructions.",
    text: "Submission received and accepted! Note: Background indexing could not start due to exceeded organization quota. Please call support at 1-800-555-0199 or run `npx sync-tool --force-renew` to increase limits."
  },
  {
    id: "clean-success",
    title: "🟢 Clean Success",
    badge: "Success",
    description: "Standard positive outcome with no errors or caveats.",
    text: "Your workspace migration is complete! All 12 project boards and 340 assets were transferred successfully to the new cluster."
  },
  {
    id: "partial-failure",
    title: "⚠️ Partial Warning",
    badge: "Partial Success",
    description: "Overall operation completed, but specific items failed with a remediation link.",
    text: "Batch sync complete: 1,420 contacts imported, but 3 records had invalid emails and were skipped. You can review the error log at https://workspace.internal/sync/batch-992."
  }
];
