import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Booking, { ScheduledAppointment } from "./components/Booking";
import { Checkin } from "./components/Checkin";
import { Acessos } from "./components/Acessos";
import { CadastroUsuario } from "./components/CadastroUsuario";
import AIChat from "./components/AIChat";
import Footer from "./components/Footer";

// Clinical Management Systems
import { Dashboard } from "./components/Dashboard";
import { Despesas } from "./components/Despesas";
import { Fechamento } from "./components/Fechamento";
import { GestaoPermissoes } from "./components/GestaoPermissoes";
import { Horarios } from "./components/Horarios";
import { Pacientes } from "./components/Pacientes";
import { Login } from "./components/Login";

export default function App() {
  const [view, setView] = useState<string>("home");
  const [preselectedDoctorId, setPreselectedDoctorId] = useState<string | null>(null);
  const [symptomPreload, setSymptomPreload] = useState<string>("");
  const [appointments, setAppointments] = useState<ScheduledAppointment[]>([]);

  // Load appointments from localStorage on startup
  useEffect(() => {
    try {
      const stored = localStorage.getItem("serclin_appointments");
      if (stored) {
        setAppointments(JSON.parse(stored));
      } else {
        // Seed initial mock historic appointment so the dashboard isn't completely generic
        const initialMock: ScheduledAppointment[] = [
          {
            id: "past-1",
            doctorName: "Dra. Laura Mendes",
            doctorId: "dra-laura-mendes",
            doctorRole: "Psicóloga de Jovens e Adultos",
            doctorImage: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=600",
            specialtyName: "Psicologia",
            dateStr: "Segunda-feira, 11 de Maio de 2026",
            timeSlot: "14:30",
            patientName: "Paciente Demonstrativo",
            patientPhone: "(11) 98888-7777",
            patientEmail: "paciente@exemplo.com",
            paymentType: "Bradesco Saúde",
            status: "completed",
            code: "SRC-9081"
          }
        ];
        setAppointments(initialMock);
        localStorage.setItem("serclin_appointments", JSON.stringify(initialMock));
      }
    } catch (e) {
      console.error("Local storage failed to load", e);
    }
  }, []);

  const handleAppointmentCreated = (newApp: ScheduledAppointment) => {
    const updated = [newApp, ...appointments];
    setAppointments(updated);
    localStorage.setItem("serclin_appointments", JSON.stringify(updated));
  };

  const handleCancelAppointment = (id: string) => {
    const updated = appointments.map((app) => {
      if (app.id === id) {
        return { ...app, status: "canceled" as const };
      }
      return app;
    });
    setAppointments(updated);
    localStorage.setItem("serclin_appointments", JSON.stringify(updated));
  };

  const renderActiveView = () => {
    switch (view) {
      case "home":
        return (
          <Home 
            setView={setView} 
            setPreselectedDoctorId={setPreselectedDoctorId} 
          />
        );
      case "booking":
        return (
          <Booking
            preselectedDoctorId={preselectedDoctorId}
            setPreselectedDoctorId={setPreselectedDoctorId}
            onAppointmentCreated={handleAppointmentCreated}
            setView={setView}
          />
        );
      case "checkin":
        return (
          <Checkin />
        );
      case "acessos":
        return (
          <Dashboard setView={setView} />
        );
      case "despesas":
        return (
          <Despesas setView={setView} />
        );
      case "fechamento":
        return (
          <Fechamento setView={setView} />
        );
      case "gestao-permissoes":
        return (
          <GestaoPermissoes setView={setView} />
        );
      case "horarios":
        return (
          <Horarios setView={setView} />
        );
      case "pacientes":
        return (
          <Pacientes setView={setView} />
        );
      case "cadastro-usuario":
        return (
          <CadastroUsuario setView={setView} />
        );
      case "login":
        return (
          <Login setView={setView} />
        );
      case "planos":
      case "repasses":
      case "relatorios":
      case "encaminhamentos":
        return (
          <div className="p-10 max-w-lg mx-auto text-center mt-28 bg-white shadow-xl rounded-[2.5rem] border border-gray-100 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#0a2d54] text-white flex items-center justify-center font-black text-xl mb-4">SC</div>
            <h2 className="text-[#0a2d54] uppercase font-black text-lg tracking-tight mb-2">Módulo em Integração</h2>
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-6">Módulo {view} estará disponível na próxima atualização.</p>
            <button onClick={() => setView("acessos")} className="bg-[#0a2d54] hover:bg-[#bfa571] text-white font-[#0a2d54] px-6 h-11 uppercase text-[10px] tracking-widest rounded-xl border-none cursor-pointer">Voltar para Dashboard</button>
          </div>
        );
      case "chat":
        return (
          <AIChat
            symptomPreload={symptomPreload}
            setSymptomPreload={setSymptomPreload}
            setView={setView}
          />
        );
      default:
        return (
          <Home 
            setView={setView} 
            setPreselectedDoctorId={setPreselectedDoctorId} 
          />
        );
    }
  };

  const isSystemView = [
    "acessos",
    "despesas",
    "fechamento",
    "gestao-permissoes",
    "horarios",
    "pacientes",
    "login",
    "planos",
    "repasses",
    "relatorios",
    "encaminhamentos",
    "cadastro-usuario"
  ].includes(view);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-950" id="serclin-app-root">
      
      {/* Navbar header - Only rendered on public facing pages */}
      {!isSystemView && (
        <Navbar 
          currentView={view} 
          setView={setView} 
          hasAppointments={appointments.some(a => a.status === "active")}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col animate-fadeIn">
        {renderActiveView()}
      </div>

      {/* Footer banner - Only rendered on public facing pages */}
      {!isSystemView && <Footer setView={setView} />}
      
    </div>
  );
}
