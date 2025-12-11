import React, { useEffect, useState } from "react";

interface ImageWithFallbackProps {
  srcPath?: string;
  alt: string;
  emoji: string;
  style?: React.CSSProperties;
  className?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  srcPath,
  alt,
  emoji,
  style,
  className,
}) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [srcPath]);

  if (!srcPath || error) {
    return (
      <span style={{ display: "inline-block", fontSize: 28, ...style }}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={srcPath}
      alt={alt}
      className={className}
      style={style}
      onError={() => setError(true)}
    />
  );
};
