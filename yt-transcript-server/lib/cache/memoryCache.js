const store = new Map();

function readBucket(videoId) {
  if (!store.has(videoId)) {
    store.set(videoId, {});
  }

  return store.get(videoId);
}

export const cache = {
  get(videoId, key) {
    return readBucket(videoId)[key] || null;
  },

  set(videoId, key, value) {
    const bucket = readBucket(videoId);
    bucket[key] = {
      value,
      createdAt: new Date().toISOString(),
    };
    return value;
  },

  getValue(videoId, key) {
    return this.get(videoId, key)?.value || null;
  },

  snapshot(videoId) {
    return readBucket(videoId);
  },
};
