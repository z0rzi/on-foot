import fs from 'fs'
import path from 'path'
import { ROOM, TAG, TAG_IMAGE, TEARDROP } from '../pinLayout'

// An image's size in dp at its scale, read from its PNG header.
function imageSize(file: string, scale: number): { width: number; height: number } {
  const header = fs.readFileSync(path.join(__dirname, '..', file))
  return { width: header.readUInt32BE(16) / scale, height: header.readUInt32BE(20) / scale }
}

// The teardrop's head, as its images draw it.
const HEAD_RADIUS = 8
const roomImage = imageSize('overview-pin-room.png', ROOM.scale)

// Mapbox's placement, in dp from the start point (x right, y down): a text anchored left starts at its
// offset (in ems); an icon fitted around it reaches past the text by the fit padding, then by the
// image's part outside its content box; a box takes its padding on every side in collisions.
const tagText = { left: TAG.textOffset[0] * TAG.textSize, middle: TAG.textOffset[1] * TAG.textSize }
const tagImageLeft = tagText.left - TAG.iconTextFitPadding[3] - TAG_IMAGE.content[0] / TAG_IMAGE.scale
const room = {
  right: ROOM.offset[0],
  left: ROOM.offset[0] - roomImage.width,
  top: ROOM.offset[1] - roomImage.height,
}

describe('the pin’s layout (D116)', () => {
  it('starts the tag’s image under the head’s centre, above the tip', () => expect(tagImageLeft).toBeCloseTo(0, 5))

  it('centres the tag’s text on the head', () => expect(tagText.middle).toBeCloseTo(-TEARDROP.headCentre, 5))
})

describe('the teardrop’s reserved place (D136)', () => {
  it('reaches the head’s left edge and its top', () => {
    expect(room.left - ROOM.padding).toBeLessThanOrEqual(-HEAD_RADIUS)
    expect(room.top - ROOM.padding).toBeLessThanOrEqual(-(TEARDROP.headCentre + HEAD_RADIUS))
  })

  it('stops short of its own tag, which would otherwise always give way to it', () =>
    expect(room.right + ROOM.padding).toBeLessThan(tagImageLeft - TAG.iconPadding))
})
