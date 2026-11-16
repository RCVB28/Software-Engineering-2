export interface Principal {
  id: string;
  kind: 'ADMIN' | 'RESIDENT';
  role: string;
  barangayId?: string | null;
  email?: string;
}
