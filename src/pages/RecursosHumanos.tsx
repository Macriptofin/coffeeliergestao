import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      color: "bg-blue-500"
    },
    {
      title: "Usuários do Sistema",
      description: "Controle de acesso, perfis e permissões",
      icon: Shield,
      href: "/usuarios",
      color: "bg-purple-500"
    },
    {
      title: "Controle de Ponto",
      description: "Registro de horários, faltas e horas extras",
      icon: Clock,
      href: "/rh/ponto",
      color: "bg-green-500"
    },
    {
      title: "Folha de Pagamento",
      description: "Cálculos salariais, descontos e benefícios",
      icon: FileText,
      href: "/rh/folha",
      color: "bg-orange-500"
    },
    {
      title: "Férias e Afastamentos",
      description: "Controle de férias, licenças e afastamentos",
      icon: Calendar,
      href: "/rh/ferias",
      color: "bg-cyan-500"
    },
    {
      title: "Treinamentos",
      description: "Gestão de capacitação e desenvolvimento",
      icon: Award,
      href: "/rh/treinamentos",
      color: "bg-red-500"
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
            <Card key={module.title} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${module.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {module.description}
                </CardDescription>
                <Button 
                  onClick={() => navigate(module.href)}
                  variant="outline" 
                  className="w-full"
                >
                  Acessar
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