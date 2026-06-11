/**
 * 統一標籤元件
 * 根據 color 顯示對應的 Tailwind 顏色
 */
import React from 'react';

const Tag = ({ color = 'gray', children }) => {
  const colorMap = {
    rose: "bg-primary-light text-primary-dark",
    green: "bg-success/20 text-success",
    amber: "bg-warning/20 text-warning",
    blue: "bg-info/20 text-info",
    gray: "bg-gray-100 text-gray-500",
  };

  return (
    <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium ${colorMap[color]}`}>
      {children}
    </span>
  );
};

export default Tag;
