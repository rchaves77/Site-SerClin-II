import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 
import { 
  ArrowLeft, User, Save, Edit, AlertCircle, 
  Paperclip, FileText, Trash2, 
  Calendar as CalendarIcon, X, RefreshCw, Clock,
  FileEdit, ClipboardList, History, Brain, Plus, Activity,
  Bold, Italic, Underline, AlignLeft, AlignCenter, Palette, Type, CheckCircle2, Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePerfil } from "@/hooks/usePerfil";

// --- FUNÇÕES DE MÁSCARA E FORMATAÇÃO (PRESERVADAS) ---
const formatarDataSegura = (data: string | null | undefined) => {
  if (!data) return "Data desconhecida";
  try { return format(new Date(data), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch (e) { return "Data inválida"; }
};

const formatarTelefone = (tel: string | null | undefined) => {
  if (!tel) return "Não informado";
  let v = tel.replace(/\D/g, "");
  if (v.length === 11) return v.replace(/(\d{2})(\d)(\d{4})(\d{4})/, "($1) $2 $3-$4");
  if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return tel;
};

const formatarCPF = (cpf: string | null | undefined) => {
  if (!cpf) return "Não informado";
  let v = cpf.replace(/\D/g, "");
  if (v.length === 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cpf;
};

interface ProntuarioProps {
  setView: (view: string) => void;
  patientId: string;
}

export function Prontuario({ setView, patientId }: ProntuarioProps) {
  const id = patientId;
  
  const navigate = (path: string) => {
    if (path === "/sistema/pacientes" || path.includes("/pacientes")) {
      setView("pacientes");
    } else {
      setView("acessos");
    }
  };

  const { isSecretaria, isAdmin } = usePerfil(); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null); 
  
  // ESTADOS DO PRONTUÁRIO
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [registros, setRegistros] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false); 
  const [resumoPresenca, setResumoPresenca] = useState({ presencas: 0, faltas: 0 });
  const [modoEdicao, setModoEdicao] = useState<string | null>(null);
  const [meuPerfil, setMeuPerfil] = useState<any>(null);
  // ESTADOS DO EDITOR 
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false);
  const [equipeClinica, setEquipeClinica] = useState<any[]>([]); 
  const [loadingAgendamento, setLoadingAgendamento] = useState(false);
  const [isEditPacienteOpen, setIsEditPacienteOpen] = useState(false);
  const [tempDados, setTempDados] = useState({ anamnese: "", observacoes: "" });

  const [formAgendamento, setFormAgendamento] = useState({ 
    profissional: '', sala: '1', inicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
    duracao: '40', status: 'Agendado', valor_atendimento: "0.00", forma_pagamento: "Pix"
  });

  const [novoRegistro, setNovoRegistro] = useState({ 
    tipo: isSecretaria ? "Laudo" : "Sessão", 
    descricao: "" 
  });

  const [formLaudo, setFormLaudo] = useState({
    finalidade: "Delinear o perfil neuropsicológico diante das alterações de comportamento.",
    demanda: "",
    procedimentos: "Utilização dos 4 pilares: aplicação de testes cognitivos, entrevistas clínicas, observação comportamental e escalas de avaliação de sintomas.",
    conclusao: "",
    encaminhamentos: "",
    ressalva: "Os resultados aqui descritos são de caráter dinâmico e referem-se ao presente momento...",
    crp_manual: ""
  });
  
  const [testes, setTestes] = useState([
    { id: 1, funcao: "Quociente Intelectual", nome: "SON-R 2½-7", percentil: "", classificacao: "" }
  ]);

  const bateriasPadrao = {
    neuro: [
      { id: 1, funcao: "Inteligência", nome: "WISC-IV / SON-R", percentil: "", classificacao: "" },
      { id: 2, funcao: "Atenção Sustentada", nome: "BPA / TAVIS-4", percentil: "", classificacao: "" },
      { id: 3, funcao: "Memória Operacional", nome: "Dígitos (WISC-IV)", percentil: "", classificacao: "" },
      { id: 4, funcao: "Funções Executivas", nome: "FDT / Trilhas", percentil: "", classificacao: "" }
    ]
  };

  const sugestoesCID = [
    { label: "TEA Nível 1", valor: "TEA (CID-11: 6A02.0) - Sem deficiência intelectual e com prejuízo leve na linguagem." },
    { label: "TEA Nível 2", valor: "TEA (CID-11: 6A02.2) - Com deficiência intelectual e prejuízo na linguagem funcional." },
    { label: "TDAH", valor: "TDAH (CID-11: 6A05.2) - Apresentação Combinada." },
    { label: "Altas Hab.", valor: "Altas Habilidades / Superdotação (CID-11: 6A03)." }
  ];

  const getCorProfissional = (nome: string) => {
    const prof = equipeClinica.find(p => p.nome === nome);
    return prof?.cor || "#1e3a8a";
  };

  const registrarLog = async (acao: string, detalhes: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: perf } = await supabase.from('perfis').select('nome').eq('id', user?.id).single();
      await supabase.from('logs_prontuario').insert([{
        paciente_id: id, profissional_nome: perf?.nome || user?.email, acao, detalhes
      }]);
      carregarLogs();
    } catch (err) { console.error("Erro Auditoria SerClin:", err); }
  };

  const carregarLogs = async () => {
    if (!id || !meuPerfil?.permissao_auditoria) return;
    setLoadingLogs(true);
    const { data } = await supabase.from('logs_prontuario').select('*').eq('paciente_id', id).order('criado_em', { ascending: false }).limit(10);
    setLogs(data || []);
    setLoadingLogs(false);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      if (!id) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: todosPerfis } = await supabase.from('perfis').select('*').order('nome');
      if (user && todosPerfis) {
        const perfilLogado = todosPerfis.find(p => p.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
        setMeuPerfil(perfilLogado);
      }
      const { data: p } = await supabase.from("pacientes").select("*").eq("id", id).maybeSingle();
      setPaciente(p);
      if (p) setTempDados({ anamnese: p.anamnese || "", observacoes: p.observacoes || "" });
      if (p) {
        const { data: ag } = await supabase.from("agendamentos").select("status").eq("paciente_id", id);
        if (ag) {
          setResumoPresenca({
            presencas: ag.filter(a => a.status === 'Presenca' || a.status === 'Presença').length,
            faltas: ag.filter(a => a.status === 'Falta').length
          });
        }
      }
      const { data: r } = await supabase.from("prontuarios").select("*").eq("paciente_id", id).order("created_at", { ascending: false });
      setRegistros(r || []);
      setEquipeClinica(todosPerfis?.filter(p => !['renata', 'admin', 'recepcao'].some(t => (p.nome || "").toLowerCase().includes(t))) || []);
    } catch (e) { toast.error("Erro ao carregar dados."); } finally { setLoading(false); }
  };

  useEffect(() => { carregarDados(); }, [id]);
  useEffect(() => { if (meuPerfil?.permissao_auditoria) carregarLogs(); }, [meuPerfil]);

  const handleSalvarDadosPaciente = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("pacientes").update({ anamnese: tempDados.anamnese, observacoes: tempDados.observacoes }).eq("id", id);
      if (error) throw error;
      await registrarLog("Editou Dados Clínicos", "Atualizou anamnese ou observações.");
      toast.success("Dados clínicos updated!"); setIsEditPacienteOpen(false); carregarDados();
    } catch (err) { toast.error("Erro."); } finally { setLoading(false); }
  };

  const handleSalvarRegistro = async () => {
    // Validação: permite salvar se tiver descrição OU se tiver arquivo anexado
    if (!novoRegistro.descricao && novoRegistro.tipo !== "Laudo Estruturado" && !arquivoSelecionado) {
      return toast.warning("Descreva o atendimento ou anexe um arquivo.");
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let nomeAutor = user?.email === 'romulochaves77@gmail.com' ? "Rômulo Chaves da Silva" : (meuPerfil?.nome || "Profissional SerClin");
      let arquivoUrl: string | null = null;
      let arquivoNome: string | null = null;

      if (arquivoSelecionado) {
        const nomeOriginal = arquivoSelecionado.name;
        const nomeLimpo = nomeOriginal
          .normalize("NFD")               
          .replace(/[\u0300-\u036f]/g, "") 
          .replace(/[^\w.-]/g, "_");       

        const fileName = `${id}/${Date.now()}_${nomeLimpo}`;

        const { error: upErr } = await supabase.storage.from('documentos').upload(fileName, arquivoSelecionado);
        if (upErr) throw upErr;
        
        const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(fileName);
        arquivoUrl = publicUrl; 
        arquivoNome = nomeOriginal; 

        if (!novoRegistro.tipo.includes("Sessão")) {
          await supabase.from('pacientes_arquivos').insert([{
            paciente_id: id,
            nome_arquivo: arquivoNome,
            url_arquivo: arquivoUrl,
            tipo_documento: novoRegistro.tipo
          }]);
        }
      }

      await supabase.from("prontuarios").insert([{
        paciente_id: id, 
        tipo_registro: novoRegistro.tipo, 
        descricao: novoRegistro.descricao || `Arquivo anexo: ${arquivoNome}`,
        profissional_nome: nomeAutor, 
        historico: [], 
        arquivo_url: arquivoUrl, 
        arquivo_nome: arquivoNome
      }]);
      
      await registrarLog("Criou Registro", `Adicionou ${novoRegistro.tipo}`);
      setNovoRegistro({ tipo: isSecretaria ? "Laudo" : "Sessão", descricao: "" });
      setArquivoSelecionado(null); 
      carregarDados();
      toast.success("Registro salvo com sucesso!");

    } catch (error) { 
      console.error("Erro SerClin Storage:", error);
      toast.error("Erro ao subir arquivo. Tente renomear o arquivo para algo simples.");
    } finally { 
      setLoading(false); 
    }
  };

  const formatDoc = (cmd: string, val: string = "") => {
    document.execCommand(cmd, false, val);
  };

  const gerarLaudoPremiumPDF = async () => {
    if (!editorRef.current) return;
    setGerandoPdf(true);
    try {
      const doc = new jsPDF();
      const m = 20;
      let y = 30;

      doc.setFont("times", "bold"); doc.setFontSize(22); doc.setTextColor(30, 58, 138);
      doc.text("INSTITUTO SERCLIN", 105, y, { align: "center" });
      y += 8;
      doc.setFontSize(10); doc.setFont("times", "italic"); doc.setTextColor(120);
      doc.text("Gestão em Saúde e Reabilitação Cognitiva", 105, y, { align: "center" });
      y += 10;
      doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.5); doc.line(20, y, 190, y);
      y += 20;

      doc.setFont("times", "normal"); doc.setFontSize(11); doc.setTextColor(0);
      const textContent = editorRef.current.innerText;
      const splitText = doc.splitTextToSize(textContent, 170);
      
      for(let i=0; i < splitText.length; i++) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(splitText[i], m, y);
          y += 6;
      }

      if (y > 240) { doc.addPage(); y = 20; }
      const pH = doc.internal.pageSize.getHeight();
      y = pH - 50;
      doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(60, y, 150, y);
      y += 6; doc.setFont("times", "bold"); doc.text(meuPerfil?.nome || "Helenara Maria da Silva Mendes Chaves", 105, y, { align: "center" });
      y += 5; doc.setFont("times", "normal"); doc.setFontSize(9);
      doc.text(`Psicóloga e Neuropsicóloga - CRP ${meuPerfil?.conselho || formLaudo.crp_manual || '24/02216'}`, 105, y, { align: "center" });
      
      doc.setDrawColor(200); doc.rect(170, pH - 35, 18, 18); 
      doc.setFontSize(6); doc.setTextColor(150); doc.text("AUTENTICAÇÃO\nDIGITAL", 179, pH - 12, { align: "center" });

      const pdfBlob = doc.output('blob');
      const nomeArquivo = `Laudo_Premium_${paciente?.nome?.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const fileNamePath = `${id}/${nomeArquivo}`;

      const { error: upErr } = await supabase.storage.from('documentos').upload(fileNamePath, pdfBlob);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(fileNamePath);

      await supabase.from("prontuarios").insert([{
        paciente_id: id, tipo_registro: "Laudo Neuropsicológico", 
        descricao: "Documento clínico Premium assinado e autenticado via Editor SerClin.",
        profissional_nome: meuPerfil?.nome, arquivo_url: publicUrl, arquivo_nome: nomeArquivo
      }]);

      toast.success("PDF Premium arquivado com sucesso!");
      setIsEditorOpen(false);
      setNovoRegistro({tipo: 'Sessão', descricao: ''});
      carregarDados();
    } catch (e) { 
      console.error("Erro PDF:", e);
      toast.error("Erro ao gerar PDF Premium."); 
    } finally { setGerandoPdf(false); }
  };

  const gerarESalvarLaudoPDF = async () => {
    setGerandoPdf(true);
    try {
      const doc = new jsPDF();
      const margemEsq = 20;
      let y = 20;

      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 58, 138);
      doc.text("LAUDO PSICOLÓGICO – AVALIAÇÃO NEUROPSICOLÓGICA", 45, y);
      y += 15;

      doc.setFontSize(10); doc.text("1. IDENTIFICAÇÃO DO PROFISSIONAL", margemEsq, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      doc.text(`Nome: ${meuPerfil?.nome || 'Profissional SerClin'}`, margemEsq, y); y += 6;
      doc.text(`Registro/CRP: ${meuPerfil?.conselho || 'Não informado'}`, margemEsq, y); y += 10;

      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 138);
      doc.text("2. IDENTIFICAÇÃO DO PACIENTE", margemEsq, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      doc.text(`Nome: ${paciente?.nome || ''}`, margemEsq, y); y += 6;
      doc.text(`Data de Nascimento: ${paciente?.data_nascimento || ''}`, margemEsq, y); y += 6;
      const finalidadeLines = doc.splitTextToSize(`Finalidade: ${formLaudo.finalidade}`, 170);
      doc.text(finalidadeLines, margemEsq, y); y += (finalidadeLines.length * 6) + 10;

      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 138);
      doc.text("3. DESCRIÇÃO DA DEMANDA", margemEsq, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      const demandaLines = doc.splitTextToSize(formLaudo.demanda || 'Nenhuma demanda descrita.', 170);
      doc.text(demandaLines, margemEsq, y); y += (demandaLines.length * 6) + 10;

      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 138);
      doc.text("4. PROCEDIMENTOS", margemEsq, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      const procLines = doc.splitTextToSize(formLaudo.procedimentos, 170);
      doc.text(procLines, margemEsq, y); y += (procLines.length * 6) + 10;

      if (y > 230) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 138);
      doc.text("5. INSTRUMENTOS E RESULTADOS", margemEsq, y); y += 5;
      const tableData = testes.map(t => [t.funcao, t.nome, t.percentil, t.classificacao]);
      
      autoTable(doc, {
        startY: y, 
        head: [['Função', 'Teste', 'Percentil', 'Classificação']],
        body: tableData, 
        theme: 'grid', 
        headStyles: { fillColor: [30, 58, 138] },
        styles: { fontSize: 8 }, 
        margin: { left: margemEsq, right: 20 }
      });
      y = (doc as any).lastAutoTable.finalY + 15;

      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 138);
      doc.text("6. CONCLUSÃO DIAGNÓSTICA", margemEsq, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      const conclusaoLines = doc.splitTextToSize(formLaudo.conclusao || 'Sem conclusão.', 170);
      doc.text(conclusaoLines, margemEsq, y); y += (conclusaoLines.length * 6) + 10;

      doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 138);
      doc.text("7. ENCAMINHAMENTOS", margemEsq, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      const encLines = doc.splitTextToSize(formLaudo.encaminhamentos || 'Sem encaminhamentos.', 170);
      doc.text(encLines, margemEsq, y); y += (encLines.length * 6) + 20;

      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100);
      const resLines = doc.splitTextToSize(formLaudo.ressalva, 170);
      doc.text(resLines, margemEsq, y); y += (resLines.length * 5) + 20;

      doc.setLineWidth(0.5); doc.line(70, y, 140, y); y += 5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0,0,0);
      doc.text(meuPerfil?.nome || 'Profissional SerClin', 105, y, { align: "center" });

      const pdfBlob = doc.output('blob');
      const nomeArquivo = `Laudo_${paciente?.nome?.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const fileNamePath = `${id}/${nomeArquivo}`;
      
      const { error: upErr } = await supabase.storage.from('documentos').upload(fileNamePath, pdfBlob);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(fileNamePath);

      await supabase.from("prontuarios").insert([{
        paciente_id: id, tipo_registro: "Laudo Neuropsicológico", descricao: "Laudo gerado e assinado digitalmente.",
        profissional_nome: meuPerfil?.nome, arquivo_url: publicUrl, arquivo_nome: nomeArquivo
      }]);

      toast.success("Laudo gerado e arquivado!");
      setNovoRegistro({tipo: 'Sessão', descricao: ''}); carregarDados();
    } catch (e) { 
      console.error("Erro PDF:", e);
      toast.error("Erro ao processar laudo. Verifique o console."); 
    } finally { setGerandoPdf(false); }
  };

  const handleSalvarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAgendamento.profissional) return toast.error("Selecione o profissional.");
    setLoadingAgendamento(true);
    try {
      const dInicio = new Date(formAgendamento.inicio);
      const dFim = addMinutes(dInicio, parseInt(formAgendamento.duracao));
      const { error } = await supabase.from('agendamentos').insert([{
        sala_id: parseInt(formAgendamento.sala), profissional_nome: formAgendamento.profissional,
        paciente_nome: paciente.nome, paciente_id: id, paciente_telefone: paciente.telefone,
        data_inicio: dInicio.toISOString(), data_fim: dFim.toISOString(),
        status: formAgendamento.status === 'Presença' ? 'Presenca' : formAgendamento.status,
        valor_atendimento: parseFloat(formAgendamento.valor_atendimento), forma_pagamento: formAgendamento.forma_pagamento
      }]);
      if (error) throw error;
      await registrarLog("Novo Agendamento", `Marcou consulta com ${formAgendamento.profissional}`);
      setIsAgendamentoOpen(false); toast.success("Agendado!"); carregarDados();
    } catch (err) { toast.error("Erro ao agendar."); } finally { setLoadingAgendamento(false); }
  };

  if (loading && !paciente) return <div className="p-20 text-center font-black text-gray-400">Sincronizando SerClin...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-2 md:p-10 font-sans text-left pb-20">
      
      <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-40 shadow-sm pt-[calc(env(safe-area-inset-top,0px)+12px)] min-h-[calc(70px+env(safe-area-inset-top,0px))] -m-2 mb-4 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/sistema/pacientes")} className="p-2 -ml-2 text-gray-400"><ArrowLeft size={24} /></button>
          <div className="text-left">
            <h1 className="text-sm font-black uppercase text-gray-800 leading-none truncate max-w-[150px]">{paciente?.nome}</h1>
            <p className="text-[9px] font-bold text-blue-600 uppercase mt-1 tracking-widest">Prontuário SerClin</p>
          </div>
        </div>
        <div className="flex gap-2">
           {meuPerfil?.permissao_agendar && <Button onClick={() => setIsAgendamentoOpen(true)} size="icon" className="bg-blue-600 rounded-xl h-10 w-10 shadow-md"><CalendarIcon size={18} /></Button>}
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
        
        <div className="hidden md:flex justify-between items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/sistema/pacientes")} className="gap-2 text-gray-500 font-black uppercase text-xs cursor-pointer"><ArrowLeft size={18} /> Voltar</Button>
          <div className="flex gap-2">
            {meuPerfil?.permissao_agendar && <Button onClick={() => setIsAgendamentoOpen(true)} className="bg-[#1e3a8a] text-white font-black uppercase text-[10px] px-6 rounded-full h-10 shadow-md"><CalendarIcon size={14} className="mr-2" /> Agendar</Button>}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-4 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center border-2 border-white shadow-inner overflow-hidden shrink-0">
            {paciente?.foto_url ? <img src={paciente.foto_url} className="w-full h-full object-cover" /> : <User size={40} className="text-blue-200" />}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <h1 className="text-2xl font-black text-gray-800 uppercase">{paciente?.nome}</h1>
              <button onClick={() => setIsEditPacienteOpen(true)} className="text-gray-300 hover:text-blue-600 cursor-pointer"><Edit size={16}/></button>
            </div>
            <p className="text-sm font-bold text-gray-400 mt-1">Tel: {formatarTelefone(paciente?.telefone)} | CPF: {formatarCPF(paciente?.cpf)}</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-green-50 px-5 py-2 rounded-2xl border border-green-100 text-center">
              <p className="text-xl font-black text-green-600">{resumoPresenca.presencas}</p>
              <p className="text-[8px] font-black uppercase text-green-400">Presenças</p>
            </div>
            <div className="bg-red-50 px-5 py-2 rounded-2xl border border-red-100 text-center">
              <p className="text-xl font-black text-red-600">{resumoPresenca.faltas}</p>
              <p className="text-[8px] font-black uppercase text-red-400">Faltas</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6 text-left">
            
            <Card className="border-none shadow-sm rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-white">
              <div className="bg-blue-50 px-5 md:px-6 py-4 flex justify-between items-center border-b border-blue-100">
                <h3 className="font-black text-[#1e3a8a] uppercase text-base flex items-center gap-2"><ClipboardList size={20}/> Dados Clínicos</h3>
                <button onClick={() => setIsEditPacienteOpen(true)} className="text-blue-600 cursor-pointer"><FileEdit size={20}/></button>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="text-left">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Anamnese</label>
                  <p className="text-sm text-gray-800 mt-1 italic leading-relaxed">{paciente?.anamnese || "Vazio."}</p>
                </div>
                <div className="pt-2 border-t text-left">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Observações</label>
                  <p className="text-sm text-gray-800 mt-1 leading-relaxed">{paciente?.observacoes || "Nenhuma."}</p>
                </div>
              </CardContent>
            </Card>

            {meuPerfil?.permissao_auditoria && (
              <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
                <div className="bg-gray-50 px-6 py-3 border-b flex items-center gap-2">
                  <History size={18} className="text-gray-400"/>
                  <h3 className="font-black text-gray-500 uppercase text-sm">Auditoria</h3>
                </div>
                <CardContent className="p-4 space-y-3 max-h-[200px] overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="border-l-2 border-blue-100 pl-3 py-1">
                      <p className="text-xs font-black text-gray-700 uppercase leading-tight">{log.acao}</p>
                      <p className="text-[10px] font-bold text-gray-400">{log.profissional_nome?.split(' ')[0]} • {format(new Date(log.criado_em), "dd/MM HH:mm")}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className={`border-none shadow-xl rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-white ${modoEdicao ? 'ring-4 ring-amber-400' : ''}`}>
              <div className={`${modoEdicao ? 'bg-amber-500' : 'bg-[#1e3a8a]'} px-6 py-5 text-white flex justify-between items-center`}>
                <div className="flex items-center gap-2">
                  {novoRegistro.tipo === "Laudo Estruturado" ? <FileText size={20}/> : <Activity size={20}/>}
                  <span className="font-black uppercase text-sm tracking-widest">{modoEdicao ? 'Editando' : 'Novo Registro'}</span>
                </div>
                {modoEdicao && <X size={20} className="cursor-pointer" onClick={() => setModoEdicao(null)} />}
              </div>
              
              <CardContent className="p-6 space-y-6 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tipo de Documento</label>
                  <select 
                    className="w-full rounded-2xl border-2 border-gray-50 bg-gray-50 px-4 py-3 text-sm font-bold text-[#1e3a8a] outline-none focus:border-blue-100 focus:bg-white transition-all" 
                    value={novoRegistro.tipo} 
                    onChange={e => setNovoRegistro({...novoRegistro, tipo: e.target.value})}
                  >
                    <option value="Sessão">Sessão / Evolução Diária</option>
                    <option value="Laudo Estruturado">Laudo Neuropsicológico (PDF)</option>
                    <option value="Avaliação">Avaliação Inicial</option>
                    <option value="Anexo">Apenas Anexo PDF</option>
                  </select>
                </div>

                {novoRegistro.tipo === "Laudo Estruturado" ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Finalidade</label>
                        <Input className="h-12 text-sm bg-gray-50 border-none rounded-xl" value={formLaudo.finalidade} onChange={e => setFormLaudo({...formLaudo, finalidade: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Demanda</label>
                        <textarea className="w-full rounded-xl bg-gray-50 p-4 text-sm border-none min-h-[100px] outline-none resize-none" value={formLaudo.demanda} onChange={e => setFormLaudo({...formLaudo, demanda: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-black text-[#1e3a8a] uppercase flex gap-2 items-center"><Brain size={16}/> Bateria de Testes</label>
                        <button onClick={() => setTestes([...testes, { id: Date.now(), funcao: "", nome: "", percentil: "", classificacao: "" }])} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1.5 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-all cursor-pointer"><Plus size={14}/> Add Teste</button>
                      </div>

                      <button onClick={() => setTestes(bateriasPadrao.neuro)} className="w-full mb-4 py-2 border-2 border-dashed border-blue-100 rounded-xl text-[10px] font-black text-blue-400 uppercase hover:bg-blue-50 transition-all cursor-pointer">+ Carregar Protocolo Padrão</button>

                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {testes.map((t) => (
                          <div key={t.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative space-y-3">
                            <button onClick={() => setTestes(testes.filter(item => item.id !== t.id))} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={16}/></button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1"><span className="text-[9px] font-black text-gray-300 uppercase ml-1">Função</span><Input placeholder="Ex: Inteligência" className="h-10 text-sm bg-gray-50 border-none rounded-lg" value={t.funcao} onChange={e => setTestes(testes.map(x => x.id === t.id ? {...x, funcao: e.target.value} : x))} /></div>
                              <div className="space-y-1"><span className="text-[9px] font-black text-gray-300 uppercase ml-1">Teste</span><Input placeholder="Ex: WISC-IV" className="h-10 text-sm bg-gray-50 border-none rounded-lg" value={t.nome} onChange={e => setTestes(testes.map(x => x.id === t.id ? {...x, nome: e.target.value} : x))} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1"><span className="text-[9px] font-black text-gray-300 uppercase ml-1">Percentil</span><Input placeholder="Ex: 75" className="h-10 text-sm bg-gray-50 border-none rounded-lg" value={t.percentil} onChange={e => setTestes(testes.map(x => x.id === t.id ? {...x, percentil: e.target.value} : x))} /></div>
                              <div className="space-y-1"><span className="text-[9px] font-black text-gray-300 uppercase ml-1">Classe</span><Input placeholder="Ex: Médio" className="h-10 text-sm bg-gray-50 border-none rounded-lg" value={t.classificacao} onChange={e => setTestes(testes.map(x => x.id === t.id ? {...x, classificacao: e.target.value} : x))} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400 uppercase ml-1">Conclusão / CID</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {sugestoesCID.map(cid => <button key={cid.label} onClick={() => setFormLaudo({...formLaudo, conclusao: cid.valor})} className="text-[8px] bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-full font-black uppercase text-blue-600 transition-all cursor-pointer">{cid.label}</button>)}
                      </div>
                      <textarea className="w-full rounded-xl bg-gray-50 p-4 text-sm border-none h-28 outline-none resize-none" value={formLaudo.conclusao} onChange={e => setFormLaudo({...formLaudo, conclusao: e.target.value})} />
                    </div>

                    <Button onClick={() => setIsEditorOpen(true)} variant="outline" className="w-full border-2 border-blue-600 text-blue-600 font-black uppercase text-sm h-14 rounded-2xl flex items-center justify-center gap-3 mt-4 mb-4 hover:bg-blue-50 cursor-pointer">
                      <Layout size={20}/> Abrir Editor Word (Premium)
                    </Button>

                 <Button 
                      onClick={gerarESalvarLaudoPDF} 
                      disabled={gerandoPdf} 
                      className="w-full bg-[#1e3a8a] text-white font-black uppercase text-sm h-16 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 cursor-pointer"
                    >
                      {gerandoPdf ? <><RefreshCw className="animate-spin" size={20}/> Processando...</> : <><FileText size={24}/> Gerar Laudo Rápido (Antigo)</>}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <textarea 
                      className="w-full rounded-2xl border-none bg-gray-50 px-5 py-4 text-sm min-h-[200px] outline-none resize-none" 
                      placeholder="Descreva a evolução do paciente..." 
                      value={novoRegistro.descricao} 
                      onChange={e => setNovoRegistro({...novoRegistro, descricao: e.target.value})} 
                    />
                    
                    <div className="flex gap-3 items-center">
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()} 
                        className="flex-1 border-dashed border-2 border-gray-200 text-[10px] font-black uppercase h-14 rounded-2xl overflow-hidden cursor-pointer"
                      >
                        <Paperclip size={20} className="mr-2 shrink-0" /> 
                        <span className="truncate block max-w-full">
                          {arquivoSelecionado ? arquivoSelecionado.name : "Anexar PDF"}
                        </span>
                      </Button>
                      
                      <Button 
                        onClick={handleSalvarRegistro} 
                        className="flex-1 bg-[#1e3a8a] text-white font-black uppercase text-xs h-14 rounded-2xl shadow-lg hover:bg-black transition-all shrink-0 cursor-pointer"
                      >
                        <Save size={20} className="mr-2"/> Salvar
                      </Button>
                    </div>

                    <input 
                      type="file" 
                      hidden 
                      ref={fileInputRef} 
                      accept="application/pdf,image/*"
                      onChange={(e) => setArquivoSelecionado(e.target.files?.[0] || null)} 
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4 text-left">
            {registros.map((reg) => (
              <div key={reg.id} className="bg-white p-6 pl-8 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: getCorProfissional(reg.profissional_nome) }} />
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase px-2 py-1 bg-blue-50 text-[#1e3a8a] rounded-md">{reg.tipo_registro}</span>
                    <span className="text-[11px] font-black text-gray-800 uppercase">{reg.profissional_nome}</span>
                  </div>
                  <div className="flex gap-2">
                    {meuPerfil?.permissao_excluir && (
                      <button 
                        onClick={async () => { 
                          if(confirm("Deseja apagar este registro e remover o acesso do paciente ao documento?")) { 
                            setLoading(true);
                            try {
                              await supabase.from("prontuarios").delete().eq("id", reg.id);
                              if (reg.arquivo_url) {
                                await supabase.from("pacientes_arquivos").delete().eq("url_arquivo", reg.arquivo_url);
                              }
                              await registrarLog("Apagou Registro", reg.tipo_registro);
                              toast.success("Removido com sucesso!");
                              carregarDados();
                            } catch (err) {
                              toast.error("Erro ao excluir.");
                            } finally {
                              setLoading(false);
                            }
                          } 
                        }} 
                        className="text-gray-200 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent"
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap mt-4 leading-relaxed">{reg.descricao}</p>
                {reg.arquivo_url && (
                  <a href={reg.arquivo_url} target="_blank" className="inline-flex items-center gap-2 text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl uppercase mt-4 shadow-sm transition-colors">
                    <FileText size={16} /> Abrir Documento Anexado
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-start justify-center p-2 md:p-8 pt-10 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col mb-20 relative overflow-hidden animate-in zoom-in duration-300">
            
            <div className="bg-gray-50 p-4 border-b flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-md">
              <div className="flex items-center gap-1">
                <button onClick={() => formatDoc('bold')} className="p-2 hover:bg-white rounded-lg border bg-gray-50 cursor-pointer"><Bold size={16}/></button>
                <button onClick={() => formatDoc('italic')} className="p-2 hover:bg-white rounded-lg border bg-gray-50 cursor-pointer"><Italic size={16}/></button>
                <button onClick={() => formatDoc('underline')} className="p-2 hover:bg-white rounded-lg border bg-gray-50 cursor-pointer"><Underline size={16}/></button>
                <div className="w-px h-6 bg-gray-300 mx-2"/>
                <button onClick={() => formatDoc('justifyLeft')} className="p-2 hover:bg-white rounded-lg border bg-gray-50 cursor-pointer"><AlignLeft size={16}/></button>
                <button onClick={() => formatDoc('justifyCenter')} className="p-2 hover:bg-white rounded-lg border bg-gray-50 cursor-pointer"><AlignCenter size={16}/></button>
                <div className="w-px h-6 bg-gray-300 mx-2"/>
                <select onChange={(e) => formatDoc('fontSize', e.target.value)} className="bg-white border rounded px-2 h-8 text-xs font-bold outline-none">
                  <option value="3">Médio</option><option value="5">Grande</option><option value="7">Título</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsEditorOpen(false)} variant="ghost" className="text-gray-400 font-black uppercase text-[10px] cursor-pointer">Fechar</Button>
                <Button onClick={gerarLaudoPremiumPDF} disabled={gerandoPdf} className="bg-blue-600 text-white font-black uppercase text-xs px-8 rounded-full h-12 shadow-lg hover:bg-black transition-all cursor-pointer">
                  {gerandoPdf ? <RefreshCw className="animate-spin mr-2" size={18}/> : <CheckCircle2 className="mr-2" size={18}/>} Gerar PDF Premium
                </Button>
              </div>
            </div>

            <div className="flex-1 p-10 bg-gray-200/50 overflow-y-auto flex justify-center">
              <div 
                ref={editorRef}
                contentEditable 
                className="bg-white w-[210mm] min-h-[297mm] p-20 shadow-xl outline-none text-gray-800 font-serif leading-relaxed text-[11pt] text-left"
                style={{ fontFamily: 'Times New Roman, serif' }}
              >
                <p style={{textAlign: "center", fontSize: "16pt", fontWeight: "bold", color: "#1e3a8a"}}>INSTITUTO SERCLIN</p>
                <p style={{textAlign: "center", fontStyle: "italic", color: "#666", marginBottom: "30px"}}>Gestão em Saúde e Reabilitação Cognitiva</p>
                
                <p><b>1. IDENTIFICAÇÃO PROFISSIONAL</b></p>
                <p>Nome: {meuPerfil?.nome || 'Helenara Maria da Silva Mendes Chaves'}</p>
                <p>CRP: {meuPerfil?.conselho || formLaudo.crp_manual || '24/02216'}</p>
                <br />
                <p><b>2. IDENTIFICAÇÃO DO PACIENTE</b></p>
                <p>Nome: {paciente?.nome}</p>
                <p>Nascimento: {paciente?.data_nascimento ? format(new Date(paciente.data_nascimento), "dd/MM/yyyy") : '---'}</p>
                <p>Finalidade: {formLaudo.finalidade}</p>
                <br />
                <p><b>3. DESCRIÇÃO DA DEMANDA</b></p>
                <p>{formLaudo.demanda || 'O paciente apresenta características compatíveis com...'}</p>
                <br />
                <p><b>4. PROCEDIMENTOS E RESULTADOS</b></p>
                <p>{formLaudo.procedimentos}</p>
                {testes.map((t, i) => (
                  <p key={i}>- {t.funcao}: {t.nome} (Percentil: {t.percentil} / {t.classificacao})</p>
                ))}
                <br />
                <p><b>5. CONCLUSÃO DIAGNÓSTICA</b></p>
                <p>{formLaudo.conclusao || 'Diante dos achados, conclui-se que o quadro é...'}</p>
                <br />
                <p><b>6. ENCAMINHAMENTOS</b></p>
                <p>{formLaudo.encaminhamentos || '1. ABA;\n2. Terapia Ocupacional;\n3. Neuropediatra.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGENDAMENTO */}
      {isAgendamentoOpen && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsAgendamentoOpen(false)}>
          <div className="w-full max-w-[420px] rounded-[2.5rem] bg-white shadow-2xl overflow-hidden border-none font-sans" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1e3a8a] p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <CalendarIcon size={20} className="text-white" />
                <span className="font-black uppercase text-[12px] tracking-[0.2em] text-white">Agendar Consulta</span>
              </div>
              <button onClick={() => setIsAgendamentoOpen(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer border-none bg-transparent">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-5 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Status</label>
                  <Select value={formAgendamento.status} onValueChange={(v) => setFormAgendamento({...formAgendamento, status: v})}>
                    <SelectTrigger className="bg-gray-50 border-none font-bold h-12 uppercase text-[11px] rounded-2xl cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agendado">Agendado</SelectItem>
                      <SelectItem value="Presença">Presença</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Valor (R$)</label>
                  <Input type="number" step="0.01" value={formAgendamento.valor_atendimento} onChange={e => setFormAgendamento({...formAgendamento, valor_atendimento: e.target.value})} className="bg-gray-50 border-none h-12 font-bold rounded-2xl" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Profissional</label>
                <Select value={formAgendamento.profissional} onValueChange={(v) => setFormAgendamento({...formAgendamento, profissional: v})}>
                  <SelectTrigger className="bg-gray-50 border-none h-12 font-bold uppercase text-[11px] rounded-2xl cursor-pointer">
                    <SelectValue placeholder="SELECIONE" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipeClinica.map(p => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data e Hora</label>
                <input type="datetime-local" className="w-full h-12 bg-gray-50 rounded-2xl px-4 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-blue-100" value={formAgendamento.inicio} onChange={e => setFormAgendamento({...formAgendamento, inicio: e.target.value})} />
              </div>

              <Button onClick={(e: any) => handleSalvarAgendamento(e)} disabled={loadingAgendamento} className="w-full bg-[#1e3a8a] hover:bg-black text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl mt-4 cursor-pointer">
                {loadingAgendamento ? "Processando..." : "Confirmar Agendamento"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INFORMAÇÕES CLÍNICAS */}
      {isEditPacienteOpen && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsEditPacienteOpen(false)}>
          <div className="w-full max-w-[500px] rounded-[2.5rem] bg-white shadow-2xl overflow-hidden border-none font-sans" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1e3a8a] p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-white" />
                <span className="font-black uppercase text-[12px] tracking-widest text-white">Informações Clínicas</span>
              </div>
              <button onClick={() => setIsEditPacienteOpen(false)} className="text-white/80 hover:text-white transition-colors cursor-pointer border-none bg-transparent">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-5 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Anamnese / Histórico</label>
                <textarea value={tempDados.anamnese} onChange={e => setTempDados({...tempDados, anamnese: e.target.value})} className="w-full bg-gray-50 rounded-2xl p-5 text-sm font-medium h-44 outline-none resize-none border-none focus:ring-2 focus:ring-blue-100" placeholder="Descreva o histórico..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Observações</label>
                <textarea value={tempDados.observacoes} onChange={e => setTempDados({...tempDados, observacoes: e.target.value})} className="w-full bg-gray-50 rounded-2xl p-5 text-sm font-medium h-32 outline-none resize-none border-none focus:ring-2 focus:ring-blue-100" placeholder="Notas internas..." />
              </div>
              <Button onClick={handleSalvarDadosPaciente} disabled={loading} className="w-full bg-[#1e3a8a] hover:bg-black text-white font-black h-14 rounded-2xl uppercase text-[11px] tracking-widest mt-4 cursor-pointer">
                {loading ? "Salvando..." : "Salvar Dados Clínicos"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
