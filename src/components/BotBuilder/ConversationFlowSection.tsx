import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareText, Maximize2, Minimize2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { FlowBuilder } from '@/components/FlowBuilder/FlowBuilder';
import { Node, Edge } from '@xyflow/react';
import { Button } from '@/components/ui/button';

interface ConversationFlowSectionProps {
  botId?: string;
  onFlowSave?: (nodes: Node[], edges: Edge[]) => void;
  onFlowChange?: (nodes: Node[], edges: Edge[]) => void;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

export function ConversationFlowSection({ 
  botId,
  onFlowSave,
  onFlowChange,
  initialNodes,
  initialEdges
}: ConversationFlowSectionProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isMaximized) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isMaximized]);

  return (
    <>
      <CollapsibleSection
        title="Conversation Flow"
        icon={<MessageSquareText className="w-5 h-5 text-primary" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Design a step-by-step conversation flow for your bot. Add messages, questions, confirmations, branching logic, and redirects.
              Changes are automatically saved to your bot configuration.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMaximized(true)}
              className="shrink-0 ml-4"
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              Maximize
            </Button>
          </div>
          {!isMaximized && (
            <FlowBuilder 
              botId={botId} 
              onSave={onFlowSave}
              onFlowChange={onFlowChange}
              initialNodes={initialNodes}
              initialEdges={initialEdges}
            />
          )}
        </div>
      </CollapsibleSection>

      {isMaximized && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background overscroll-none overflow-hidden">
          <div className="h-screen flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageSquareText className="w-5 h-5 text-primary" />
                Conversation Flow Builder
              </h2>
              <Button
                variant="outline"
                onClick={() => setIsMaximized(false)}
              >
                <Minimize2 className="w-4 h-4 mr-2" />
                Minimize
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <FlowBuilder 
                botId={botId} 
                onSave={onFlowSave}
                onFlowChange={onFlowChange}
                isMaximized={true}
                initialNodes={initialNodes}
                initialEdges={initialEdges}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

    </>
  );
}