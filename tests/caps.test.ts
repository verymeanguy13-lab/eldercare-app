import { describe, it, expect } from 'vitest';
import { isWithinMemberCap } from '../lib/caps';

describe('isWithinMemberCap', () => {
  it('allows paid tier regardless of count', () => {
    expect(isWithinMemberCap('paid', 999).allowed).toBe(true);
  });
  it('allows free tier under the cap', () => {
    expect(isWithinMemberCap('free', 2).allowed).toBe(true);
  });
  it('blocks free tier at the cap', () => {
    const result = isWithinMemberCap('free', 3);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});