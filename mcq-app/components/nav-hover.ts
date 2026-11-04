export const HOVER_CLOSE_MS = 200;

/**
 * True when a mouse can rest on a control. A primary touch screen is the
 * exception. Desktops that do not report a fine pointer still count, because
 * they send mouseenter and mouseleave.
 */
export function hoverFromMedia(matches: (query: string) => boolean): boolean {
  if (
    matches("(hover: hover)") ||
    matches("(any-hover: hover)") ||
    matches("(pointer: fine)") ||
    matches("(any-pointer: fine)")
  ) {
    return true;
  }
  return !matches("(pointer: coarse)");
}

export function canHover(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return hoverFromMedia((query) => window.matchMedia(query).matches);
}

/** Touch uses click. Mouse and pen use the hover timer. */
export function isHoverPointer(pointerType: string): boolean {
  return pointerType !== "touch";
}

export type Box = { top: number; right: number; bottom: number; left: number };

export type PanelModel = {
  open: boolean;
  /** Epoch ms when a hover-close should fire. Null when the timer is not armed. */
  deadline: number | null;
};

export type PanelEvent =
  | { type: "pointer-inside" }
  | { type: "pointer-outside"; now: number }
  | { type: "tick"; now: number }
  | { type: "escape" }
  | { type: "outside-click" }
  | { type: "focus-out"; stillInside: boolean }
  | { type: "toggle" }
  | { type: "force-close" };

export type PanelStep = {
  model: PanelModel;
  /** Escape closes and puts focus back on the trigger. */
  focusTrigger: boolean;
};

const CLOSED: PanelModel = { open: false, deadline: null };

export function boxFromRect(rect: Pick<DOMRect, "top" | "right" | "bottom" | "left">): Box {
  return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
}

export function containsPoint(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * The strip between a trigger and its panel.
 * Crossing it must not count as leaving. Null when the two boxes already meet.
 */
export function hoverBridgeBox(trigger: Box, panel: Box, pad = 6): Box | null {
  const apartX = trigger.right < panel.left - 1 || panel.right < trigger.left - 1;
  const apartY = trigger.bottom < panel.top - 1 || panel.bottom < trigger.top - 1;
  if (!apartX && !apartY) return null;

  if (apartX && !apartY) {
    const overlapTop = Math.max(trigger.top, panel.top);
    const overlapBottom = Math.min(trigger.bottom, panel.bottom);
    const band = overlapBottom > overlapTop;
    return {
      left: Math.min(trigger.right, panel.left) - pad,
      right: Math.max(trigger.right, panel.left) + pad,
      top: (band ? overlapTop : trigger.top) - pad,
      bottom: (band ? overlapBottom : trigger.bottom) + pad,
    };
  }

  if (apartY && !apartX) {
    const overlapLeft = Math.max(trigger.left, panel.left);
    const overlapRight = Math.min(trigger.right, panel.right);
    const band = overlapRight > overlapLeft;
    return {
      left: (band ? overlapLeft : trigger.left) - pad,
      right: (band ? overlapRight : trigger.right) + pad,
      top: Math.min(trigger.bottom, panel.top) - pad,
      bottom: Math.max(trigger.bottom, panel.top) + pad,
    };
  }

  return {
    left: Math.min(trigger.left, panel.left),
    right: Math.max(trigger.right, panel.right),
    top: Math.min(trigger.top, panel.top),
    bottom: Math.max(trigger.bottom, panel.bottom),
  };
}

/** True when the pointer is on the trigger, the panel, or the bridge between them. */
export function pointerInLinkedRegion(x: number, y: number, trigger: Box, panel: Box | null): boolean {
  if (containsPoint(trigger, x, y)) return true;
  if (!panel) return false;
  if (containsPoint(panel, x, y)) return true;
  const bridge = hoverBridgeBox(trigger, panel);
  return bridge ? containsPoint(bridge, x, y) : false;
}

export function reducePanel(model: PanelModel, event: PanelEvent, canHover = true): PanelStep {
  switch (event.type) {
    case "pointer-inside":
      if (!canHover && !model.open) return { model, focusTrigger: false };
      return { model: { open: true, deadline: null }, focusTrigger: false };
    case "pointer-outside":
      if (!model.open || !canHover) return { model, focusTrigger: false };
      return { model: { open: true, deadline: event.now + HOVER_CLOSE_MS }, focusTrigger: false };
    case "tick":
      if (model.deadline == null || event.now < model.deadline) return { model, focusTrigger: false };
      return { model: CLOSED, focusTrigger: false };
    case "escape":
      if (!model.open) return { model, focusTrigger: false };
      return { model: CLOSED, focusTrigger: true };
    case "outside-click":
    case "force-close":
      if (!model.open && model.deadline == null) return { model, focusTrigger: false };
      return { model: CLOSED, focusTrigger: false };
    case "focus-out":
      if (!model.open || event.stillInside) return { model, focusTrigger: false };
      return { model: CLOSED, focusTrigger: false };
    case "toggle":
      return {
        model: model.open ? CLOSED : { open: true, deadline: null },
        focusTrigger: false,
      };
    default:
      return { model, focusTrigger: false };
  }
}
