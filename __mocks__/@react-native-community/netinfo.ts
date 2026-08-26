// Manual Jest mock: the native module isn't linked under Jest. Only the surface the
// connectivity adapter uses is stubbed — extend if more is needed.
const NetInfo = {
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}

export default NetInfo
