import SignatureCanvas from 'react-signature-canvas';
import { useRef, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LogOut, Layout, Calendar as CalendarIcon, Plus, X, Trash2, 
  FileText, GraduationCap,  
  CheckCircle, RefreshCw, Wallet, Receipt, Calculator, Scale, Search, 
  MessageCircle, Send, User, Filter
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';
import { usePerfil } from "@/hooks/usePerfil";

import { jsPDF } from "jspdf";
import "jspdf-autotable";
import QRCode from 'qrcode'; 

import 'react-big-calendar/lib/css/react-big-calendar.css';

// Safe base64 transparent pixel to prevent bundle/path errors for ser2.png
const logoSer2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// --- CONFIGURAÇÃO DE TRADUÇÃO ---
const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ 
  format, 
  parse, 
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }), 
  getDay, 
  locales 
});

const mensagensPortugues = {
  allDay: 'Dia Inteiro',
  previous: 'Anterior',
  next: 'Próximo',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Nenhum agendamento neste período.',
  showMore: (total: number) => `+ ver mais (${total})`
};

const mapearStatusParaBanco = (statusVisual: string) => {
  const s = statusVisual.toLowerCase();
  if (s.includes('presen') || s.includes('atendido')) return 'Presenca';
  if (s.includes('falta')) return 'Falta';
  return 'Agendado';
};

// --- VISUAL SUPER CLEAN ---
const EventoCustomizado = ({ event }: any) => {
  const isPresenca = event.original?.status === 'Presenca' || event.original?.status === 'Presença';
  const isFalta = event.original?.status === 'Falta';
  
  return (
    <div className="h-full w-full flex items-center justify-start gap-1.5 px-1 overflow-hidden text-left">
      {isPresenca && (
        <CheckCircle size={13} className="text-white shrink-0" strokeWidth={3} />
      )}
      <span className={`text-white font-bold text-[11px] uppercase leading-tight truncate text-left ${isFalta ? 'line-through opacity-75' : ''}`}>
        {event.title}
      </span>
    </div>
  );
};

interface DashboardProps {
  setView: (view: string) => void;
}

export function Dashboard({ setView }: DashboardProps) {
  const navigate = (path: string) => {
    if (path === '/') setView('home');
    else if (path === '/sistema/pacientes') setView('pacientes');
    else if (path.startsWith('/sistema/pacientes/')) {
      const pid = path.split('/').pop() || '';
      setView(`pacientes-${pid}`);
    }
    else if (path === '/sistema/planos') setView('planos');
    else if (path === '/sistema/despesas') setView('despesas');
    else if (path === '/sistema/repasses') setView('repasses');
    else if (path === '/sistema/fechamento') setView('fechamento');
    else if (path === '/sistema/relatorios') setView('relatorios');
    else if (path === '/sistema/usuarios') setView('gestao-permissoes');
    else if (path === '/sistema/encaminhamentos') setView('encaminhamentos');
    else if (path === '/login') setView('login');
    else setView('acessos');
  };

  const { isAdmin, isSecretaria } = usePerfil();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [nomeLogado, setNomeLogado] = useState<string>(""); 
  const [isGestorSeguro, setIsGestorSeguro] = useState(false);
  const [meuPerfil, setMeuPerfil] = useState<any>(null);
  
  const sigCanvas = useRef<SignatureCanvas>(null);
  
  const [view, setViewCalendar] = useState<View>(window.innerWidth < 768 ? Views.AGENDA : Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modais e UI
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false);
  const [isConfirmacaoAmanhaOpen, setIsConfirmacaoAmanhaOpen] = useState(false);
  const [isMenuMobileOpen, setIsMenuMobileOpen] = useState(false);
  
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState<number | null>(null);
  const [filtroProfissional, setFiltroProfissional] = useState<string>("geral");
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [pacientesSugeridos, setPacientesSugeridos] = useState<any[]>([]);
  
  const [form, setForm] = useState({ 
    profissional: '', paciente_nome: '', paciente_id: null as number | null,
    telefone: '', sala: '1', inicio: '', duracao: '40', status: 'Agendado',
    assinatura_url: null as string | null,
    valor_atendimento: "0,00",
    forma_pagamento: "Pix"
  });



  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: todosPerfis } = await supabase.from('perfis').select('*').order('nome');
      
      let nomeParaFiltro = "";
      let ehGestorEfetivo = false;

      if (user && todosPerfis) {
        const emailAutenticado = user.email?.toLowerCase().trim();
        setUserEmail(emailAutenticado ?? null);

        const perfilLogado = todosPerfis.find((p: any) => p.email?.toLowerCase().trim() === emailAutenticado);
        
        if (perfilLogado) {
          setMeuPerfil(perfilLogado);
          nomeParaFiltro = perfilLogado.nome || "";
          setNomeLogado(nomeParaFiltro);
          
          const roleNoBanco = (perfilLogado.role || "").toLowerCase().trim();
          
          if (
            emailAutenticado === 'romulochaves77@gmail.com' || 
            emailAutenticado === 'nahpsicologiachaves@gmail.com' ||
            roleNoBanco === 'admin' ||
            roleNoBanco === 'secretaria'
          ) {
            ehGestorEfetivo = true;
          }
        }
      }

      setIsGestorSeguro(ehGestorEfetivo);

      if (todosPerfis) {
        const filtrados = todosPerfis.filter((p: any) => {
          const n = (p.nome || "").toLowerCase();
          const r = (p.role || "").toLowerCase();
          const proibidos = ['instituto', 'recepcao', 'recepção'];
          if (n.includes('renata') && r === 'secretaria') return false;
          return !proibidos.some(termo => n.includes(termo)) && r !== 'secretaria';
        });
        setEquipe(filtrados);

        const { data: agendamentos, error } = await supabase.from('agendamentos').select('*');
        if (!error && agendamentos) {
          let permitidos = agendamentos;
          
          if (!ehGestorEfetivo && nomeParaFiltro) {
            const nomeLogadoNorm = nomeParaFiltro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            permitidos = agendamentos.filter((ag: any) => {
              const nomeAgNorm = (ag.profissional_nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
              return nomeAgNorm === nomeLogadoNorm;
            });
          }

          const eventosFormatados = permitidos.map((evt: any) => {
            const perfil = todosPerfis.find((p: any) => p.nome?.trim().toLowerCase() === evt.profissional_nome?.trim().toLowerCase());
            
            const dataInicio = new Date(evt.data_inicio);
            let dataFim = evt.data_fim ? new Date(evt.data_fim) : addMinutes(dataInicio, parseInt(evt.duracao || '40'));
            if (isNaN(dataFim.getTime())) { dataFim = addMinutes(dataInicio, 40); }

            return {
              id: evt.id,
              title: `${evt.paciente_nome} (S${evt.sala_id})`,
              start: dataInicio,
              end: dataFim,
              color: perfil?.cor || '#0a2d54',
              original: evt
            };
          });
          setEvents(eventosFormatados);
        }
      }
    } catch (err) { toast.error("Erro ao carregar dados."); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const pesquisar = async () => {
      if (buscaPaciente.length < 2) { setPacientesSugeridos([]); return; }
      const { data } = await supabase.from('pacientes').select('id, nome, telefone').ilike('nome', `%${buscaPaciente}%`).limit(5);
      setPacientesSugeridos(data || []);
    };
    pesquisar();
  }, [buscaPaciente]);

  const aplicarMascaraTelefone = (value: string) => {
    if (!value) return "";
    const apenasNumeros = value.replace(/\D/g, "");
    return apenasNumeros.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3").slice(0, 16);
  };

  const aplicarMascaraMoeda = (value: string) => {
    const apenasNumeros = value.replace(/\D/g, "");
    const valorFloat = parseFloat(apenasNumeros) / 100;
    if (isNaN(valorFloat)) return "0,00";
    return valorFloat.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const enviarWhatsApp = (nome: string, fone: string, prof: string, inicio: string) => {
    if (!fone) return toast.error("Paciente sem telefone.");
    const foneLimpo = fone.replace(/\D/g, '');
    const dataFormatada = format(new Date(inicio), "dd/MM/yyyy");
    const horaFormatada = format(new Date(inicio), "HH:mm");
    const mensagem = `Olá, ${nome}! Confirmamos sua consulta no *Instituto SerClin* com o(a) profissional ${prof} no dia *${dataFormatada}* às *${horaFormatada}*. Podemos confirmar sua presença?`;
    window.open(`https://wa.me/55${foneLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const gerarComprovante = async () => {
    setLoading(true);
    try {
      const { data: val, error } = await supabase
        .from('validacoes')
        .insert([{ paciente_nome: form.paciente_nome, profissional_nome: form.profissional }])
        .select('id')
        .single();
        
      if (error) {
        toast.error(`Erro no Banco: A tabela 'validacoes' existe? Detalhe: ${error.message}`);
        setLoading(false);
        return;
      }

      const urlValidacao = `https://institutoserclin.vercel.app/validar/${val.id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(urlValidacao);
      const doc = new jsPDF();
      
      doc.addImage(logoSer2, 'PNG', 75, 10, 60, 40);
      
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(10, 45, 84);
      doc.text("ATESTADO DE COMPARECIMENTO", 105, 60, { align: "center" });
      
      const textoCorpo = `Declaramos para os devidos fins de comprovação que o(a) paciente ${form.paciente_nome.toUpperCase()} esteve presente no INSTITUTO SERCLIN para atendimento especializado no dia ${format(new Date(form.inicio), "dd/MM/yyyy")}. O atendimento teve início às ${format(new Date(form.inicio), "HH:mm")} sob a responsabilidade do(a) profissional ${form.profissional.toUpperCase()}.`;
      
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      doc.text(textoCorpo, 20, 85, { maxWidth: 170, align: "justify", lineHeightFactor: 1.5 });
      
      if (form.assinatura_url) {
        doc.addImage(form.assinatura_url, 'PNG', 20, 140, 50, 20);
      }
      
      doc.addImage(qrCodeDataUrl, 'PNG', 87, 195, 30, 30);
      doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100);
      doc.text("Escaneie o QR Code acima ou acesse o link abaixo para validar a autenticidade:", 105, 230, { align: "center" });
      
      doc.setFont("helvetica", "bold"); doc.setTextColor(191, 165, 113);
      doc.text(urlValidacao, 105, 235, { align: "center" });
      doc.link(20, 231, 170, 6, { url: urlValidacao }); 
      
      doc.save(`Atestado_${form.paciente_nome.replace(/\s+/g, '_')}.pdf`);
      toast.success("Atestado Gerado com Sucesso!");
      
    } catch (err: any) { 
      toast.error(`Erro PDF: ${err.message || "Falha na construção do arquivo"}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleExcluirAgendamento = async () => {
    if (!eventoSelecionadoId || !confirm("⚠️ Deseja realmente apagar este agendamento?")) return;
    setLoading(true);
    try {
      await supabase.from('agendamentos').delete().eq('id', eventoSelecionadoId);
      toast.success("Removido!");
      setIsAgendamentoOpen(false); fetchData();
    } catch (err) { toast.error("Erro."); } finally { setLoading(false); }
  };

  const handleSalvarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações de segurança
    if (!form.profissional || !form.inicio) return toast.error("Preencha o profissional e o horário.");
    if (!buscaPaciente && !form.paciente_id) return toast.error("Informe o nome do paciente.");
    
    setLoading(true);
    try {
      const dInicio = new Date(form.inicio);
      const dFim = addMinutes(dInicio, parseInt(form.duracao));
      
      let idDoPaciente = form.paciente_id;

      // 1. Lógica de Auto-cadastro de Paciente (Neuropsicologia costuma ter muitos novos)
      if (!idDoPaciente) {
        const { data: novoPac, error: pacErr } = await supabase
          .from("pacientes")
          .insert([{ 
            nome: buscaPaciente.toUpperCase(), 
            telefone: form.telefone, 
            convenio: "Particular" 
          }])
          .select('id')
          .single();
        
        if (pacErr) throw new Error("Erro ao cadastrar novo paciente.");
        if (novoPac) idDoPaciente = novoPac.id;
      }

      // 2. Processamento da Assinatura (Digitalização SerClin)
      let assinaturaBase64 = form.assinatura_url;
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        assinaturaBase64 = sigCanvas.current.getCanvas().toDataURL('image/png');
      }

      // 3. Sanitização Financeira (Trata 1.200,50 ou 1200.50)
      const valorLimpo = parseFloat(
        form.valor_atendimento
          .toString()
          .replace(/\./g, "")
          .replace(",", ".")
      ) || 0;

      const payload = {
        sala_id: parseInt(form.sala),
        profissional_nome: form.profissional,
        paciente_nome: buscaPaciente.toUpperCase(),
        paciente_id: idDoPaciente,
        paciente_telefone: form.telefone,
        data_inicio: dInicio.toISOString(),
        data_fim: dFim.toISOString(),
        status: mapearStatusParaBanco(form.status),
        assinatura_url: assinaturaBase64,
        valor_atendimento: valorLimpo,
        forma_pagamento: form.forma_pagamento
      };

      // 4. Update ou Insert
      const { error } = eventoSelecionadoId 
        ? await supabase.from('agendamentos').update(payload).eq('id', eventoSelecionadoId) 
        : await supabase.from('agendamentos').insert([payload]);

      if (error) throw error;

      // 5. Feedback e Refresh
      setIsAgendamentoOpen(false);
      setEventoSelecionadoId(null);
      fetchData(); // Certifique-se que sua função de carregar se chama fetchData
      toast.success(eventoSelecionadoId ? "Agendamento atualizado!" : "Paciente agendado com sucesso!");

    } catch (err: any) {
      console.error("Erro SerClin Save:", err);
      toast.error(err.message || "Erro ao salvar na agenda.");
    } finally {
      setLoading(false);
    }
  };

  // Filtro de Agendamentos de Amanhã (Para o botão do Header)
  const agendamentosAmanha = events
    .filter((e: any) => isSameDay(new Date(e.start), addDays(new Date(), 1)))
    .map((e: any) => e.original || e) // Garante compatibilidade com o formato do BigCalendar
    .sort((a: any, b: any) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

  // Limites do Calendário (7h às 20h)
  const minTime = new Date(2024, 0, 1, 7, 0, 0); 
  const maxTime = new Date(2024, 0, 1, 20, 0, 0);

  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex flex-col font-sans overflow-hidden text-left" id="dashboard-system-root">
      <style>{`
        /* Visual Geral da Agenda - Altura Otimizada */
        .rbc-calendar {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }

        /* Redução drástica do espaçamento vertical excessivo (Grid ultra-eficiente) */
        .rbc-timeslot-group {
          min-height: 40px !important; /* Em vez do padrão de 80px */
          border-bottom: 1px solid #f3f4f6 !important;
        }
        .rbc-time-slot {
          min-height: 20px !important;
          font-size: 10px !important;
          padding: 1px 0 !important;
        }
        .rbc-time-gutter .rbc-timeslot-group {
          border-bottom: none !important;
        }

        /* Estilo da barra de rolagem interna */
        .rbc-time-content {
          flex: 1 1 0% !important;
          overflow-y: auto !important;
          min-height: 0 !important;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .rbc-time-content::-webkit-scrollbar {
          width: 6px;
        }
        .rbc-time-content::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .rbc-time-content::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 3px;
        }

        /* Garantir Cabeçalho Fixo (Sticky Header) */
        .rbc-time-view {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0% !important;
          min-height: 0 !important;
          border-radius: 1.5rem;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          background-color: #ffffff;
        }
        .rbc-time-header {
          flex: 0 0 auto !important;
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          background-color: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }

        /* Estilo Compacto de Eventos */
        .rbc-event {
          padding: 1px 3px !important;
          min-height: 16px !important;
          transition: transform 0.1s ease-in-out;
        }
        .rbc-event:hover {
          transform: scale(0.99);
        }
        .rbc-event-content {
          font-size: 11px !important;
          font-weight: 800 !important;
          line-height: 1.15 !important;
          text-transform: uppercase;
        }

        /* Estilo de Agenda de Compromissos (Mobile) */
        .rbc-agenda-view {
          background-color: #ffffff;
          border-radius: 1.5rem;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          height: 100% !important;
          display: flex;
          flex-direction: column;
        }
        .rbc-agenda-view .rbc-agenda-content {
          overflow-y: auto !important;
          flex: 1 1 0% !important;
          min-height: 0 !important;
        }
        .rbc-agenda-view table.rbc-agenda-table {
          width: 100%;
          border-collapse: collapse;
        }
        .rbc-agenda-view table.rbc-agenda-table thead {
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          background-color: #f8fafc !important;
          border-bottom: 2px solid #e2e8f0;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          color: #1f2937 !important;
          font-weight: 800 !important;
          font-size: 13px !important;
          padding: 12px 16px !important;
        }
        .rbc-agenda-date-cell, .rbc-agenda-time-cell {
          color: #0a2d54 !important;
          font-weight: 800 !important;
        }

        /* Customização Geral da UI */
        .rbc-toolbar button {
          color: #0a2d54 !important;
          font-weight: bold;
          font-size: 13px !important;
          border-radius: 0.5rem !important;
          border: 1px solid #e5e7eb !important;
          margin: 0 2px !important;
        }
        .rbc-toolbar button.rbc-active {
          background-color: #0a2d54 !important;
          color: white !important;
          border-color: #0a2d54 !important;
        }
        .rbc-label {
          color: #64748b !important;
          font-weight: 800 !important;
          font-size: 10px !important;
        }

        @media (max-width: 768px) {
          .rbc-toolbar {
            flex-direction: column;
            gap: 8px;
            height: auto !important;
            padding: 10px !important;
          }
          .fixed.inset-0 .bg-white.rounded-\[2\.5rem\] {
            max-width: 100% !important;
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding-top: env(safe-area-inset-top, 20px) !important;
          }
          .sigCanvas {
            width: 100% !important;
            height: 120px !important;
          }
        }
      `}</style>

     {/* HEADER INTEGRAL SERCLIN - AJUSTADO PARA MOBILE LIMPO */}
      <header className="bg-white border-b px-4 md:px-8 shadow-sm z-50 sticky top-0 w-full">
        <div className="flex justify-between items-center h-[72px] max-w-[1800px] mx-auto">
          
          {/* ESQUERDA: LOGO AMPLIADO (PC E MOBILE) */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#0a2d54] flex items-center justify-center text-white font-black text-xl shadow-lg border border-[#bfa571]/20">SC</div>
            <div className="hidden sm:flex flex-col text-left">
              <h1 className="text-sm md:text-xl font-black text-[#0a2d54] uppercase leading-none tracking-tighter">
                SerClin
              </h1>
              <p className="text-[7px] md:text-[11px] text-gray-500 font-bold uppercase mt-1 tracking-[0.2em]">
                Gestão Integrada
              </p>
            </div>
          </div>

          {/* CENTRO: GRADE COMPLETA DE BOTÕES (SÓ NO PC) */}
          <div className="hidden md:flex items-center gap-5 flex-1 justify-center px-4 overflow-x-auto no-scrollbar">
            
            {/* 1. PACIENTES */}
            <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/pacientes')}>
              <Button variant="ghost" size="icon" className="text-blue-700 hover:bg-blue-50 h-10 w-10">
                <User size={24}/>
              </Button>
              <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-blue-700">Pacientes</span>
            </div>

            {meuPerfil?.permissao_financeiro && (
              <>
                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/planos')}>
                  <Button variant="ghost" size="icon" className="text-emerald-600 hover:bg-emerald-50 h-10 w-10">
                    <Wallet size={24}/>
                  </Button>
                  <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-emerald-600">Planos</span>
                </div>

                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/despesas')}>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 h-10 w-10">
                    <Receipt size={24}/>
                  </Button>
                  <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-red-500">Despesas</span>
                </div>

                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/repasses')}>
                  <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50 h-10 w-10">
                    <Calculator size={24}/>
                  </Button>
                  <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-blue-600">Repasses</span>
                </div>

                <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/fechamento')}>
                  <Button variant="ghost" size="icon" className="text-indigo-600 hover:bg-indigo-50 h-10 w-10">
                    <Scale size={24}/>
                  </Button>
                  <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-indigo-600">Caixa</span>
                </div>
              </>
            )}

            <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/relatorios')}>
              <Button variant="ghost" size="icon" className="text-amber-600 hover:bg-amber-50 h-10 w-10">
                <Search size={24}/>
              </Button>
              <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-amber-600">Relatórios</span>
            </div>

            {(isAdmin || isGestorSeguro) && (
              <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => navigate('/sistema/usuarios')}>
                <Button variant="ghost" size="icon" className="text-purple-600 hover:bg-purple-50 h-10 w-10">
                  <User size={24}/>
                </Button>
                <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-purple-600">Acessos</span>
              </div>
            )}
          </div>

          {/* DIREITA: STATUS, AGENDAR (PC) E MENU (MOBILE) */}
          <div className="flex items-center gap-4 shrink-0">
            
            {/* Online Status: Só PC */}
            <div className="hidden md:flex flex-col items-end mr-1">
              <span className="text-[12px] font-black text-gray-800 uppercase leading-none">{nomeLogado?.split(' ')[0]}</span>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="text-[9px] text-green-600 font-bold uppercase">Online</span>
              </div>
            </div>

            {/* Botão Agendar: Só PC */}
            <Button 
              onClick={() => { setEventoSelecionadoId(null); setIsAgendamentoOpen(true); }}
              className="hidden md:flex bg-[#0a2d54] hover:bg-[#bfa571] text-white rounded-xl h-11 px-6 shadow-lg items-center gap-2 transition-all active:scale-95 border-none cursor-pointer"
            >
              <Plus size={20} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase">AGENDAR</span>
            </Button>

            {/* BOTÃO CONFIRMAR AMANHÃ (LÓGICA DE FIM DE SEMANA) */}
            {meuPerfil?.permissao_confirmacao_amanha && (
              <div 
                className="flex flex-col items-center gap-1 cursor-pointer group relative" 
                onClick={() => setIsConfirmacaoAmanhaOpen(true)}
              >
                <Button variant="ghost" size="icon" className="text-emerald-700 hover:bg-emerald-50 h-10 w-10">
                  <Send size={24}/>
                  {agendamentosAmanha.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {agendamentosAmanha.length}
                    </span>
                  )}
                </Button>
                <span className="text-[9px] font-black uppercase text-gray-400 group-hover:text-emerald-700">
                  {new Date().getDay() === 5 ? 'Confirmar Segunda' : 'Confirmar Amanhã'}
                </span>
              </div>
            )}

            {/* MENU HAMBÚRGUER: AGORA NA DIREITA E SÓ NO MOBILE */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMenuMobileOpen(true)} 
              className="md:hidden text-[#0a2d54] h-12 w-12 cursor-pointer"
            >
              <Layout size={32} />
            </Button>
          </div>
        </div>

        {/* GAVETA MOBILE (DRAWER) - ABRINDO DA DIREITA PARA A ESQUERDA */}
        {isMenuMobileOpen && (
          <div className="md:hidden fixed inset-0 z-[100] bg-black/60 flex justify-end backdrop-blur-sm" onClick={() => setIsMenuMobileOpen(false)}>
            <div className="w-[85%] max-w-[310px] bg-white h-full shadow-2xl flex flex-col pt-16 animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center px-6 pb-6 border-b">
                <span className="font-black text-[#0a2d54] uppercase text-lg">Menu SerClin</span>
                <X size={26} onClick={() => setIsMenuMobileOpen(false)} className="text-gray-400 cursor-pointer" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1 flex flex-col">
                <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/pacientes'); setIsMenuMobileOpen(false); }}>
                  <User size={20} className="text-blue-700"/> Prontuários
                </Button>
                
                {meuPerfil?.permissao_financeiro && (
                  <>
                    <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/planos'); setIsMenuMobileOpen(false); }}>
                      <Wallet size={20} className="text-emerald-600"/> Planos
                    </Button>
                    <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/despesas'); setIsMenuMobileOpen(false); }}>
                      <Receipt size={20} className="text-red-600"/> Despesas
                    </Button>
                    <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/repasses'); setIsMenuMobileOpen(false); }}>
                      <Calculator size={20} className="text-blue-600"/> Repasses
                    </Button>
                    <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/fechamento'); setIsMenuMobileOpen(false); }}>
                      <Scale size={20} className="text-indigo-600"/> Caixa
                    </Button>
                  </>
                )}

                <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/relatorios'); setIsMenuMobileOpen(false); }}>
                  <Search size={20} className="text-amber-600"/> Relatórios
                </Button>

                {/* BOTÃO CONFIRMAR NA GAVETA */}
                {meuPerfil?.permissao_confirmacao_amanha && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-4 text-emerald-700 h-12 rounded-xl font-bold uppercase text-[11px] bg-emerald-50/50" 
                    onClick={() => { setIsMenuMobileOpen(false); setIsConfirmacaoAmanhaOpen(true); }}
                  >
                    <Send size={18} /> 
                    {new Date().getDay() === 5 ? 'Confirmar Segunda' : 'Confirmar Amanhã'}
                    {agendamentosAmanha.length > 0 && (
                      <span className="ml-auto bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">
                        {agendamentosAmanha.length}
                      </span>
                    )}
                  </Button>
                )}  

                {(isAdmin || isGestorSeguro) && (
                  <Button variant="ghost" className="justify-start gap-4 h-12 font-bold uppercase text-[11px]" onClick={() => { navigate('/sistema/usuarios'); setIsMenuMobileOpen(false); }}>
                    <User size={20} className="text-purple-600"/> Gerenciar Acesso
                  </Button>
                )}
                
                <div className="mt-auto border-t pt-4">
                  <Button variant="ghost" className="w-full justify-start gap-4 h-12 font-bold uppercase text-[11px] text-red-500" onClick={() => { supabase.auth.signOut(); navigate('/login'); }}>
                    <LogOut size={20} /> Sair do Sistema
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ÁREA PRINCIPAL DO DASHBOARD */}
      <main className="flex-1 p-2 md:p-4 overflow-hidden text-left flex flex-col relative mt-2">
        {isGestorSeguro && (
          <div className="mb-3 flex justify-end z-10 shrink-0">
            <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
              <SelectTrigger className="bg-white border border-gray-100 text-[#0a2d54] font-black h-11 text-xs rounded-2xl px-4 shadow-sm w-full md:w-[250px] cursor-pointer">
                <div className="flex items-center gap-2 uppercase tracking-widest">
                  <Filter size={16} className="text-emerald-500" />
                  <SelectValue placeholder="Filtrar Agenda" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Visão Geral (Todos)</SelectItem>
                {equipe.map((p: any) => (
                  <SelectItem key={p.id} value={p.nome}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

         <Card className="flex-1 min-h-0 border-none shadow-sm bg-white rounded-[2rem] overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
            <Calendar 
              style={{ height: '100%', width: '100%' }}
              localizer={localizer} culture='pt-BR' messages={mensagensPortugues}
              events={filtroProfissional === "geral" ? events : events.filter((e: any) => e.original?.profissional_nome === filtroProfissional)} 
              view={view} onView={setViewCalendar} date={date} onNavigate={setDate} 
              views={['day', 'week', 'month', 'agenda']} 
              min={minTime} 
              max={maxTime} 
              components={{ event: EventoCustomizado }} 
              eventPropGetter={(event: any) => ({ style: { backgroundColor: event.color, color: 'white', border: 'none', borderRadius: '6px', opacity: event.original?.status === 'Falta' ? 0.5 : 1 } })}
              onSelectEvent={(e) => { 
                const evt = e.original; 
                setEventoSelecionadoId(evt.id); 
                setBuscaPaciente(evt.paciente_nome); 
                setForm({ ...form, profissional: evt.profissional_nome, paciente_nome: evt.paciente_nome, paciente_id: evt.paciente_id, telefone: aplicarMascaraTelefone(evt.paciente_telefone || ''), sala: evt.sala_id?.toString() || '1', inicio: format(new Date(evt.data_inicio), "yyyy-MM-dd'T'HH:mm"), status: evt.status === 'Presenca' ? 'Presença' : (evt.status || 'Agendado'), duracao: evt.duracao || '40', assinatura_url: evt.assinatura_url || null, valor_atendimento: aplicarMascaraMoeda(evt.valor_atendimento?.toString() || "0"), forma_pagamento: evt.forma_pagamento || "Pix" }); 
                setIsAgendamentoOpen(true); 
              }} 
            />
          </CardContent>
        </Card>

        {meuPerfil?.permissao_agendar && (
          <button 
            onClick={() => { 
              setEventoSelecionadoId(null); 
              setBuscaPaciente(""); 
              setForm({ ...form, profissional: isGestorSeguro ? '' : nomeLogado, paciente_id: null, status: 'Agendado', duracao: '40', assinatura_url: null, inicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"), telefone: "", valor_atendimento: "0,00", forma_pagamento: "Pix" }); 
              setIsAgendamentoOpen(true); 
            }} 
            className="md:hidden fixed bottom-6 right-6 z-[45] bg-blue-600 hover:bg-blue-700 text-white rounded-full h-14 px-6 flex items-center justify-center shadow-[0_8px_30px_rgb(37,99,235,0.4)] active:scale-95 transition-transform cursor-pointer border-none"
          >
            <Plus size={20} className="mr-1.5" />
            <span className="font-black text-[13px] uppercase tracking-widest">Agendar</span>
          </button>
        )}
      </main>

      {/* MODAL DE CONFIRMAÇÃO DE AMANHÃ */}
      {isConfirmacaoAmanhaOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[650px] border border-gray-100 overflow-hidden">
            <div className="p-8 border-b flex justify-between items-center bg-white text-left">
              <div>
                <h3 className="font-black uppercase text-xl tracking-tighter text-[#0a2d54]">Lista de Confirmação</h3>
                <p className="text-[12px] font-bold text-emerald-600 uppercase flex items-center gap-2 mt-1">
                  <CalendarIcon size={14}/> {format(addDays(new Date(), 1), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <button onClick={() => setIsConfirmacaoAmanhaOpen(false)} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-red-500 transition-colors cursor-pointer border-none">
                <X size={24}/>
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-50/50 space-y-3 text-left">
              {agendamentosAmanha.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl p-6">
                  <p className="text-gray-400 font-bold uppercase text-xs">Nenhum agendamento para amanhã.</p>
                </div>
              ) : (
                agendamentosAmanha.map((ag: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm group">
                    <div className="flex items-center gap-5 text-left">
                      <div className="h-14 w-20 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
                        <span className="font-black text-[#0a2d54]">{format(new Date(ag.data_inicio), "HH:mm")}</span>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-black text-[15px] uppercase text-gray-800 leading-tight">{ag.paciente_nome}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Prof: {ag.profissional_nome}</span>
                          <span className="text-[10px] font-bold text-blue-500 uppercase">Sala {ag.sala_id}</span>
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => enviarWhatsApp(ag.paciente_nome, ag.paciente_telefone, ag.profissional_nome, ag.data_inicio)} className="bg-emerald-500 text-white rounded-2xl h-14 px-6 flex items-center gap-3 shadow-lg transition-all border-none cursor-pointer">
                      <MessageCircle size={20} />
                      <span className="font-black uppercase text-[11px] hidden sm:block">Confirmar</span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AGENDAMENTO COMPLETO */}
      {isAgendamentoOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-0 md:p-2 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setIsAgendamentoOpen(false)}>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[440px] h-full md:h-auto md:max-h-[95vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="p-5 border-b flex justify-between items-center bg-white text-left shrink-0">
              <h3 className="font-black uppercase text-[15px] tracking-widest text-[#0a2d54]">{eventoSelecionadoId ? 'Editar' : 'Novo'} Agendamento</h3>
              <button type="button" onClick={() => setIsAgendamentoOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer border-none bg-transparent">
                <X size={24}/>
              </button>
            </div>
            
            <form onSubmit={handleSalvarAgendamento} className="p-6 space-y-4 text-left overflow-y-auto flex-1 custom-scrollbar">
              
              {eventoSelecionadoId && (
                <Button type="button" onClick={() => navigate(`/sistema/pacientes/${form.paciente_id}`)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black h-12 rounded-xl flex items-center justify-center gap-2 uppercase text-[10px] shadow-md mb-2 transition-all border-none cursor-pointer">
                  <FileText size={18} /> Acessar Prontuário do Paciente
                </Button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-500 uppercase">Status</label>
                  <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                    <SelectTrigger className="bg-blue-50 border-none font-bold text-blue-700 h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agendado">Agendado</SelectItem>
                      <SelectItem value="Presença">Presença</SelectItem>
                      <SelectItem value="Falta">Falta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase text-left">Pagamento</label>
                  <Select value={form.forma_pagamento} onValueChange={(v) => setForm({...form, forma_pagamento: v})}>
                    <SelectTrigger className="bg-emerald-50 border-none font-bold text-emerald-700 h-10 text-left"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase text-left">Valor (R$)</label>
                  <Input type="text" value={form.valor_atendimento} onChange={e => setForm({...form, valor_atendimento: aplicarMascaraMoeda(e.target.value)})} className="bg-gray-50 border-none h-11 font-bold text-sm text-gray-700" />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase text-left">Duração</label>
                  <Select value={form.duracao} onValueChange={(v) => setForm({...form, duracao: v})}>
                    <SelectTrigger className="bg-gray-50 border-none h-11 text-sm font-bold text-gray-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Min</SelectItem>
                      <SelectItem value="40">40 Min</SelectItem>
                      <SelectItem value="50">50 Min</SelectItem>
                      <SelectItem value="60">60 Min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-black text-gray-400 uppercase text-left">Paciente</label>
                <div className="relative">
                  <Input placeholder="Buscar..." className="bg-gray-50 border-none h-11 text-sm font-bold uppercase text-gray-700" value={buscaPaciente} onChange={(e) => setBuscaPaciente(e.target.value)} required />
                  {pacientesSugeridos.length > 0 && (
                    <div className="absolute z-[110] w-full bg-white border shadow-xl rounded-xl mt-1 overflow-hidden">
                      {pacientesSugeridos.map((p: any) => (
                        <button key={p.id} type="button" className="w-full text-left p-3 hover:bg-blue-50 border-b flex flex-col cursor-pointer border-none" onClick={() => { setForm({ ...form, paciente_nome: p.nome, paciente_id: p.id, telefone: aplicarMascaraTelefone(p.telefone || '') }); setBuscaPaciente(p.nome); setPacientesSugeridos([]); }}>
                          <span className="font-bold text-sm uppercase text-gray-700">{p.nome}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase text-left">Sala</label>
                  <Select value={form.sala} onValueChange={(v) => setForm({...form, sala: v})}>
                    <SelectTrigger className="bg-gray-50 border-none h-11 text-sm font-bold text-gray-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Sala 01</SelectItem>
                      <SelectItem value="2">Sala 02</SelectItem>
                      <SelectItem value="3">Sala 03</SelectItem>
                      <SelectItem value="4">Sala 04</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase text-left">WhatsApp</label>
                  <Input value={form.telefone} onChange={e => setForm({...form, telefone: aplicarMascaraTelefone(e.target.value)})} className="bg-gray-50 border-none h-11 text-gray-700 font-bold" placeholder="(00) 9 0000-0000" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-black text-gray-400 uppercase text-left">Profissional Clínico</label>
                <Select value={form.profissional} onValueChange={(v) => setForm({...form, profissional: v})} disabled={!isGestorSeguro}>
                  <SelectTrigger className="bg-gray-50 border-none h-11 font-bold text-sm text-gray-700"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {isGestorSeguro ? equipe.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>) : <SelectItem value={nomeLogado}>{nomeLogado}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-black text-gray-400 uppercase text-left">Horário/Data</label>
                <input type="datetime-local" required className="w-full bg-gray-50 rounded-md p-2.5 text-xs font-bold h-11 border-none outline-none text-gray-700" value={form.inicio} onChange={e => setForm({...form, inicio: e.target.value})} />
              </div>

              <div className="space-y-1 pt-1 text-left">
                <label className="text-[12px] font-black text-gray-400 uppercase flex justify-between">Assinatura Digital {form.assinatura_url && <span className="text-emerald-500 font-black">OK</span>}</label>
                <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden bg-white min-h-[80px] flex items-center justify-center relative">
                  {form.assinatura_url ? (
                    <div className="group relative w-full h-full flex flex-col items-center justify-center bg-gray-50 p-2">
                      <img src={form.assinatura_url} alt="Assinatura" className="max-h-[60px] object-contain" />
                      <button type="button" onClick={() => setForm({ ...form, assinatura_url: null })} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 font-bold text-[9px] uppercase cursor-pointer border-none">Refazer</button>
                    </div>
                  ) : (
                    <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{width: 400, height: 80, className: 'sigCanvas w-full h-full'}} />
                  )}
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2 shrink-0 pb-8">
                {form.telefone && (
                  <Button type="button" onClick={() => enviarWhatsApp(form.paciente_nome, form.telefone, form.profissional, form.inicio)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black h-11 rounded-xl flex items-center justify-center gap-2 uppercase text-[10px] shadow-md transition-all border-none cursor-pointer">
                    <MessageCircle size={16} /> Confirmar WhatsApp
                  </Button>
                )}
                {eventoSelecionadoId && (
                  <Button type="button" onClick={gerarComprovante} className="w-full bg-[#0a2d54] hover:bg-[#bfa571] text-white font-black h-11 rounded-xl flex items-center justify-center gap-2 uppercase text-[10px] shadow-md transition-all border-none cursor-pointer">
                    <FileText size={16} /> Gerar Atestado
                  </Button>
                )}
                <div className="flex gap-2">
                  {eventoSelecionadoId && (
                    <Button type="button" variant="outline" onClick={handleExcluirAgendamento} className="px-5 border-red-200 text-red-500 hover:bg-red-50 h-12 rounded-2xl transition-all cursor-pointer">
                      <Trash2 size={20} />
                    </Button>
                  )}
                  {meuPerfil?.permissao_agendar && (
                    <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-black text-white font-black h-12 rounded-2xl shadow-xl uppercase text-xs transition-all border-none cursor-pointer">
                      {loading ? <RefreshCw className="animate-spin" /> : 'Confirmar Agenda'}
                    </Button>
                  )}
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
