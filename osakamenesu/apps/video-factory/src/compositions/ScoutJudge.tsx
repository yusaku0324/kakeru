import React from "react";
import {
  Composition,
  Sequence,
  AbsoluteFill,
  Img,
  Audio,
  staticFile,
} from "remotion";

// Props の型定義
export interface ScoutJudgeProps {
  lines: [string, string, string]; // 必ず3行
  imageId?: string;
  duration: number;
}

// 縦動画のサイズ設定（9:16）
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const FPS = 30;
const DEFAULT_DURATION = 24; // 24秒固定

// スカウトジャッジコンポーネント
export const ScoutJudgeContent: React.FC<ScoutJudgeProps> = ({
  lines = ["", "", ""],
  imageId,
  duration = DEFAULT_DURATION,
}) => {
  // 3行を均等に表示（各行8秒）
  const framesPerLine = Math.floor((duration * FPS) / 3);

  // 画像パス
  const imagePath = imageId
    ? `ai-images/${imageId}.svg`
    : "ai-images/ai-beauty-001.svg";

  return (
    <AbsoluteFill>
      {/* BGM - public/bgm/mysterious.mp3 を配置すると有効
      <Audio
        src={staticFile("bgm/mysterious.mp3")}
        volume={0.25}
      />
      */}

      {/* 背景 */}
      <AbsoluteFill
        style={{
          background: "#0a0a0a",
        }}
      />

      {/* 静止画 */}
      <AbsoluteFill>
        <Img
          src={staticFile(imagePath)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <AbsoluteFill
          style={{
            background: "rgba(0, 0, 0, 0.5)",
          }}
        />
      </AbsoluteFill>

      {/* テロップ：3行を均等タイミングで表示 */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          paddingBottom: "280px",
        }}
      >
        {/* 1行目 */}
        <Sequence from={0} durationInFrames={framesPerLine}>
          <Telop text={lines[0]} />
        </Sequence>

        {/* 2行目 */}
        <Sequence from={framesPerLine} durationInFrames={framesPerLine}>
          <Telop text={lines[1]} />
        </Sequence>

        {/* 3行目 */}
        <Sequence from={framesPerLine * 2} durationInFrames={framesPerLine}>
          <Telop text={lines[2]} />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// テロップコンポーネント（シンプル・余白広め）
const Telop: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "80px",
      }}
    >
      <p
        style={{
          fontSize: "52px",
          color: "#ffffff",
          fontWeight: "normal",
          textAlign: "center",
          lineHeight: 1.6,
          margin: 0,
          letterSpacing: "0.05em",
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};

// Remotion Composition の定義
export const ScoutJudge: React.FC = () => {
  return (
    <React.Fragment>
      <Composition
        id="ScoutJudge"
        component={ScoutJudgeContent}
        durationInFrames={DEFAULT_DURATION * FPS}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          lines: ["「◯◯」", "だいたい", "失敗する"] as [string, string, string],
          imageId: undefined,
          duration: DEFAULT_DURATION,
        }}
      />
    </React.Fragment>
  );
};