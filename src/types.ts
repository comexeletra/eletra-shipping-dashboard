export type DashboardView = 'fup' | 'pre-shipment' | 'despesas';

export type ProcessRecord = {
  id: string;
  po: string;
  group: string;
  supplier: string;
  status: string;
  priority: number | null;
  mode: string;
  analyst: string;
  eta: string;
  ete: string;
  etd: string;
  incoterm: string;
  storage: number;
  demurrage: number;
  fines: number;
  raw: Record<string, unknown>;
};
