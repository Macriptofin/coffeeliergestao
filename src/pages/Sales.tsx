import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText } from "lucide-react";
import ProposalsList from '@/components/sales/ProposalsList';
import ClientForm from '@/components/sales/ClientForm';
import ClientsList from '@/components/sales/ClientsList';
import ClientDetails from '@/components/sales/client/ClientDetails';
import ProposalEditor from '@/components/sales/ProposalEditor';
import { ProposalPDF } from '@/components/sales/ProposalPDF';

const Sales = () => {
  const [activeTab, setActiveTab] = useState('proposals');
  const [showProposalEditor, setShowProposalEditor] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [pdfProposalId, setPdfProposalId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);

  const handleNewProposal = () => {
    setEditingProposalId(null);
    setShowProposalEditor(true);
    setActiveTab('proposals');
  };

  const handleEditProposal = (id: string) => {
    setEditingProposalId(id);
    setShowProposalEditor(true);
  };

  const handleViewProposal = (id: string) => {
    setEditingProposalId(id);
    setShowProposalEditor(true);
  };

  const handlePdfProposal = (id: string) => {
    setPdfProposalId(id);
    setActiveTab('proposals');
  };

  const handleProposalEditorComplete = () => {
    setShowProposalEditor(false);
    setEditingProposalId(null);
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
    setEditingClientId(id);
    setViewingClientId(null);
    setShowClientForm(true);
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
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="proposals" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Propostas</span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2 py-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
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
            />
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
};
export default Sales;
