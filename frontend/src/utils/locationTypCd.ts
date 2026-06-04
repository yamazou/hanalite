import type { LocationMaster } from '../types/masters'

/** True when location's type master code matches (case-insensitive). */
export function locationHasTypCd(
  loc: Pick<LocationMaster, 'locationtyp_cd'>,
  cd: string
): boolean {
  return (loc.locationtyp_cd ?? '').trim().toUpperCase() === cd.trim().toUpperCase()
}
