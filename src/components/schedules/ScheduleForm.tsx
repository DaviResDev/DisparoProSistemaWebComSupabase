
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, MessageSquare, X, SendHorizontal, Loader2, Check, Search } from 'lucide-react';
import { useSchedules, ScheduleFormData } from '@/hooks/useSchedules';
import { useContacts } from '@/hooks/useContacts';
import { useTemplates } from '@/hooks/useTemplates';
import useEnvios from '@/hooks/useEnvios';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ScheduleFormProps {
  onCancel: () => void;
  initialData?: ScheduleFormData & { id?: string };
  isEditing?: boolean;
  onSuccess?: () => void; // Added onSuccess prop
}

export function ScheduleForm({ onCancel, initialData, isEditing = false, onSuccess }: ScheduleFormProps) {
  const [formData, setFormData] = useState<ScheduleFormData>(
    initialData || {
      contato_id: '',
      template_id: '',
      data_envio: new Date().toISOString().slice(0, 16)
    }
  );
  
  const [selectedContacts, setSelectedContacts] = useState<string[]>(
    initialData?.contato_id ? [initialData.contato_id] : []
  );
  
  const [bulkMode, setBulkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  const { createSchedule, updateSchedule } = useSchedules();
  const { contacts, fetchContacts } = useContacts();
  const { templates, fetchTemplates } = useTemplates();
  const { sendEmail, sending } = useEnvios();

  useEffect(() => {
    fetchContacts();
    fetchTemplates();
  }, []);
  
  // Extract all unique tags from contacts
  useEffect(() => {
    const tags = contacts.reduce((allTags: string[], contact) => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach(tag => {
          if (!allTags.includes(tag)) {
            allTags.push(tag);
          }
        });
      }
      return allTags;
    }, []);
    
    setAvailableTags(tags);
  }, [contacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.template_id) {
      toast.error("Selecione um template para agendar");
      return;
    }
    
    if (selectedContacts.length === 0) {
      toast.error("Selecione pelo menos um contato para agendar");
      return;
    }
    
    // Bulk scheduling
    if (bulkMode && selectedContacts.length > 1) {
      let successCount = 0;
      const totalCount = selectedContacts.length;
      
      for (const contactId of selectedContacts) {
        const singleFormData = {
          ...formData,
          contato_id: contactId
        };
        
        const success = isEditing && initialData?.id
          ? await updateSchedule(initialData.id, singleFormData)
          : await createSchedule(singleFormData);
          
        if (success) successCount++;
      }
      
      if (successCount === totalCount) {
        toast.success(`${totalCount} agendamentos criados com sucesso!`);
        onCancel();
        if (onSuccess) onSuccess();
      } else {
        toast.warning(`${successCount} de ${totalCount} agendamentos foram criados com sucesso.`);
        if (successCount > 0 && onSuccess) onSuccess();
      }
      
      return;
    }
    
    // Single scheduling
    const singleFormData = {
      ...formData,
      contato_id: selectedContacts[0]
    };
    
    const success = isEditing && initialData?.id
      ? await updateSchedule(initialData.id, singleFormData)
      : await createSchedule(singleFormData);
      
    if (success) {
      onCancel();
      if (onSuccess) onSuccess();
    }
  };

  const handleSendNow = async () => {
    if (!formData.template_id) {
      toast.error("Selecione um template para enviar agora");
      return;
    }
    
    if (selectedContacts.length === 0) {
      toast.error("Selecione pelo menos um contato para enviar agora");
      return;
    }

    try {
      if (bulkMode && selectedContacts.length > 1) {
        let successCount = 0;
        const totalCount = selectedContacts.length;
        
        toast.info(
          `Iniciando envio para ${totalCount} contatos...`,
          { duration: 3000 }
        );
        
        for (const contactId of selectedContacts) {
          const result = await sendEmail({
            contato_id: contactId,
            template_id: formData.template_id
          });
          
          if (result) successCount++;
        }
        
        if (successCount === totalCount) {
          toast.success(`Mensagens enviadas com sucesso para todos os ${totalCount} contatos!`);
          onCancel();
          if (onSuccess) onSuccess();
        } else {
          toast.warning(`${successCount} de ${totalCount} mensagens foram enviadas com sucesso.`);
          if (successCount > 0 && onSuccess) onSuccess();
        }
        
        return;
      }
      
      // Single send
      const selectedContact = contacts.find(c => c.id === selectedContacts[0]);
      
      toast.info(
        `Iniciando envio para ${selectedContact?.nome || 'contato selecionado'}...`,
        { duration: 3000 }
      );
      
      const result = await sendEmail({
        contato_id: selectedContacts[0],
        template_id: formData.template_id
      });
      
      if (result) {
        onCancel();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error("Erro durante o envio:", error);
      toast.error(`Erro ao enviar mensagem: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      } else {
        if (!bulkMode) {
          // In single mode, replace the selection
          return [contactId];
        }
        // In bulk mode, add to selection
        return [...prev, contactId];
      }
    });
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    // When switching to single mode, keep only the first selection
    if (bulkMode && selectedContacts.length > 1) {
      setSelectedContacts([selectedContacts[0]]);
    }
  };
  
  const toggleTagSelection = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };
  
  // Filter contacts based on search query and selected tags
  const filteredContacts = contacts.filter(contact => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      contact.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.telefone && contact.telefone.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (contact.razao_social && contact.razao_social.toLowerCase().includes(searchQuery.toLowerCase()));
      
    // Tag filter
    const matchesTags = selectedTags.length === 0 || 
      (contact.tags && selectedTags.some(tag => contact.tags && contact.tags.includes(tag)));
      
    return matchesSearch && matchesTags;
  });

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <h3 className="text-lg font-semibold">{isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox 
              id="bulkMode" 
              checked={bulkMode} 
              onCheckedChange={toggleBulkMode}
            />
            <label
              htmlFor="bulkMode"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Selecionar múltiplos contatos
            </label>
          </div>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          
          {/* Tag selection */}
          {availableTags.length > 0 && (
            <div>
              <Label className="mb-2 block">Filtrar por tags</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <div 
                    key={tag} 
                    className={`px-2.5 py-0.5 rounded-full text-xs cursor-pointer ${
                      selectedTags.includes(tag) 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    onClick={() => toggleTagSelection(tag)}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="contato">Contato{bulkMode ? 's' : ''}</Label>
            <ScrollArea className="h-40 border rounded-md p-2 mt-2">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center mb-2">
                    <Checkbox
                      id={`contact-${contact.id}`}
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleContactSelection(contact.id)}
                      className="mr-2"
                    />
                    <label htmlFor={`contact-${contact.id}`} className="text-sm">
                      <span className="font-medium">{contact.nome}</span>
                      <span className="text-muted-foreground ml-2">({contact.email})</span>
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.tags.map((tag, i) => (
                            <span 
                              key={i}
                              className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </label>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Nenhum contato encontrado
                </div>
              )}
            </ScrollArea>
          </div>

          <div>
            <Label htmlFor="template">Template</Label>
            <Select 
              value={formData.template_id} 
              onValueChange={(value) => setFormData({ ...formData, template_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center">
                      {template.canal === 'email' ? (
                        <Mail className="w-4 h-4 mr-2" />
                      ) : template.canal === 'whatsapp' ? (
                        <MessageSquare className="w-4 h-4 mr-2" />
                      ) : template.canal === 'ambos' ? (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          <MessageSquare className="w-4 h-4 mr-2" />
                        </>
                      ) : null}
                      {template.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="data_envio">Data de Envio</Label>
            <Input
              id="data_envio"
              type="datetime-local"
              value={formData.data_envio}
              onChange={(e) => setFormData({ ...formData, data_envio: e.target.value })}
              min={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between space-x-2">
          <Button 
            variant="ghost" 
            type="button"
            onClick={onCancel}
            disabled={sending}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleSendNow}
              disabled={sending || selectedContacts.length === 0 || !formData.template_id}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="mr-2 h-4 w-4" />
              )}
              {sending ? 'Enviando...' : 'Enviar Agora'}
            </Button>
            <Button 
              type="submit"
              disabled={sending || selectedContacts.length === 0 || !formData.template_id}
            >
              {isEditing ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Atualizar
                </>
              ) : (
                'Criar Agendamento'
              )}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
