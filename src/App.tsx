import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { EtaTimeline, ExpenseCharts, PriorityChart, StatusChart } from './components/Visuals';
import { fetchPublishedCsv, validateSpreadsheetFile } from './security';
import type { DashboardView, ProcessRecord } from './types';

const remoteSource = import.meta.env.VITE_FUP_SHEET_URL as string | undefined;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const PAGE_SIZE = 50;

function viewFromPath(pathname: string): DashboardView {
  if (/despesa|index_despesas/i.test(pathname)) return 'despesas';
  if (/pre-shipment|pre_shipment|pedidos/i.test(pathname)) return 'pre-shipment';
  return 'fup';
}

function navigate(view: DashboardView) {
  const path = view === 'fup' ? '/' : `/${view}`;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('deliver') || normalized.includes('entreg')) return 'done';
  if (normalized.includes('custom') || normalized.includes('desemb')) return 'warning';
  if (normalized.includes('transit') || normalized.includes('embar')) return 'info';
  return 'neutral';
}

function InputPanel({ onRecords }: { onRecords: (records: ProcessRecord[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Carregue uma planilha .xlsx ou .csv. Os dados permanecem neste navegador.');
  const [sheetUrl, setSheetUrl] = useState(remoteSource ?? '');

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      validateSpreadsheetFile(file);
      const { parseFile } = await import('./spreadsheet');
      const records = await parseFile(file);
      onRecords(records);
      setMessage(`${records.length} registros carregados de ${file.name}.`);
    } catch {
      setMessage('Não foi possível interpretar a planilha. Verifique cabeçalhos e formato do arquivo.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function loadSheet() {
    if (!sheetUrl.trim()) return;
    try {
      setBusy(true);
      const [csv, { parseWorkbook }] = await Promise.all([
        fetchPublishedCsv(sheetUrl.trim()),
        import('./spreadsheet')
      ]);
      const records = parseWorkbook(csv);
      onRecords(records);
      setMessage(`${records.length} registros carregados da planilha publicada.`);
    } catch {
      setMessage('Não foi possível ler esta URL. A planilha deve estar publicada como CSV e liberar CORS.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="import-panel">
    <div className="source-copy">
      <strong>Fonte de dados</strong>
      <p>{message}</p>
    </div>
    <div className="source-actions"><div className="url-source"><input aria-label="URL CSV da Google Sheet" value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="URL CSV da Google Sheet publicada" /><button className="button" disabled={busy || !sheetUrl.trim()} onClick={loadSheet}>Atualizar</button></div><label className="button primary">
        {busy ? 'Processando…' : 'Importar planilha'}
        <input type="file" accept=".xlsx,.xls,.csv" onChange={upload} disabled={busy} />
      </label></div>
  </section>;
}

function Kpi({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return <article className={`kpi ${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function EmptyState() {
  return <section className="empty"><h2>Sem dados carregados</h2><p>Importe a planilha operacional para visualizar indicadores, filtros e a tabela de processos.</p></section>;
}

function FupDashboard({ records, showKpis = true, onSelect }: { records: ProcessRecord[]; showKpis?: boolean; onSelect?: (record: ProcessRecord) => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const groups = useMemo(() => [...new Set(records.map((r) => r.group).filter(Boolean))].sort(), [records]);
  const statuses = useMemo(() => [...new Set(records.map((r) => r.status).filter(Boolean))].sort(), [records]);
  const filtered = useMemo(() => records.filter((record) => {
    const search = `${record.id} ${record.po} ${record.supplier} ${record.analyst}`.toLowerCase();
    return (!query || search.includes(query.toLowerCase())) && (!group || record.group === group) && (!status || record.status === status);
  }), [records, query, group, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const pageRecords = useMemo(() => filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE), [activePage, filtered]);
  const inTransit = filtered.filter((r) => /transit|embar/i.test(r.status)).length;
  const customs = filtered.filter((r) => /custom|desemb/i.test(r.status)).length;
  const delivered = filtered.filter((r) => /deliver|entreg/i.test(r.status)).length;

  if (!records.length) return <EmptyState />;
  return <>
    {showKpis && <section className="kpis"><Kpi label="Processos" value={filtered.length} tone="blue" /><Kpi label="Em trânsito" value={inTransit} tone="purple" /><Kpi label="Desembaraço" value={customs} tone="orange" /><Kpi label="Entregues" value={delivered} tone="green" /></section>}
    <section className="charts"><StatusChart records={filtered} /><PriorityChart records={filtered} /><EtaTimeline records={filtered} /></section>
    <section className="filters">
      <input aria-label="Buscar processo" placeholder="Buscar processo, PO, fornecedor ou analista" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
      <select aria-label="Filtrar grupo" value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }}><option value="">Todos os grupos</option>{groups.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Filtrar status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todos os status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
      <button className="button" onClick={() => { setQuery(''); setGroup(''); setStatus(''); setPage(1); }}>Limpar filtros</button>
    </section>
    <section className="table-card"><table><thead><tr><th>Processo</th><th>PO</th><th>Grupo</th><th>Fornecedor</th><th>Status</th><th>Prioridade</th><th>ETA</th><th>ETE</th><th>Analista</th></tr></thead><tbody>
      {pageRecords.map((record) => <tr key={record.id} onClick={() => onSelect?.(record)}><td className="identifier">{record.id}</td><td>{record.po || '—'}</td><td>{record.group || '—'}</td><td>{record.supplier || '—'}</td><td><span className={`status ${statusClass(record.status)}`}>{record.status}</span></td><td>{record.priority ?? '—'}</td><td>{record.eta || '—'}</td><td>{record.ete || '—'}</td><td>{record.analyst || '—'}</td></tr>)}
    </tbody></table><div className="pagination" aria-label="Paginação da tabela"><span>{filtered.length ? `${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(activePage * PAGE_SIZE, filtered.length)} de ${filtered.length}` : 'Nenhum registro'}</span><div><button className="button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Anterior</button><span>Página {activePage} de {totalPages}</span><button className="button" disabled={activePage === totalPages} onClick={() => setPage(activePage + 1)}>Próxima</button></div></div></section>
  </>;
}

function PurchaseDashboard({ records, onSelect }: { records: ProcessRecord[]; onSelect?: (record: ProcessRecord) => void }) {
  if (!records.length) return <EmptyState />;
  const suppliers = new Set(records.map((r) => r.supplier).filter(Boolean)).size;
  const open = records.filter((r) => !/deliver|entreg|closed|fech/i.test(r.status)).length;
  return <><section className="kpis"><Kpi label="Pedidos" value={records.length} tone="blue" /><Kpi label="Em aberto" value={open} tone="orange" /><Kpi label="Fornecedores" value={suppliers} tone="purple" /><Kpi label="Com ETE" value={records.filter((r) => r.ete).length} tone="green" /></section><FupDashboard records={records} showKpis={false} onSelect={onSelect} /></>;
}

function ExpensesDashboard({ records, onSelect }: { records: ProcessRecord[]; onSelect?: (record: ProcessRecord) => void }) {
  if (!records.length) return <EmptyState />;
  const total = records.reduce((sum, r) => sum + r.storage + r.demurrage + r.fines, 0);
  const storage = records.reduce((sum, r) => sum + r.storage, 0);
  const demurrage = records.reduce((sum, r) => sum + r.demurrage, 0);
  return <><section className="kpis"><Kpi label="Despesa total" value={money.format(total)} tone="blue" /><Kpi label="Armazenagem" value={money.format(storage)} tone="orange" /><Kpi label="Demurrage" value={money.format(demurrage)} tone="purple" /><Kpi label="Multas" value={money.format(records.reduce((sum, r) => sum + r.fines, 0))} tone="red" /></section><ExpenseCharts records={records} /><section className="table-card"><table><thead><tr><th>Processo</th><th>Fornecedor</th><th>Armazenagem</th><th>Demurrage</th><th>Multas</th><th>Total</th></tr></thead><tbody>{records.filter((r) => r.storage || r.demurrage || r.fines).sort((a, b) => (b.storage + b.demurrage + b.fines) - (a.storage + a.demurrage + a.fines)).map((r) => <tr key={r.id} onClick={() => onSelect?.(r)}><td className="identifier">{r.id}</td><td>{r.supplier || '—'}</td><td>{money.format(r.storage)}</td><td>{money.format(r.demurrage)}</td><td>{money.format(r.fines)}</td><td><strong>{money.format(r.storage + r.demurrage + r.fines)}</strong></td></tr>)}</tbody></table></section></>;
}

function RecordDetail({ record, onClose }: { record: ProcessRecord; onClose: () => void }) {
  const fields = [['Processo', record.id], ['Pedido de compra', record.po], ['Grupo', record.group], ['Fornecedor', record.supplier], ['Status', record.status], ['Prioridade', record.priority?.toString() ?? '—'], ['Modal', record.mode], ['Incoterm', record.incoterm], ['ETA', record.eta], ['ETE', record.ete], ['Analista', record.analyst]];
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="detail-modal" role="dialog" aria-modal="true" aria-label={`Processo ${record.id}`} onMouseDown={(event) => event.stopPropagation()}><div className="detail-header"><div><span>DETALHE DO PROCESSO</span><h2>{record.id}</h2></div><button aria-label="Fechar" onClick={onClose}>×</button></div><div className="detail-grid">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}</div><div className="detail-costs"><span>Despesas registradas</span><strong>{money.format(record.storage + record.demurrage + record.fines)}</strong></div></section></div>;
}

export function App() {
  const [view, setView] = useState<DashboardView>(() => viewFromPath(window.location.pathname));
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [sourceError, setSourceError] = useState('');
  const [selected, setSelected] = useState<ProcessRecord | null>(null);

  useEffect(() => {
    const onPopState = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!remoteSource) return;
    Promise.all([fetchPublishedCsv(remoteSource), import('./spreadsheet')])
      .then(([csv, { parseWorkbook }]) => setRecords(parseWorkbook(csv)))
      .catch(() => setSourceError('A fonte padrão não pôde ser carregada. Importe uma planilha para continuar.'));
  }, []);

  const title = view === 'fup' ? 'FUP · Processos de Importação' : view === 'pre-shipment' ? 'PO · Acompanhamento de Pedidos' : 'Despesas de Importação';
  return <div className="app-shell"><header><div><span className="brand">ELETRA</span><h1>COMEX · {title}</h1><small>Eletra Energy Solutions · acompanhamento operacional</small></div><div className="header-tools"><span className="connection">● Dados locais</span><nav>{([['fup', 'FUP'], ['pre-shipment', 'Pré-embarque'], ['despesas', 'Despesas']] as [DashboardView, string][]).map(([key, label]) => <button className={view === key ? 'active' : ''} key={key} onClick={() => navigate(key)}>{label}</button>)}</nav></div></header><main><InputPanel onRecords={setRecords} />{sourceError && <p className="notice">{sourceError}</p>}{view === 'fup' && <FupDashboard records={records} onSelect={setSelected} />}{view === 'pre-shipment' && <PurchaseDashboard records={records} onSelect={setSelected} />}{view === 'despesas' && <ExpensesDashboard records={records} onSelect={setSelected} />}</main>{selected && <RecordDetail record={selected} onClose={() => setSelected(null)} />}</div>;
}
