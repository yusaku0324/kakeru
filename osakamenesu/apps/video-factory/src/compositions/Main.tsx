import React from "react";
import { Composition, Sequence, useCurrentFrame, AbsoluteFill } from "remotion";
import { ScoutJudge } from "./ScoutJudge";

// Props の型定義
export interface VideoProps {
  title: string;
  lines: string[];
}

// 縦動画のサイズ設定（9:16）
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const FPS = 30;
const DURATION_SECONDS = 10;

// メインのビデオコンポーネント
export const VideoContent: React.FC<VideoProps> = ({ title = "タイトル", lines = [] }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "80px",
      }}
    >
      {/* タイトル */}
      <Sequence from={0} durationInFrames={FPS * 3}>
        <h1
          style={{
            fontSize: "72px",
            color: "#fff",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "60px",
            opacity: frame < 15 ? frame / 15 : 1,
          }}
        >
          {title}
        </h1>
      </Sequence>

      {/* テキスト行を順番に表示 */}
      <div style={{ marginTop: "60px", width: "100%" }}>
        {lines && lines.length > 0 && lines.map((line, index) => (
          <Sequence
            key={index}
            from={FPS * 3 + index * FPS} // 3秒後から1秒ずつ遅れて表示
            durationInFrames={FPS * (DURATION_SECONDS - 3 - index)}
          >
            <p
              style={{
                fontSize: "48px",
                color: "#fff",
                textAlign: "center",
                marginBottom: "30px",
                opacity:
                  frame < FPS * 3 + index * FPS + 15
                    ? (frame - (FPS * 3 + index * FPS)) / 15
                    : 1,
              }}
            >
              {line}
            </p>
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Remotion Composition の定義
export const Main: React.FC = () => {
  return (
    <React.Fragment>
      <Composition
        id="VideoFactory"
        component={VideoContent}
        durationInFrames={FPS * DURATION_SECONDS}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{
          title: "サンプルタイトル",
          lines: ["最初のテキスト", "次のテキスト", "最後のテキスト"],
        }}
      />
      <ScoutJudge />
    </React.Fragment>
  );
};
