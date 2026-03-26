export interface Source {
  title: string;
  tier: 1 | 2 | 3;
  page: number | null;
  url: string | null;
  date: string | null;
  declassified: boolean;
  sourceType: string;
}