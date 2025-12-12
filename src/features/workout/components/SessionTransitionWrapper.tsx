import React from "react";

interface SessionTransitionWrapperProps {
  isActive: boolean;
  children: React.ReactNode;
}

export default function SessionTransitionWrapper({
  isActive,
  children,
}: SessionTransitionWrapperProps) {
  return (
    <div
      style={{
        minHeight: isActive ? "220px" : "0",
        transition: "min-height 0.3s ease-in-out",
      }}
    >
      <div
        style={{
          minHeight: isActive ? "220px" : "0",
          transition: "min-height 0.3s ease-in-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}