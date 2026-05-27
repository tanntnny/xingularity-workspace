import { UINode } from "../../lib/schema";
import { AccordionNode } from "./nodes/AccordionNode";
import { CalloutNode } from "./nodes/CalloutNode";
import { CardNode } from "./nodes/CardNode";
import { ChartNode } from "./nodes/ChartNode";
import { FlowDiagramNode } from "./nodes/FlowDiagramNode";
import { GridNode } from "./nodes/GridNode";
import { PageNode } from "./nodes/PageNode";
import { QuizNode } from "./nodes/QuizNode";
import { SectionNode } from "./nodes/SectionNode";
import { SliderSimulatorNode } from "./nodes/SliderSimulatorNode";
import { TableNode } from "./nodes/TableNode";
import { TabsNode } from "./nodes/TabsNode";
import { TextNode } from "./nodes/TextNode";
import { TimelineNode } from "./nodes/TimelineNode";

export type RenderNodeFn = (node: UINode, key?: React.Key) => React.ReactNode;
export type NodeRenderer<T extends UINode = UINode> = (props: { node: T; renderNode: RenderNodeFn }) => JSX.Element;

export const componentRegistry: Record<UINode["type"], NodeRenderer<any>> = {
  page: PageNode,
  section: SectionNode,
  text: TextNode,
  callout: CalloutNode,
  card: CardNode,
  grid: GridNode,
  tabs: TabsNode,
  accordion: AccordionNode,
  table: TableNode,
  chart: ChartNode,
  quiz: QuizNode,
  timeline: TimelineNode,
  flowDiagram: FlowDiagramNode,
  sliderSimulator: SliderSimulatorNode,
};
