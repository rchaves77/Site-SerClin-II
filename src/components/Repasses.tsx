import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  Calculator, ArrowLeft, ClipboardList, Download, FileSpreadsheet, FileText,
  TrendingUp, Building2, UserCircle 
} from "lucide-react";
import { toast } from "sonner";

// Bibliotecas de Exportação
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RepassesProps {
  setView: (view: string) => void;
}

export function Repasses({ setView }: RepassesProps) {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth().toString());
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<string>("todos");
  const [loading, setLoading] = useState(false);

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('perfis').select('*').order('nome');
      const { data: a } = await supabase.from('agendamentos').select('*').eq('status', 'Presenca');
      if (p) setEquipe(p);
      if (a) setAtendimentos(a);
    } catch (e: any) {
      toast.error("Erro ao carregar dados financeiros.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- LÓGICA DE CÁLCULO FINANCEIRO ---
  const relatorio = equipe.map(prof => {
    const atendimentosProf = atendimentos.filter(at => {
      const dataAt = new Date(at.data_inicio);
      return at.profissional === prof.nome && 
             dataAt.getMonth().toString() === filtroMes &&
             dataAt.getFullYear().toString() === filtroAno;
    });

    const totalBruto = atendimentosProf.reduce((acc, at) => {
      const valorStr = String(at.valor_atendimento || "0")
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(".", "")
        .replace(",", ".");
      const valor = parseFloat(valorStr) || 0;
      return acc + valor;
    }, 0);

    const impostoRetido = totalBruto * ((prof.imposto_retido || 0) / 100);
    const valorLiquido = totalBruto - impostoRetido;
    const parteProfissional = valorLiquido * ((prof.porcentagem_repasse || 50) / 100);
    const parteEmpresa = valorLiquido - parteProfissional;

    return {
      ...prof,
      totalBruto,
      impostoRetido,
      valorLiquido,
      parteProfissional,
      parteEmpresa,
      qtd: atendimentosProf.length
    };
  }).filter(p => p.qtd > 0);

  // Filtro para a lista lateral de detalhes
  const atendimentosDetalhado = atendimentos.filter(at => {
    const dataAt = new Date(at.data_inicio);
    const matchesMes = dataAt.getMonth().toString() === filtroMes;
    const matchesAno = dataAt.getFullYear().toString() === filtroAno;
    const matchesProf = profissionalSelecionado === "todos" || at.profissional === profissionalSelecionado;
    return matchesMes && matchesAno && matchesProf;
  }).sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

  const totalClinica = relatorio.reduce((acc, p) => acc + p.parteEmpresa, 0);
  const totalPagamentos = relatorio.reduce((acc, p) => acc + p.parteProfissional, 0);

  // --- FUNÇÃO EXPORTAR PDF ---
  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Repasses - SerClin", 14, 20);
    doc.setFontSize(10);
    doc.text(`Competência: ${meses[parseInt(filtroMes)]} / ${filtroAno}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Profissional', 'Qtd', 'Faturamento Bruto', 'Repasse (Líquido)', 'Lucro Clínica']],
      body: relatorio.map(p => [
        p.nome, p.qtd, 
        `R$ ${p.totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        `R$ ${p.parteProfissional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        `R$ ${p.parteEmpresa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]),
      headStyles: { fillColor: [30, 58, 138] },
      foot: [['TOTAIS', '', `R$ ${(totalClinica+totalPagamentos).toLocaleString('pt-BR')}`, `R$ ${totalPagamentos.toLocaleString('pt-BR')}`, `R$ ${totalClinica.toLocaleString('pt-BR')}`]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save(`repasses-serclin-${meses[parseInt(filtroMes)]}.pdf`);
  };

  // --- FUNÇÃO EXPORTAR EXCEL (CSV) ---
  const exportarCSV = () => {
    let csv = "\uFEFFProfissional;Atendimentos;Faturamento Bruto;Repasse Profissional;Lucro Clinica\n";
    relatorio.forEach(p => {
      csv += `${p.nome};${p.qtd};${p.totalBruto.toFixed(2).replace('.', ',')};${p.parteProfissional.toFixed(2).replace('.', ',')};${p.parteEmpresa.toFixed(2).replace('.', ',')}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `financeiro-serclin-${filtroMes}-${filtroAno}.csv`);
    link.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 text-left mt-20">
      
      {/* HEADER E FILTROS */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-none bg-transparent">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setView('acessos')} className="rounded-full border-gray-200 hover:bg-gray-100 cursor-pointer">
            <ArrowLeft size={16} className="mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-black text-[#1e3a8a] uppercase flex items-center gap-3">
              <Calculator className="text-blue-600" size={28} /> Fechamento de Caixa
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg mr-2 border border-gray-200">
            <Button onClick={exportarPDF} variant="ghost" size="sm" className="text-red-600 hover:bg-white font-bold gap-1 cursor-pointer"><FileText size={16} /> PDF</Button>
            <Button onClick={exportarCSV} variant="ghost" size="sm" className="text-emerald-600 hover:bg-white font-bold gap-1 cursor-pointer"><FileSpreadsheet size={16} /> EXCEL</Button>
          </div>

          <Select value={profissionalSelecionado} onValueChange={setProfissionalSelecionado}>
            <SelectTrigger className="w-44 bg-white font-bold border-blue-100"><SelectValue placeholder="Profissional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Profissionais</SelectItem>
              {equipe.map(p => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-32 bg-white font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Select value={filtroAno} onValueChange={setFiltroAno}>
            <SelectTrigger className="w-24 bg-white font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* CARDS DE RESUMO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#1e3a8a] text-white shadow-xl border-none relative overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase opacity-80 font-black">Faturamento Bruto</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-black">R$ {(totalClinica + totalPagamentos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <TrendingUp size={48} className="absolute right-[-10px] bottom-[-10px] opacity-10" />
          </CardContent>
        </Card>

        <Card className="bg-white border-emerald-100 shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase text-emerald-600 font-black">Lucro Líquido Clínica</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-emerald-600">R$ {totalClinica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <Building2 size={40} className="absolute right-4 bottom-4 text-emerald-50" />
          </CardContent>
        </Card>

        <Card className="bg-white border-blue-100 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] uppercase text-blue-600 font-black">Total a Repassar</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-blue-600">R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <UserCircle size={40} className="absolute right-4 bottom-4 text-blue-50" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LADO ESQUERDO: TABELA CONSOLIDADA */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider px-1">Divisão por Profissional</h3>
          <Card className="shadow-sm border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                  <tr>
                    <th className="px-6 py-4">Profissional</th>
                    <th className="px-6 py-4 text-center">Atend.</th>
                    <th className="px-6 py-4">Bruto</th>
                    <th className="px-6 py-4">Comissão</th>
                    <th className="px-6 py-4 bg-blue-50/50 text-blue-700 text-right">Lucro Clínica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400 uppercase font-black text-xs">Carregando dados...</td>
                    </tr>
                  ) : relatorio.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400 uppercase font-black text-xs">Nenhum repasse no período.</td>
                    </tr>
                  ) : (
                    relatorio.map(p => (
                      <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${profissionalSelecionado === p.nome ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 uppercase text-[#1e3a8a] text-xs">
                          {p.nome}
                          <span className="block text-[9px] text-gray-400 font-normal">{p.cargo || "Profissional"}</span>
                        </td>
                        <td className="px-6 py-4 text-center">{p.qtd}</td>
                        <td className="px-6 py-4 text-gray-400 font-normal">R$ {p.totalBruto.toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-4 text-blue-600">R$ {p.parteProfissional.toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-4 bg-blue-50/30 text-emerald-600 text-right">R$ {p.parteEmpresa.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* LADO DIREITO: LISTA DE ATENDIMENTOS INDIVIDUAIS */}
        <div className="space-y-6">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider flex items-center gap-2 px-1">
            <ClipboardList size={16} /> Extrato Detalhado
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {atendimentosDetalhado.length > 0 ? (
              atendimentosDetalhado.map((at) => {
                const valorStr = String(at.valor_atendimento || "0")
                  .replace("R$", "")
                  .trim();
                return (
                  <div key={at.id} className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:border-blue-200 transition-all border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[9px] font-black text-blue-500 uppercase">{new Date(at.data_inicio).toLocaleDateString('pt-BR')}</span>
                      <span className="text-emerald-600 font-black text-xs">R$ {valorStr}</span>
                    </div>
                    <h4 className="text-[#1e3a8a] font-bold uppercase text-[11px] truncate">{at.paciente_nome}</h4>
                    <p className="text-[9px] text-gray-400 uppercase font-medium">{at.profissional}</p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase">Nenhum registro encontrado.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
