import assert from "node:assert/strict";
import test from "node:test";

import {
  HOVER_CLOSE_MS,
  hoverBridgeBox,
  hoverFromMedia,
  isHoverPointer,
  pointerInLinkedRegion,
  reducePanel,
  type Box,
  type PanelModel,
} from "./nav-hover.ts";

const button: Box = { left: 900, top: 8, right: 1000, bottom: 52 };
const panel: Box = { left: 1100, top: 0, right: 1484, bottom: 800 };
const open: PanelModel = { open: true, deadline: null };

test("moving from the settings button to the panel stays inside the hover region", () => {
  const path = [
    { x: 950, y: 30 },
    { x: 1050, y: 30 },
    { x: 1200, y: 40 },
    { x: 1300, y: 400 },
  ];
  for (const point of path) {
    assert.equal(pointerInLinkedRegion(point.x, point.y, button, panel), true, `${point.x},${point.y}`);
  }
  let model = open;
  for (const point of path) {
    const inside = pointerInLinkedRegion(point.x, point.y, button, panel);
    const step = reducePanel(
      model,
      inside ? { type: "pointer-inside" } : { type: "pointer-outside", now: 0 },
    );
    model = step.model;
  }
  assert.equal(model.open, true);
  assert.equal(model.deadline, null);
  assert.ok(hoverBridgeBox(button, panel));
});

test("the panel closes 200ms after the pointer leaves the button and the panel", () => {
  assert.equal(HOVER_CLOSE_MS, 200);
  assert.equal(pointerInLinkedRegion(400, 400, button, panel), false);
  const left = reducePanel(open, { type: "pointer-outside", now: 1_000 });
  assert.equal(left.model.open, true);
  assert.equal(left.model.deadline, 1_200);
  const early = reducePanel(left.model, { type: "tick", now: 1_199 });
  assert.equal(early.model.open, true);
  const closed = reducePanel(left.model, { type: "tick", now: 1_200 });
  assert.deepEqual(closed.model, { open: false, deadline: null });
  assert.equal(closed.focusTrigger, false);
});

test("re-entering before 200ms cancels the close", () => {
  const left = reducePanel(open, { type: "pointer-outside", now: 1_000 });
  const back = reducePanel(left.model, { type: "pointer-inside" });
  assert.equal(back.model.deadline, null);
  const later = reducePanel(back.model, { type: "tick", now: 5_000 });
  assert.equal(later.model.open, true);
});

test("Escape closes the panel and asks for focus on the trigger", () => {
  const step = reducePanel(open, { type: "escape" });
  assert.deepEqual(step.model, { open: false, deadline: null });
  assert.equal(step.focusTrigger, true);
});

test("an outside click closes the panel", () => {
  const step = reducePanel(open, { type: "outside-click" });
  assert.deepEqual(step.model, { open: false, deadline: null });
  assert.equal(step.focusTrigger, false);
});

test("keyboard focus leaving the region closes the panel", () => {
  const stayed = reducePanel(open, { type: "focus-out", stillInside: true });
  assert.equal(stayed.model.open, true);
  const left = reducePanel(open, { type: "focus-out", stillInside: false });
  assert.deepEqual(left.model, { open: false, deadline: null });
});

test("clicking the trigger toggles the panel", () => {
  const opened = reducePanel({ open: false, deadline: null }, { type: "toggle" });
  assert.equal(opened.model.open, true);
  const closed = reducePanel(opened.model, { type: "toggle" });
  assert.equal(closed.model.open, false);
});

test("a vertical menu gap between the trigger and the list stays inside", () => {
  const trigger: Box = { left: 200, top: 8, right: 320, bottom: 52 };
  const menu: Box = { left: 200, top: 60, right: 520, bottom: 280 };
  assert.equal(pointerInLinkedRegion(260, 56, trigger, menu), true);
  assert.equal(pointerInLinkedRegion(40, 56, trigger, menu), false);
});

test("touch does not arm a hover-close timer", () => {
  const step = reducePanel(open, { type: "pointer-outside", now: 1_000 }, false);
  assert.equal(step.model.deadline, null);
  assert.equal(step.model.open, true);
  assert.equal(isHoverPointer("touch"), false);
  assert.equal(isHoverPointer("mouse"), true);
  assert.equal(isHoverPointer("pen"), true);
});

test("a desktop that does not report a fine pointer can still hover", () => {
  const none = () => false;
  assert.equal(hoverFromMedia(none), true);
  assert.equal(
    hoverFromMedia((query) => query === "(hover: none)" || query === "(pointer: coarse)"),
    false,
  );
  assert.equal(hoverFromMedia((query) => query === "(hover: hover)"), true);
});
