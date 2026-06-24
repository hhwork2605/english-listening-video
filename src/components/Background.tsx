import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Nền tĩnh dạng gradient. Muốn dùng ảnh nền thì thay bằng:
 *   <Img src={staticFile("backgrounds/your-image.jpg")} ... />
 */
export const Background: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
      }}
    />
  );
};
