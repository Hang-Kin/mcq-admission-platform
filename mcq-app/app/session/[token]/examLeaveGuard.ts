/**
 * While the exam is on screen, ask before a reload or close, and push a
 * history entry so Back stays on this page. The timer is not involved.
 */
export function bindExamLeaveGuard(target: Window, active: boolean): () => void {
  if (!active) return () => {};

  try {
    target.history.pushState({ mcqExam: true }, "", target.location.href);
  } catch {
    // ignore
  }

  const onBeforeUnload = (event: Event) => {
    event.preventDefault();
    if ("returnValue" in event) {
      (event as BeforeUnloadEvent).returnValue = "";
    }
  };

  const onPop = () => {
    try {
      target.history.pushState({ mcqExam: true }, "", target.location.href);
    } catch {
      // ignore
    }
  };

  target.addEventListener("beforeunload", onBeforeUnload);
  target.addEventListener("popstate", onPop);
  return () => {
    target.removeEventListener("beforeunload", onBeforeUnload);
    target.removeEventListener("popstate", onPop);
  };
}
