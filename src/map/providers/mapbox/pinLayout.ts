// How a pin is laid out around its start point, in dp, x to the right and y down as on screen. The
// numbers follow the images beside this file (D116).

// The teardrop images (shadow, outline, body and its halves, centre) share one 60 × 75 px canvas at 3 px per dp:
// the tip 1 dp above the bottom edge, the head's centre 14 dp above the tip, its radius 8 dp.
export const TEARDROP = {
  scale: 3,
  // Anchored at the image's bottom, moved down by the margin under the tip, so the tip is on the start.
  offset: [0, 1] as [number, number],
  headCentre: 14,
}

// The tag's image, a white rounded box of 60 × 60 px stretched around its text: its content box and
// stretchable bands in image px. At this scale the tag is about 16 dp tall around text at 11.
export const TAG_IMAGE = {
  scale: 54 / 15,
  content: [24, 6, 36, 54] as [number, number, number, number],
  stretchX: [[29, 31]] as [number, number][],
  stretchY: [[29, 31]] as [number, number][],
}

const TAG_TEXT_SIZE = 11
const TAG_TEXT_LEFT = 13.5

// The tag beside the head, vertically centred on it, its image starting under the head's centre and
// running under the teardrop's right half. Offsets are in ems, the fit padding in dp.
export const TAG = {
  textSize: TAG_TEXT_SIZE,
  textOffset: [TAG_TEXT_LEFT / TAG_TEXT_SIZE, -TEARDROP.headCentre / TAG_TEXT_SIZE] as [number, number],
  // [top, right, bottom, left]
  iconTextFitPadding: [0, 5, 0, TAG_TEXT_LEFT - TAG_IMAGE.content[0] / TAG_IMAGE.scale] as [number, number, number, number],
  iconPadding: 2,
}

// The place a teardrop reserves against tags, an invisible image of 8 × 22 dp anchored at its bottom
// right: from the head's left edge to just short of its centre, from the head's top to the tip. It stops short of
// the centre because the pin's own tag starts there, and a symbol's box collides with every other
// box, its own pin's included. A tag reaching the teardrop's right half would start inside its head,
// which only a pin close enough to be in the same cluster can do.
export const ROOM = {
  scale: 3,
  offset: [-3, 0] as [number, number],
  padding: 0,
}
