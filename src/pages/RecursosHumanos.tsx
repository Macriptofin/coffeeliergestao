import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Clock, FileText, Calendar, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RecursosHumanos = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Colaboradores",
      description: "Cadastro e gestão de funcionários e dados pessoais",
      icon: Users,
      href: "/rh/colaboradores",
      color: "bg-blue-500",
      available: true
    },
    {
      title: "Usuários do Sistema",
      description: "Controle de acesso, perfis e permissões",
      icon: Shield,
      href: "/usuarios",
      color: "bg-purple-500",
      available: true
    },
    {
      title: "Controle de Ponto",
      description: "Registro de horários, faltas e horas extras",
      icon: Clock,
      href: "/rh/ponto",
      color: "bg-green-500",
      available: true
    },
    {
      title: "Folha de Pagamento",
      description: "Cálculos salariais, descontos e benefícios",
      icon: FileText,
      href: null,
      color: "bg-orange-500",
      available: false
    },
    {
      title: "Férias e Afastamentos",
      description: "Controle de férias, licenças e afastamentos",
      icon: Calendar,
      href: null,
      color: "bg-cyan-500",
      available: false
    },
    {
      title: "Treinamentos",
      description: "Gestão de capacitação e desenvolvimento",
      icon: Award,
      href: null,
      color: "bg-red-500",
      available: false
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Recursos Humanos</h1>
        <p className="text-muted-foreground">
          Gestão completa de pessoas, usuários e processos de RH
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className={`transition-shadow ${module.available ? "cursor-pointer hover:shadow-lg" : "opacity-60"}`}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${module.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    {!module.available && (
                      <Badge variant="secondary" className="text-xs">Em breve</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {module.description}
                </CardDescription>
                <Button
                  onClick={() => module.available && module.href && navigate(module.href)}
                  variant="outline"
                  className="w-full"
                  disabled={!module.available}
                >
                  {module.available ? "Acessar" : "Em desenvolvimento"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default RecursosHumanos;
