import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, KanbanSquare, Store } from "lucide-react";
import ProposalsList from '@/components/sales/ProposalsList';
import PortalAdmin from '@/components/sales/PortalAdmin';
import SalesPipeline from '@/components/sales/SalesPipeline';
import ClientForm from '@/components/sales/ClientForm';
import ClientsList from '@/components/sales/ClientsList';
import ClientDetails from '@/components/sales/client/ClientDetails';
import ProposalEditor from '@/components/sales/ProposalEditor';
import { ProposalPDF } from '@/components/sales/ProposalPDF';
import { ProposalUmbrellaPanel } from '@/components/sales/ProposalUmbrellaPanel';
import { ProposalDetailView } from '@/components/sales/ProposalDetailView';

const Sales = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('proposals');
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [pdfProposalId, setPdfProposalId] = useState<string | null>(null);
  const [viewingUmbrellaId, setViewingUmbrellaId] = useState<string | null>(null);
  const [viewingProposalId, setViewingProposalId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);

  const handleNewProposal = () => {
    setEditingProposalId(null);
    setShowProposalEditor(true);
    setActiveTab('proposals');
  };

  const handleEditProposal = (id: string) => {
    setViewingProposalId(null);
    setEditingProposalId(id);
    setShowProposalEditor(true);
  };

  // Visualizar = tela somente-leitura (estilo portal); editar continua no editor.
  const handleViewProposal = (id: string) => {
    setShowProposalEditor(false);
    setEditingProposalId(null);
    setViewingProposalId(id);
  };

  const handlePdfProposal = (id: string) => {
    setPdfProposalId(id);
    setActiveTab('proposals');
  };

  const handleViewUmbrella = (id: string) => {
    setViewingProposalId(null);
    setViewingUmbrellaId(id);
    setActiveTab('proposals');
  };

  const handleProposalEditorComplete = () => {
    setShowProposalEditor(false);
    setEditingProposalId(null);
    // Atualiza Propostas e Funil na hora (mesmo cache ['proposals'])
    queryClient.invalidateQueries({ queryKey: ['proposals'] });
  };

  const handleProposalEditorCancel = () => {
    setShowProposalEditor(false);
    setEditingProposalId(null);
  };

  const handleNewClient = () => {
    setEditingClientId(null);
    setShowClientForm(true);
    setActiveTab('clients');
  };

  const handleEditClient = (id: string) => {
    // Edição agora abre o Cliente 360 (ClientDetails), cujo conteúdo da aba "Dados"
    // é o ClientForm embutido. Mesmo caminho do Visualizar.
    setViewingClientId(id);
    setShowClientForm(false);
    setEditingClientId(null);
  };

  const handleViewClient = (id: string) => {
    setViewingClientId(id);
    setShowClientForm(false);
    setEditingClientId(null);
  };

  const handleClientSuccess = () => {
    setShowClientForm(false);
    setEditingClientId(null);
    setViewingClientId(null);
  };

  const handleClientCancel = () => {
    setShowClientForm(false);
    setEditingClientId(null);
  };

  const handleClientDetailsBack = () => {
    setViewingClientId(null);
  };

  const handleClientDetailsEdit = () => {
    if (viewingClientId) {
      setEditingClientId(viewingClientId);
      setViewingClientId(null);
      setShowClientForm(true);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Gestão de Vendas</h1>
        <p className="text-muted-foreground">
          Gestão de clientes e propostas comerciais
        </p>
      </div>

      {/* Tabs do Sistema */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="proposals" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Propostas</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2 py-2">
            <KanbanSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Funil</span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2 py-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="portal" className="flex items-center gap-2 py-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Portal</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-6">
          {viewingClientId ? (
            <ClientDetails
              clientId={viewingClientId}
              onBack={handleClientDetailsBack}
              onEdit={handleClientDetailsEdit}
            />
          ) : showClientForm ? (
            <ClientForm
              clientId={editingClientId || undefined}
              onSuccess={handleClientSuccess}
              onCancel={handleClientCancel}
            />
          ) : (
            <ClientsList
              onNewClient={handleNewClient}
              onEditClient={handleEditClient}
              onViewClient={handleViewClient}
            />
          )}
        </TabsContent>

        <TabsContent value="proposals" className="mt-6">
          {pdfProposalId ? (
            <ProposalPDF
              proposalId={pdfProposalId}
              onClose={() => setPdfProposalId(null)}
            />
          ) : viewingUmbrellaId ? (
            <ProposalUmbrellaPanel
              proposalId={viewingUmbrellaId}
              onBack={() => setViewingUmbrellaId(null)}
              onViewProposal={(id) => { setViewingUmbrellaId(null); handleViewProposal(id); }}
            />
          ) : viewingProposalId ? (
            <ProposalDetailView
              proposalId={viewingProposalId}
              onBack={() => setViewingProposalId(null)}
              onEdit={handleEditProposal}
              onPdf={handlePdfProposal}
              onViewUmbrella={handleViewUmbrella}
            />
          ) : showProposalEditor ? (
            <ProposalEditor
              proposalId={editingProposalId}
              onComplete={handleProposalEditorComplete}
              onCancel={handleProposalEditorCancel}
            />
          ) : (
            <ProposalsList
              onNewProposal={handleNewProposal}
              onEditProposal={handleEditProposal}
              onViewProposal={handleViewProposal}
              onPdfProposal={handlePdfProposal}
              onViewUmbrella={handleViewUmbrella}
            />
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <SalesPipeline />
        </TabsContent>

        <TabsContent value="portal" className="mt-6">
          <PortalAdmin />
        </TabsContent>

      </Tabs>
    </div>
  );
};
export default Sales;
