import { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * RetroTable Component
 * Monospace data grid with alternating rows and sortable columns
 * 
 * @example
 * <RetroTable
 *   columns={[
 *     { key: 'protocol', label: 'PROTOCOL', sortable: true },
 *     { key: 'apy', label: 'APY', align: 'right' }
 *   ]}
 *   data={[{ protocol: 'AAVE-V3', apy: '5.2%' }]}
 * />
 */

export function RetroTable({
  columns,
  data,
  onSort,
  selectable = false,
  onRowClick,
  selectedRows = new Set(),
  className = '',
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (key) => {
    if (!columns.find(c => c.key === key)?.sortable) return;

    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);

    if (onSort) {
      onSort(key, newDirection);
    }
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="retro-table w-full border-collapse font-mono text-sm">
        <thead>
          <tr>
            {selectable && (
              <th className="w-12 text-center">
                <input
                  type="checkbox"
                  className="retro-checkbox"
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`
                  bg-black text-white border-2 border-black px-3 py-2
                  font-pixel uppercase text-xs
                  ${alignClasses[column.align || 'left']}
                  ${column.sortable ? 'cursor-pointer hover:bg-gray-900' : ''}
                `}
                onClick={() => column.sortable && handleSort(column.key)}
                role={column.sortable ? 'button' : undefined}
                tabIndex={column.sortable ? 0 : undefined}
              >
                <div className="flex items-center justify-between">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="ml-2 text-xs">
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <span className="text-gray-600">↕</span>
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="text-center py-8 text-gray-600 border-2 border-black"
              >
                <span className="font-mono">NO DATA AVAILABLE</span>
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const isSelected = selectedRows.has(row.id || index);
              return (
                <tr
                  key={row.id || index}
                  className={`
                    ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}
                    ${onRowClick ? 'cursor-pointer hover:bg-gray-200' : ''}
                    ${isSelected ? 'bg-green-100' : ''}
                  `}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {selectable && (
                    <td className="text-center border border-black px-2 py-1">
                      <input
                        type="checkbox"
                        className="retro-checkbox"
                        checked={isSelected}
                        onChange={(e) => e.stopPropagation()}
                        aria-label={`Select row ${index + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        border border-black px-3 py-2
                        ${alignClasses[column.align || 'left']}
                      `}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * RetroTableCompact - Smaller version for mobile/limited space
 */
export function RetroTableCompact({ columns, data, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {data.map((row, index) => (
        <div
          key={row.id || index}
          className="retro-card border-2 border-black p-3 font-mono text-sm"
        >
          {columns.map((column) => (
            <div key={column.key} className="flex justify-between mb-1">
              <span className="text-gray-600 uppercase text-xs">{column.label}:</span>
              <span className="font-semibold">{row[column.key]}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

