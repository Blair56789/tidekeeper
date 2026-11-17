// A small seeded generator (mulberry32): the same seed always deals the same
// waves, shots and screenshot scenes, so a run can be replayed exactly.
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** Next integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** Pick one element of an array. */
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    },
  };
}
