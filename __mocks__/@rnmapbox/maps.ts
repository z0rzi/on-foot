// Manual Jest mock: the real package throws at import time when its native module isn't
// linked (always true under Jest). Only the offline manager surface is stubbed — extend as
// other mapbox-adapter files gain tests.
const offlineManager = {
  createPack: jest.fn(),
  deletePack: jest.fn(),
  getPack: jest.fn(),
  getPacks: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}

export default { offlineManager, setAccessToken: jest.fn() }
