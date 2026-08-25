import { getEmbeddedKoffi } from './koffi-runtime';

/**
 * Bundler alias for DSH's `koffi` import. The DSH public API still owns all
 * ACL/token/Job Object behavior; this shim only makes its exact native Koffi
 * payload available after the host verified and extracted it.
 */
const koffi = new Proxy({}, {
  get(_target, property) {
    const native = getEmbeddedKoffi() as Record<PropertyKey, unknown>;
    const value = native[property];
    return typeof value === 'function' ? value.bind(native) : value;
  },
});

export default koffi;
