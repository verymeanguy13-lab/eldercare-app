import { describe, it, expect } from 'vitest';
import { hasRequiredRole } from '../lib/require-circle-member';

describe('hasRequiredRole', () => {
  it('admin meets any requirement', () => {
    expect(hasRequiredRole('admin', 'admin')).toBe(true);
    expect(hasRequiredRole('admin', 'viewer')).toBe(true);
  });
  it('viewer does not meet family_member requirement', () => {
    expect(hasRequiredRole('viewer', 'family_member')).toBe(false);
  });
  it('family_member meets caregiver requirement', () => {
    expect(hasRequiredRole('family_member', 'caregiver')).toBe(true);
  });
});