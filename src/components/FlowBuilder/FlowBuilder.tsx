import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, MessageSquare, HelpCircle, GitBranch, CheckCircle, Link2, Code, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Node type definitions
interface NodeData extends Record<string, unknown> {
  label: string;
  type: 'message' | 'question' | 'confirmation' | 'branch' | 'redirect' | 'branchOption' | 'code';
  message?: string;
  variable?: string;
  options?: string[];
  redirectUrl?: string;
  code?: string;
  timeout?: number;
}

// Custom Node Components
const MessageNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border-2 border-primary/20 rounded-lg p-4 min-w-[200px]">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <div className="flex items-center gap-2 mb-2">
      <MessageSquare className="w-4 h-4 text-primary" />
      <span className="font-semibold text-sm">Message</span>
    </div>
    <p className="text-xs text-muted-foreground">{data.message || 'No message set'}</p>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const QuestionNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border-2 border-blue-500/20 rounded-lg p-4 min-w-[200px]">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <div className="flex items-center gap-2 mb-2">
      <HelpCircle className="w-4 h-4 text-blue-500" />
      <span className="font-semibold text-sm">Question</span>
    </div>
    <p className="text-xs text-muted-foreground">{data.message || 'No question set'}</p>
    {data.variable && (
      <p className="text-xs text-blue-500 mt-1">→ {data.variable}</p>
    )}
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const ConfirmationNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border-2 border-green-500/20 rounded-lg p-4 min-w-[200px]">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <div className="flex items-center gap-2 mb-2">
      <CheckCircle className="w-4 h-4 text-green-500" />
      <span className="font-semibold text-sm">Confirmation</span>
    </div>
    <p className="text-xs text-muted-foreground">{data.message || 'Confirm previous input?'}</p>
    <div className="flex gap-4 mt-2">
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="w-3 h-3 !left-[30%]"
        style={{ background: 'green' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="w-3 h-3 !left-[70%]"
        style={{ background: 'red' }}
      />
    </div>
    <div className="flex justify-between text-xs mt-1">
      <span className="text-green-500">Yes</span>
      <span className="text-red-500">No</span>
    </div>
  </div>
);

const BranchNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border-2 border-purple-500/20 rounded-lg p-4 min-w-[200px] text-center">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <div className="flex items-center gap-2 mb-2 justify-center">
      <GitBranch className="w-4 h-4 text-purple-500" />
      <span className="font-semibold text-sm">Branch</span>
    </div>
    <p className="text-xs text-muted-foreground">
      {data.message || "Conditional branch"}
    </p>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const BranchOptionNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border border-purple-400/40 rounded-lg px-3 py-2 min-w-[120px] text-center">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <p className="text-xs text-purple-500 font-medium">{data.label}</p>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
  </div>
);

const RedirectNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border-2 border-orange-500/20 rounded-lg p-4 min-w-[200px]">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <div className="flex items-center gap-2 mb-2">
      <Link2 className="w-4 h-4 text-orange-500" />
      <span className="font-semibold text-sm">Redirect</span>
    </div>
    <p className="text-xs text-muted-foreground">{data.redirectUrl || 'No URL set'}</p>
  </div>
);

const CodeNode = ({ data }: { data: NodeData }) => (
  <div className="bg-card border-2 border-yellow-500/20 rounded-lg p-4 min-w-[200px]">
    <Handle type="target" position={Position.Top} className="w-3 h-3" />
    <div className="flex items-center gap-2 mb-2">
      <Code className="w-4 h-4 text-yellow-500" />
      <span className="font-semibold text-sm">Code</span>
    </div>
    <p className="text-xs text-muted-foreground font-mono">
      {data.code ? `${data.code.slice(0, 30)}...` : 'No code set'}
    </p>
    <div className="flex gap-4 mt-2">
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="w-3 h-3 !left-[30%]"
        style={{ background: 'green' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        className="w-3 h-3 !left-[70%]"
        style={{ background: 'red' }}
      />
    </div>
    <div className="flex justify-between text-xs mt-1">
      <span className="text-green-500">Success</span>
      <span className="text-red-500">Error</span>
    </div>
  </div>
);

const nodeTypes: NodeTypes = {
  message: MessageNode,
  question: QuestionNode,
  confirmation: ConfirmationNode,
  branch: BranchNode,
  branchOption: BranchOptionNode,
  redirect: RedirectNode,
  code: CodeNode,
};

interface FlowBuilderProps {
  botId?: string;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  onFlowChange?: (nodes: Node[], edges: Edge[]) => void;
  isMaximized?: boolean;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

export function FlowBuilder({ botId, onSave, onFlowChange, isMaximized = false, initialNodes, initialEdges }: FlowBuilderProps) {
  const { toast } = useToast();

  const defaultNodes: Node<NodeData>[] = initialNodes as Node<NodeData>[] || [
    {
      id: '1',
      type: 'message',
      position: { x: 250, y: 50 },
      data: {
        label: 'Welcome Message',
        type: 'message',
        message: 'Hello! I\'m here to help you. Let\'s start by getting some information.'
      },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);

  useEffect(() => {
    if (onFlowChange) {
      onFlowChange(nodes, edges);
    }
  }, [nodes, edges, onFlowChange]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<NodeData>);
    setShowNodeEditor(true);
  }, []);

  const addNode = (type: NodeData['type']) => {
    // ✅ UPDATED: Add default values for nodes with required fields
    const defaultData: any = {
      label: `${type} Node`,
      type,
    };

    // Message node with default placeholder text
    if (type === 'message') {
      defaultData.message = 'Enter your message here';
    }
    // Question node with default text and variable name
    else if (type === 'question') {
      defaultData.message = 'What would you like to know?';
      defaultData.variable = 'answer'; // Default variable name
    }
    // Confirmation node with default text
    else if (type === 'confirmation') {
      defaultData.message = 'Is this correct?';
    }
    // Code node with template
    else if (type === 'code') {
      defaultData.code = '// Write your JavaScript code here\n// Available: axios, variables, getVariable(), setVariable()\n\n';
      defaultData.timeout = 5000;
    }

    const newNode: Node<NodeData> = {
      id: `${nodes.length + 1}`,
      type,
      position: { x: 250, y: nodes.length * 150 + 100 },
      data: defaultData,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNode = (nodeId: string, data: Partial<NodeData>) => {
    setNodes((nds) => {
      let updatedNodes = nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as NodeData }
          : node
      );

      const branchNode = updatedNodes.find((n) => n.id === nodeId);

      if (branchNode?.data.type === "branch" && data.options) {
        updatedNodes = updatedNodes.filter(
          (n) => !n.id.startsWith(`${nodeId}-opt-`)
        );

        const optionNodes: Node<NodeData>[] = data.options.map((opt, i) => ({
          id: `${nodeId}-opt-${i}`,
          type: "branchOption",
          position: {
            x: branchNode.position.x + 250,
            y: branchNode.position.y + i * 100,
          },
          data: { label: opt, type: "branchOption" },
        }));

        updatedNodes = [...updatedNodes, ...optionNodes];

        setEdges((eds) =>
          eds.filter((e) => !e.source.startsWith(`${nodeId}`))
        );

        setEdges((eds) => [
          ...eds,
          ...data.options.map((_, i) => ({
            id: `${nodeId}-to-opt-${i}`,
            source: nodeId,
            target: `${nodeId}-opt-${i}`,
          })),
        ]);
      }

      return updatedNodes;
    });

    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, ...data } as NodeData } : null
      );
    }
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setShowNodeEditor(false);
    setSelectedNode(null);
  };

  // ✅ UPDATED: Add validation function to check required fields
  const validateNodes = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    nodes.forEach((node) => {
      // Message nodes require text
      if (node.data.type === 'message') {
        if (!node.data.message || node.data.message.trim() === '') {
          errors.push(`Message node "${node.id}": Message text is required`);
        }
      }
      // Question nodes require both text and variable
      else if (node.data.type === 'question') {
        if (!node.data.message || node.data.message.trim() === '') {
          errors.push(`Question node "${node.id}": Question text is required`);
        }
        if (!node.data.variable || node.data.variable.trim() === '') {
          errors.push(`Question node "${node.id}": Variable name is required`);
        }
      }
      // Confirmation nodes require text
      else if (node.data.type === 'confirmation') {
        if (!node.data.message || node.data.message.trim() === '') {
          errors.push(`Confirmation node "${node.id}": Confirmation text is required`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const handleSave = () => {
    // ✅ UPDATED: Validate nodes before saving
    const validation = validateNodes();

    if (!validation.isValid) {
      // Show first error as main message
      toast({
        title: "Validation Error",
        description: validation.errors[0],
        variant: "destructive",
      });

      // Log all errors to console for debugging
      console.error("Flow validation errors:", validation.errors);
      return;
    }

    if (onSave) {
      onSave(nodes, edges);
      toast({
        title: "Success",
        description: "Flow saved successfully",
      });
    }
  };

  return (
    <div className={isMaximized ? "h-full flex flex-col" : "h-[600px] flex flex-col"}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-3 border-b bg-card/50">
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addNode('message')}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Message
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addNode('question')}
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Question
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addNode('confirmation')}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirmation
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addNode('branch')}
          >
            <GitBranch className="w-4 h-4 mr-2" />
            Branch
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addNode('redirect')}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Redirect
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addNode('code')}
          >
            <Code className="w-4 h-4 mr-2" />
            Code
          </Button>
        </div>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      {/* Node Editor Panel */}
      {showNodeEditor && selectedNode && (
        <Card className="absolute top-4 right-4 z-50 w-96 p-4 shadow-lg bg-card max-h-[calc(100%-2rem)] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Edit Node</h3>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowNodeEditor(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {(selectedNode.data.type === 'message' ||
              selectedNode.data.type === 'question' ||
              selectedNode.data.type === 'confirmation') && (
                <div>
                  {/* ✅ UPDATED: Show required indicator */}
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="node-message">Message</Label>
                    <span className="text-red-500 text-sm font-bold">*</span>
                  </div>
                  {(!selectedNode.data.message || selectedNode.data.message.trim() === '') && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                      <AlertCircle className="w-3 h-3" />
                      <span>This field is required</span>
                    </div>
                  )}
                  <Textarea
                    id="node-message"
                    value={selectedNode.data.message || ''}
                    onChange={(e) => updateNode(selectedNode.id, { message: e.target.value })}
                    placeholder="Enter your message..."
                    className="mt-1 nodrag"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              )}

            {selectedNode.data.type === 'question' && (
              <div>
                {/* ✅ UPDATED: Show required indicator */}
                <div className="flex items-center gap-1 mb-1">
                  <Label htmlFor="node-variable">Variable Name</Label>
                  <span className="text-red-500 text-sm font-bold">*</span>
                </div>
                {(!selectedNode.data.variable || selectedNode.data.variable.trim() === '') && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
                    <AlertCircle className="w-3 h-3" />
                    <span>This field is required</span>
                  </div>
                )}
                <Input
                  id="node-variable"
                  type="text"
                  value={selectedNode.data.variable || ''}
                  onChange={(e) => updateNode(selectedNode.id, { variable: e.target.value })}
                  placeholder="e.g., userName, userEmail"
                  className="mt-1 nodrag"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {selectedNode.data.type === 'branch' && (
              <div>
                <Label>Options</Label>
                <div className="space-y-2">
                  {selectedNode.data.options?.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...(selectedNode.data.options || [])];
                          newOpts[i] = e.target.value;
                          updateNode(selectedNode.id, { options: newOpts });
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          updateNode(selectedNode.id, {
                            options: (selectedNode.data.options || []).filter((_, idx) => idx !== i),
                          });
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateNode(selectedNode.id, {
                          options: [...(selectedNode.data.options || []), ""],
                        });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Option
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedNode.data.type === 'redirect' && (
              <div>
                <Label htmlFor="node-redirect">Redirect URL</Label>
                <Input
                  id="node-redirect"
                  type="text"
                  value={selectedNode.data.redirectUrl || ''}
                  onChange={(e) => updateNode(selectedNode.id, { redirectUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="mt-1 nodrag"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {selectedNode.data.type === 'code' && (
              <>
                <div>
                  <Label htmlFor="node-code">JavaScript Code</Label>
                  <Textarea
                    id="node-code"
                    value={selectedNode.data.code || ''}
                    onChange={(e) => updateNode(selectedNode.id, { code: e.target.value })}
                    placeholder="// Your JavaScript code here"
                    className="mt-1 nodrag font-mono text-xs h-64"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: axios, variables, getVariable(), setVariable()
                  </p>
                </div>
                <div>
                  <Label htmlFor="node-timeout">Timeout (ms)</Label>
                  <Input
                    id="node-timeout"
                    type="number"
                    value={selectedNode.data.timeout || 5000}
                    onChange={(e) => updateNode(selectedNode.id, { timeout: parseInt(e.target.value) || 5000 })}
                    placeholder="5000"
                    className="mt-1 nodrag"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded text-xs space-y-1">
                  <p className="font-semibold">Example Usage:</p>
                  <code className="block">const email = getVariable('userEmail');</code>
                  <code className="block">const res = await axios.get('...');</code>
                  <code className="block">setVariable('data', res.data);</code>
                  <code className="block">result = res.data; // output</code>
                </div>
              </>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteNode(selectedNode.id)}
              className="w-full"
            >
              Delete Node
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}