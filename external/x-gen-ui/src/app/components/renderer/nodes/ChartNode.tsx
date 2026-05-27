import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UINode } from "../../../lib/schema";

const colors = ["#2563eb", "#059669", "#f97316", "#7c3aed", "#475569", "#dc2626"];

export function ChartNode({ node }: { node: Extract<UINode, { type: "chart" }> }) {
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={node.xKey} />
      <YAxis />
      <Tooltip />
    </>
  );

  return (
    <div className="h-80 rounded-xl border border-slate-200 bg-white p-4 text-slate-950">
      <ResponsiveContainer width="100%" height="100%">
        {node.chartType === "bar" ? (
          <BarChart data={node.data}>
            {common}
            <Bar dataKey={node.yKey} fill="#2563eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        ) : node.chartType === "line" ? (
          <LineChart data={node.data}>
            {common}
            <Line type="monotone" dataKey={node.yKey} stroke="#2563eb" strokeWidth={3} />
          </LineChart>
        ) : node.chartType === "area" ? (
          <AreaChart data={node.data}>
            {common}
            <Area type="monotone" dataKey={node.yKey} stroke="#2563eb" fill="#bfdbfe" />
          </AreaChart>
        ) : (
          <PieChart>
            <Tooltip />
            <Pie data={node.data} dataKey={node.yKey} nameKey={node.xKey} outerRadius={110} label>
              {node.data.map((_, index) => (
                <Cell key={index} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
