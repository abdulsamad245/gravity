import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Box,
  Boxes,
  Circle,
  Cloud,
  CloudCog,
  Component,
  Container,
  Cylinder,
  Database,
  Diamond,
  Factory,
  FileText,
  FolderTree,
  HardDrive,
  Hexagon,
  KeyRound,
  Layers,
  LayoutGrid,
  ListTree,
  Lock,
  Monitor,
  Network,
  Octagon,
  Plane,
  RefreshCw,
  Server,
  Shield,
  Smartphone,
  Square,
  Star,
  Table2,
  Triangle,
  Truck,
  User,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import type { ObjectType, ToolId } from '../types';
export type ShapeLibraryAction =
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'stamp'; glyph: string }
  | { kind: 'shape'; type: ObjectType; label: string };
export type ShapeLibraryItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  action: ShapeLibraryAction;
  /** Icon stroke/fill in the library grid (vendor packs use brand colors). */
  color?: string;
};
export type ShapeLibrarySection = {
  id: string;
  title: string;
  /** Default icon color for items that omit `color`. */
  color?: string;
  items: ShapeLibraryItem[];
};
function withColors(
  items: ShapeLibraryItem[],
  palette: string[],
): ShapeLibraryItem[] {
  return items.map((item, i) => ({
    ...item,
    color: item.color ?? palette[i % palette.length],
  }));
}
const AZURE_COLORS = [
  '#0078D4',
  '#50E6FF',
  '#FFB900',
  '#00BCF2',
  '#881798',
  '#CA5010',
  '#498205',
  '#C239B3',
];
const GCP_COLORS = [
  '#4285F4',
  '#34A853',
  '#FBBC05',
  '#EA4335',
  '#669DF6',
  '#1A73E8',
  '#F9AB00',
  '#5BB974',
];
const CISCO_BLUE = '#049FD9';
const K8S_BLUE = '#326CE5';
const VMWARE_COLORS = ['#60778A', '#71AB28', '#3F6C99', '#F0A30A'];
const UML_BLUE = '#3D5AFE';
const DIAGRAM_INK = '#8B93A7';
/** Current Gravity extras - shown first under Building tools. */
export const BUILDING_TOOLS: ShapeLibrarySection = {
  id: 'building-tools',
  title: 'Building tools',
  items: [
    { id: 'star', label: 'Star', icon: Star, action: { kind: 'tool', tool: 'star' } },
    { id: 'hexagon', label: 'Hexagon', icon: Hexagon, action: { kind: 'tool', tool: 'hexagon' } },
    { id: 'table', label: 'Table', icon: Table2, action: { kind: 'tool', tool: 'table' } },
    { id: 'mindmap', label: 'Mind map', icon: Network, action: { kind: 'tool', tool: 'mindmap' } },
  ],
};
export const DIAGRAMMING_BASIC: ShapeLibrarySection = {
  id: 'basic-shapes',
  title: 'Basic shapes',
  color: DIAGRAM_INK,
  items: [
    {
      id: 'sq',
      label: 'Rectangle',
      icon: Square,
      action: { kind: 'tool', tool: 'rect' },
    },
    {
      id: 'tri',
      label: 'Triangle',
      icon: Triangle,
      action: { kind: 'tool', tool: 'triangle' },
    },
    {
      id: 'dia',
      label: 'Diamond',
      icon: Diamond,
      action: { kind: 'tool', tool: 'diamond' },
    },
    {
      id: 'oval',
      label: 'Oval',
      icon: Circle,
      action: { kind: 'tool', tool: 'ellipse' },
    },
    {
      id: 'star2',
      label: 'Star',
      icon: Star,
      action: { kind: 'tool', tool: 'star' },
    },
    {
      id: 'hex2',
      label: 'Hexagon',
      icon: Hexagon,
      action: { kind: 'tool', tool: 'hexagon' },
    },
    {
      id: 'arr',
      label: 'Arrow right',
      icon: ArrowRight,
      action: { kind: 'tool', tool: 'arrow' },
    },
    {
      id: 'arr2',
      label: 'Double arrow',
      icon: ArrowLeftRight,
      action: { kind: 'shape', type: 'blockArrow', label: '↔' },
    },
    {
      id: 'oct',
      label: 'Octagon',
      icon: Octagon,
      action: { kind: 'stamp', glyph: '⬡' },
    },
    {
      id: 'cloud',
      label: 'Cloud',
      icon: Cloud,
      action: { kind: 'stamp', glyph: '☁️' },
    },
    {
      id: 'cyl',
      label: 'Cylinder',
      icon: Cylinder,
      action: { kind: 'stamp', glyph: '🛢️' },
    },
    {
      id: 'doc',
      label: 'Document',
      icon: FileText,
      action: { kind: 'stamp', glyph: '📄' },
    },
  ],
};
export const DIAGRAMMING_FLOW: ShapeLibrarySection = {
  id: 'flowchart',
  title: 'Flowchart',
  color: UML_BLUE,
  items: [
    {
      id: 'process',
      label: 'Process',
      icon: Square,
      action: { kind: 'shape', type: 'rect', label: 'Process' },
    },
    {
      id: 'decision',
      label: 'Decision',
      icon: Diamond,
      action: { kind: 'shape', type: 'diamond', label: 'Decision' },
    },
    {
      id: 'terminator',
      label: 'Terminator',
      icon: Circle,
      action: { kind: 'shape', type: 'ellipse', label: 'Start / End' },
    },
    {
      id: 'data',
      label: 'Data',
      icon: Layers,
      action: { kind: 'shape', type: 'rect', label: 'Data' },
    },
    {
      id: 'document',
      label: 'Document',
      icon: FileText,
      action: { kind: 'stamp', glyph: '📄' },
    },
    {
      id: 'stored',
      label: 'Stored data',
      icon: Database,
      action: { kind: 'stamp', glyph: '🗄️' },
    },
    {
      id: 'prep',
      label: 'Preparation',
      icon: Hexagon,
      action: { kind: 'shape', type: 'hexagon', label: 'Prep' },
    },
    {
      id: 'manual',
      label: 'Manual input',
      icon: AppWindow,
      action: { kind: 'shape', type: 'rect', label: 'Input' },
    },
    {
      id: 'merge',
      label: 'Merge',
      icon: Triangle,
      action: { kind: 'shape', type: 'triangle', label: 'Merge' },
    },
    {
      id: 'connector',
      label: 'Connector',
      icon: Circle,
      action: { kind: 'stamp', glyph: '⭕' },
    },
    {
      id: 'display',
      label: 'Display',
      icon: Monitor,
      action: { kind: 'stamp', glyph: '🖥️' },
    },
    {
      id: 'delay',
      label: 'Delay',
      icon: RefreshCw,
      action: { kind: 'shape', type: 'ellipse', label: 'Delay' },
    },
  ],
};
export const LIBRARY_SECTIONS: ShapeLibrarySection[] = [
  {
    id: 'uml',
    title: 'UML',
    color: UML_BLUE,
    items: [
      {
        id: 'actor',
        label: 'Actor',
        icon: User,
        action: { kind: 'stamp', glyph: '🧍' },
      },
      {
        id: 'usecase',
        label: 'Use case',
        icon: Circle,
        action: { kind: 'shape', type: 'ellipse', label: 'Use case' },
      },
      {
        id: 'class',
        label: 'Class',
        icon: Component,
        action: { kind: 'shape', type: 'rect', label: 'Class' },
      },
      {
        id: 'interface',
        label: 'Interface',
        icon: Boxes,
        action: { kind: 'shape', type: 'rect', label: '«interface»' },
      },
      {
        id: 'package',
        label: 'Package',
        icon: FolderTree,
        action: { kind: 'shape', type: 'rect', label: 'Package' },
      },
      {
        id: 'note',
        label: 'Note',
        icon: FileText,
        action: { kind: 'shape', type: 'rect', label: 'Note' },
      },
      {
        id: 'state',
        label: 'State',
        icon: Square,
        action: { kind: 'shape', type: 'rect', label: 'State' },
      },
      {
        id: 'activity',
        label: 'Activity',
        icon: Workflow,
        action: { kind: 'shape', type: 'rect', label: 'Activity' },
      },
      {
        id: 'decision-uml',
        label: 'Decision',
        icon: Diamond,
        action: { kind: 'shape', type: 'diamond', label: '' },
      },
      {
        id: 'component',
        label: 'Component',
        icon: Box,
        action: { kind: 'shape', type: 'rect', label: 'Component' },
      },
      {
        id: 'node',
        label: 'Node',
        icon: Server,
        action: { kind: 'stamp', glyph: '🖥️' },
      },
      {
        id: 'lifeline',
        label: 'Lifeline',
        icon: ListTree,
        action: { kind: 'shape', type: 'rect', label: 'Lifeline' },
      },
    ],
  },
  {
    id: 'erd',
    title: 'ERD',
    color: UML_BLUE,
    items: [
      {
        id: 'entity',
        label: 'Entity',
        icon: Table2,
        action: { kind: 'shape', type: 'rect', label: 'Entity' },
      },
      {
        id: 'weak',
        label: 'Weak entity',
        icon: Square,
        action: { kind: 'shape', type: 'rect', label: 'Weak entity' },
      },
      {
        id: 'rel',
        label: 'Relationship',
        icon: Diamond,
        action: { kind: 'shape', type: 'diamond', label: 'Rel' },
      },
      {
        id: 'attr',
        label: 'Attribute',
        icon: Circle,
        action: { kind: 'shape', type: 'ellipse', label: 'Attr' },
      },
      {
        id: 'pk',
        label: 'Primary key',
        icon: KeyRound,
        action: { kind: 'stamp', glyph: '🔑' },
      },
      {
        id: 'fk',
        label: 'Foreign key',
        icon: Network,
        action: { kind: 'stamp', glyph: '🔗' },
      },
    ],
  },
  {
    id: 'dataflow',
    title: 'Data Flow',
    color: UML_BLUE,
    items: [
      {
        id: 'dfd-process',
        label: 'Process',
        icon: Circle,
        action: { kind: 'shape', type: 'ellipse', label: 'Process' },
      },
      {
        id: 'dfd-entity',
        label: 'External entity',
        icon: Square,
        action: { kind: 'shape', type: 'rect', label: 'Entity' },
      },
      {
        id: 'dfd-store',
        label: 'Data store',
        icon: Database,
        action: { kind: 'stamp', glyph: '═' },
      },
      {
        id: 'dfd-flow',
        label: 'Data flow',
        icon: ArrowRight,
        action: { kind: 'tool', tool: 'arrow' },
      },
    ],
  },
  {
    id: 'azure',
    title: 'Azure',
    items: withColors(
      [
        {
          id: 'az-user',
          label: 'Entra ID',
          icon: Users,
          action: { kind: 'stamp', glyph: '👤' },
        },
        {
          id: 'az-sql',
          label: 'SQL',
          icon: Database,
          action: { kind: 'stamp', glyph: '🗄️' },
        },
        {
          id: 'az-fn',
          label: 'Functions',
          icon: Zap,
          action: { kind: 'stamp', glyph: '⚡' },
        },
        {
          id: 'az-key',
          label: 'Key Vault',
          icon: KeyRound,
          action: { kind: 'stamp', glyph: '🔐' },
        },
        {
          id: 'az-vm',
          label: 'Virtual machine',
          icon: Monitor,
          action: { kind: 'stamp', glyph: '💻' },
        },
        {
          id: 'az-storage',
          label: 'Storage',
          icon: HardDrive,
          action: { kind: 'stamp', glyph: '📦' },
        },
        {
          id: 'az-app',
          label: 'App Service',
          icon: AppWindow,
          action: { kind: 'stamp', glyph: '🪟' },
        },
        {
          id: 'az-k8s',
          label: 'AKS',
          icon: Hexagon,
          action: { kind: 'stamp', glyph: '☸️' },
        },
        {
          id: 'az-net',
          label: 'VNet',
          icon: Network,
          action: { kind: 'stamp', glyph: '🌐' },
        },
        {
          id: 'az-lock',
          label: 'Security',
          icon: Lock,
          action: { kind: 'stamp', glyph: '🛡️' },
        },
        {
          id: 'az-cog',
          label: 'Cloud',
          icon: CloudCog,
          action: { kind: 'stamp', glyph: '☁️' },
        },
        {
          id: 'az-server',
          label: 'Server',
          icon: Server,
          action: { kind: 'stamp', glyph: '🖥️' },
        },
      ],
      AZURE_COLORS,
    ),
  },
  {
    id: 'gcp',
    title: 'Google Cloud',
    items: withColors(
      [
        {
          id: 'gcp-bq',
          label: 'BigQuery',
          icon: LayoutGrid,
          action: { kind: 'stamp', glyph: '📊' },
        },
        {
          id: 'gcp-gke',
          label: 'GKE',
          icon: Hexagon,
          action: { kind: 'stamp', glyph: '☸️' },
        },
        {
          id: 'gcp-ce',
          label: 'Compute',
          icon: Server,
          action: { kind: 'stamp', glyph: '🖥️' },
        },
        {
          id: 'gcp-gcs',
          label: 'Cloud Storage',
          icon: HardDrive,
          action: { kind: 'stamp', glyph: '🪣' },
        },
        {
          id: 'gcp-iam',
          label: 'IAM',
          icon: Shield,
          action: { kind: 'stamp', glyph: '🛡️' },
        },
        {
          id: 'gcp-vpc',
          label: 'VPC',
          icon: Network,
          action: { kind: 'stamp', glyph: '🌐' },
        },
        {
          id: 'gcp-run',
          label: 'Cloud Run',
          icon: Container,
          action: { kind: 'stamp', glyph: '🏃' },
        },
        {
          id: 'gcp-sql',
          label: 'Cloud SQL',
          icon: Database,
          action: { kind: 'stamp', glyph: '🗃️' },
        },
        {
          id: 'gcp-fn',
          label: 'Functions',
          icon: Zap,
          action: { kind: 'stamp', glyph: '⚡' },
        },
        {
          id: 'gcp-pub',
          label: 'Pub/Sub',
          icon: Workflow,
          action: { kind: 'stamp', glyph: '📣' },
        },
        {
          id: 'gcp-lb',
          label: 'Load balancer',
          icon: ArrowLeftRight,
          action: { kind: 'stamp', glyph: '⚖️' },
        },
        {
          id: 'gcp-cloud',
          label: 'Cloud',
          icon: Cloud,
          action: { kind: 'stamp', glyph: '☁️' },
        },
      ],
      GCP_COLORS,
    ),
  },
  {
    id: 'cisco',
    title: 'Cisco',
    color: CISCO_BLUE,
    items: [
      {
        id: 'cisco-router',
        label: 'Router',
        icon: RefreshCw,
        action: { kind: 'stamp', glyph: '📡' },
      },
      {
        id: 'cisco-switch',
        label: 'Switch',
        icon: Network,
        action: { kind: 'stamp', glyph: '🔀' },
      },
      {
        id: 'cisco-fw',
        label: 'Firewall',
        icon: Shield,
        action: { kind: 'stamp', glyph: '🧱' },
      },
      {
        id: 'cisco-server',
        label: 'Server',
        icon: Server,
        color: '#E85D04',
        action: { kind: 'stamp', glyph: '🖥️' },
      },
      {
        id: 'cisco-db',
        label: 'Database',
        icon: Database,
        color: '#F48C06',
        action: { kind: 'stamp', glyph: '🗄️' },
      },
      {
        id: 'cisco-user',
        label: 'User',
        icon: User,
        action: { kind: 'stamp', glyph: '👤' },
      },
      {
        id: 'cisco-pc',
        label: 'Workstation',
        icon: Monitor,
        action: { kind: 'stamp', glyph: '🖥️' },
      },
      {
        id: 'cisco-phone',
        label: 'Phone',
        icon: Smartphone,
        action: { kind: 'stamp', glyph: '📱' },
      },
      {
        id: 'cisco-cloud',
        label: 'Cloud',
        icon: Cloud,
        action: { kind: 'stamp', glyph: '☁️' },
      },
      {
        id: 'cisco-lock',
        label: 'Security',
        icon: Lock,
        color: '#DC2F02',
        action: { kind: 'stamp', glyph: '🔒' },
      },
      {
        id: 'cisco-rack',
        label: 'Rack',
        icon: HardDrive,
        action: { kind: 'stamp', glyph: '🗄️' },
      },
      {
        id: 'cisco-down',
        label: 'Download',
        icon: ArrowDownToLine,
        action: { kind: 'stamp', glyph: '⬇️' },
      },
    ],
  },
  {
    id: 'k8s',
    title: 'Kubernetes',
    color: K8S_BLUE,
    items: [
      {
        id: 'k8s-pod',
        label: 'Pod',
        icon: Hexagon,
        action: { kind: 'stamp', glyph: '⬡' },
      },
      {
        id: 'k8s-svc',
        label: 'Service',
        icon: Network,
        action: { kind: 'stamp', glyph: 'svc' },
      },
      {
        id: 'k8s-deploy',
        label: 'Deployment',
        icon: Boxes,
        action: { kind: 'stamp', glyph: 'deploy' },
      },
      {
        id: 'k8s-ing',
        label: 'Ingress',
        icon: ArrowRight,
        action: { kind: 'stamp', glyph: 'ing' },
      },
      {
        id: 'k8s-node',
        label: 'Node',
        icon: Server,
        action: { kind: 'stamp', glyph: 'node' },
      },
      {
        id: 'k8s-api',
        label: 'API',
        icon: Component,
        action: { kind: 'stamp', glyph: 'api' },
      },
      {
        id: 'k8s-cron',
        label: 'CronJob',
        icon: RefreshCw,
        action: { kind: 'stamp', glyph: 'cron' },
      },
      {
        id: 'k8s-ns',
        label: 'Namespace',
        icon: FolderTree,
        action: { kind: 'stamp', glyph: 'ns' },
      },
      {
        id: 'k8s-cm',
        label: 'ConfigMap',
        icon: FileText,
        action: { kind: 'stamp', glyph: 'cm' },
      },
      {
        id: 'k8s-sec',
        label: 'Secret',
        icon: Lock,
        action: { kind: 'stamp', glyph: 'secret' },
      },
      {
        id: 'k8s-pv',
        label: 'Volume',
        icon: HardDrive,
        action: { kind: 'stamp', glyph: 'pv' },
      },
      {
        id: 'k8s-job',
        label: 'Job',
        icon: Zap,
        action: { kind: 'stamp', glyph: 'job' },
      },
    ],
  },
  {
    id: 'vmware',
    title: 'VMware',
    items: withColors(
      [
        {
          id: 'vm-db',
          label: 'Database',
          icon: Database,
          action: { kind: 'stamp', glyph: '🗄️' },
        },
        {
          id: 'vm-phone',
          label: 'Mobile',
          icon: Smartphone,
          action: { kind: 'stamp', glyph: '📱' },
        },
        {
          id: 'vm-laptop',
          label: 'Laptop',
          icon: Monitor,
          action: { kind: 'stamp', glyph: '💻' },
        },
        {
          id: 'vm-cloud',
          label: 'Cloud',
          icon: Cloud,
          action: { kind: 'stamp', glyph: '☁️' },
        },
        {
          id: 'vm-server',
          label: 'Server',
          icon: Server,
          action: { kind: 'stamp', glyph: '🖥️' },
        },
        {
          id: 'vm-gear',
          label: 'Config',
          icon: CloudCog,
          action: { kind: 'stamp', glyph: '⚙️' },
        },
        {
          id: 'vm-factory',
          label: 'Factory',
          icon: Factory,
          action: { kind: 'stamp', glyph: '🏭' },
        },
        {
          id: 'vm-truck',
          label: 'Logistics',
          icon: Truck,
          action: { kind: 'stamp', glyph: '🚚' },
        },
        {
          id: 'vm-plane',
          label: 'Transit',
          icon: Plane,
          action: { kind: 'stamp', glyph: '✈️' },
        },
        {
          id: 'vm-shield',
          label: 'Security',
          icon: Shield,
          action: { kind: 'stamp', glyph: '🛡️' },
        },
        {
          id: 'vm-users',
          label: 'Users',
          icon: Users,
          action: { kind: 'stamp', glyph: '👥' },
        },
        {
          id: 'vm-hd',
          label: 'Storage',
          icon: HardDrive,
          action: { kind: 'stamp', glyph: '💾' },
        },
      ],
      VMWARE_COLORS,
    ),
  },
];
export const MORE_SHAPES_SECTIONS: ShapeLibrarySection[] = [
  BUILDING_TOOLS,
  DIAGRAMMING_BASIC,
  DIAGRAMMING_FLOW,
  ...LIBRARY_SECTIONS,
];
