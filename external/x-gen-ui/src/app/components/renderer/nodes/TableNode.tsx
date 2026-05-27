import { UINode } from "../../../lib/schema";

export function TableNode({ node }: { node: Extract<UINode, { type: "table" }> }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white text-slate-950">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead className="bg-slate-100">
          <tr>
            {node.columns.map((column) => (
              <th key={column} className="px-4 py-3 font-extrabold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {node.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-slate-100">
              {node.columns.map((column) => (
                <td key={column} className="px-4 py-3">
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
