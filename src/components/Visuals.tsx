import type { ReactNode } from 'react';
import type { ProcessRecord } from '../types';

type Bucket = { label: string; value: number; tone: string };

function Card({ title, children, action }: { title: string; children: ReactNode; action?: string }) {
  return <section className="chart-card"><div className="chart-header"><h3>{title}</h3>{action && <span className="chart-pill">{action}</span>}</div>{children}</section>;
}

export function StatusChart({ records }: { records: ProcessRecord[] }) {
  const buckets = Object.entries(records.reduce<Record<string, number>>((all, record) => {
    all[record.status] = (all[record.status] ?? 0) + 1;
    return all;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value], index): Bucket => ({ label, value, tone: ['blue', 'amber', 'orange', 'green', 'purple', 'gray'][index] }));
  const max = Math.max(...buckets.map((item) => item.value), 1);
  return <Card title="Status · distribuição" action={`${records.length} processos`}><div className="bar-list">{buckets.map((item) => <div className="bar-row" key={item.label}><span title={item.label}>{item.label}</span><div className="bar-track"><i className={item.tone} style={{ width: `${item.value / max * 100}%` }} /></div><b>{item.value}</b></div>)}</div></Card>;
}

export function PriorityChart({ records }: { records: ProcessRecord[] }) {
  const buckets = [1, 2, 3, 4, 5].map((priority) => ({ label: `Prioridade ${priority}`, value: records.filter((record) => record.priority === priority).length, tone: ['red', 'orange', 'amber', 'blue', 'gray'][priority - 1] }));
  const max = Math.max(...buckets.map((item) => item.value), 1);
  return <Card title="Prioridade" action="clique para filtrar"><div className="bar-list">{buckets.map((item) => <div className="bar-row" key={item.label}><span>{item.label}</span><div className="bar-track"><i className={item.tone} style={{ width: `${item.value / max * 100}%` }} /></div><b>{item.value}</b></div>)}</div></Card>;
}

function toDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const parsed = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function EtaTimeline({ records }: { records: ProcessRecord[] }) {
  const items = records.map((record) => ({ record, date: toDate(record.ete) ?? toDate(record.eta) })).filter((item): item is { record: ProcessRecord; date: Date } => item.date !== null).sort((a, b) => a.date.valueOf() - b.date.valueOf()).slice(0, 8);
  const dates = items.map((item) => item.date.valueOf());
  const min = Math.min(...dates, Date.now());
  const max = Math.max(...dates, min + 86_400_000 * 7);
  const range = max - min || 1;
  return <Card title="ETE real / esperado · próximas entregas" action={items.length ? `${items.length} eventos` : 'sem datas'}>{items.length ? <div className="timeline">{items.map(({ record, date }) => <div className="timeline-row" key={record.id}><span title={record.id}>{record.id}</span><div className="timeline-track"><i style={{ left: `${Math.max(0, (date.valueOf() - min) / range * 100)}%` }} /></div><b>{record.ete || record.eta}</b></div>)}</div> : <p className="chart-empty">Não há ETA/ETE válidos na fonte.</p>}</Card>;
}

export function ExpenseCharts({ records }: { records: ProcessRecord[] }) {
  const costs = records.map((record) => ({ record, total: record.storage + record.demurrage + record.fines })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 15);
  const storage = records.reduce((total, record) => total + record.storage, 0);
  const demurrage = records.reduce((total, record) => total + record.demurrage, 0);
  const fines = records.reduce((total, record) => total + record.fines, 0);
  const total = storage + demurrage + fines;
  const max = Math.max(...costs.map((item) => item.total), 1);
  const storagePct = total ? storage / total * 100 : 0;
  const demurragePct = total ? demurrage / total * 100 : 0;
  return <section className="charts expense-charts"><Card title="Top 15 processos por despesa total" action={`${costs.length} processos`}><div className="bar-list expense-bars">{costs.map(({ record, total: cost }) => <div className="bar-row" key={record.id}><span>{record.id}</span><div className="bar-track"><i className="blue" style={{ width: `${cost / max * 100}%` }} /></div><b>{new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(cost)}</b></div>)}</div></Card><Card title="Composição das despesas" action={total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(total) : 'sem dados'}><div className="donut-layout"><div className="donut" style={{ background: `conic-gradient(#d97706 0 ${storagePct}%, #dc2626 ${storagePct}% ${storagePct + demurragePct}%, #7c3aed ${storagePct + demurragePct}% 100%)` }}><span>{total ? '100%' : '—'}</span></div><ul className="legend"><li><i className="orange" />Armazenagem <b>{storagePct.toFixed(0)}%</b></li><li><i className="red" />Demurrage <b>{demurragePct.toFixed(0)}%</b></li><li><i className="purple" />Multas <b>{total ? (fines / total * 100).toFixed(0) : 0}%</b></li></ul></div></Card></section>;
}
