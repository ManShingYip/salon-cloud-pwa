/**
 * 核心按鈕元件 - 觸控友善優化
 * 提供 Primary, Secondary, Danger 三種樣式，最小高度 48px
 */
import React from 'react';
import { Button as FlowbiteButton, Spinner } from 'flowbite-react';

const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false, 
  onClick, 
  children, 
  icon: Icon,
  className = '' 
}) => {
  const baseClasses = "rounded-xl font-medium min-h-[48px] min-w-[44px] transition-all active:scale-95 flex items-center justify-center gap-2";
  
  const variantClasses = {
    primary: "bg-primary text-white shadow-sm enabled:hover:bg-primary-dark border-none",
    secondary: "bg-transparent border-2 border-primary text-primary enabled:hover:bg-primary-light",
    danger: "bg-danger text-white shadow-sm enabled:hover:bg-red-600 border-none",
  };

  const sizeClasses = {
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <FlowbiteButton
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <Spinner size="sm" light={variant !== 'secondary'} />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {children}
        </>
      )}
    </FlowbiteButton>
  );
};

export default Button;
