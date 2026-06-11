/**
 * 統一 Modal 元件
 * 包裝 Flowbite Modal，確保在 iPad 上半透明遮罩與內容置中
 * 使用 root 屬性將 Modal 掛載到 main-content，避免遮住左側 Sidebar
 */
import React, { useState, useEffect } from 'react';
import { Modal as FlowbiteModal } from 'flowbite-react';

const Modal = ({ show, onClose, title, children, footer, size = 'md' }) => {
  const [modalRoot, setModalRoot] = useState(null);

  useEffect(() => {
    // 綁定到 main-content，確保彈窗只在右側內容區顯示並置中
    const rootEl = document.getElementById('main-content');
    if (rootEl) setModalRoot(rootEl);
  }, []);

  return (
    <FlowbiteModal
      show={show}
      onClose={onClose}
      size={size}
      root={modalRoot || undefined}
      className="bg-gray-900/50 backdrop-blur-sm"
    >
      <FlowbiteModal.Header className="border-b border-gray-100 p-5">
        <span className="text-xl font-bold text-text">{title}</span>
      </FlowbiteModal.Header>
      <FlowbiteModal.Body className="p-6 overflow-y-auto max-h-[70vh]">
        {children}
      </FlowbiteModal.Body>
      {footer && (
        <FlowbiteModal.Footer className="border-t border-gray-100 p-5 flex justify-end gap-3">
          {footer}
        </FlowbiteModal.Footer>
      )}
    </FlowbiteModal>
  );
};

export default Modal;
