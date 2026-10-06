export function critique({ interpretation, result }) {
  const issues = [];
  if (!result?.text && !(result?.toolCalls?.length)) issues.push("empty_result");
  if (interpretation?.needsTool && !result?.toolCalls?.length && !result?.text) issues.push("action_not_resolved");
  return {
    acceptable: issues.length === 0,
    issues,
    nextAction: issues.length ? "reassess" : "continue"
  };
}
