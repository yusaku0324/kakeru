import { renderMedia } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 入力データの型定義
interface InputData {
  id: string;
  title: string;
  lines: string[];
}

async function renderVideos() {
  console.log("🎬 Video Factory - バッチレンダリング開始");

  try {
    // バンドル作成
    console.log("📦 Remotionプロジェクトをバンドル中...");
    const bundleLocation = await bundle({
      entryPoint: path.resolve(__dirname, "../src/index.ts"),
      webpackOverride: (config) => config,
    });

    // 入力ディレクトリのJSONファイルを読み込む
    const dataDir = path.resolve(__dirname, "../out/data");
    const outputDir = path.resolve(__dirname, "../out/videos");

    // ディレクトリが存在しない場合は作成
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // JSONファイルを列挙
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
      console.log("⚠️  入力JSONファイルが見つかりません。");
      console.log(`📁 ${dataDir} にJSONファイルを配置してください。`);

      // サンプルJSONを作成
      const sampleData: InputData = {
        id: "sample",
        title: "サンプル動画",
        lines: ["これは", "サンプルの", "動画です"],
      };

      await fs.writeFile(
        path.join(dataDir, "sample.json"),
        JSON.stringify(sampleData, null, 2)
      );

      console.log("✅ サンプルJSON (sample.json) を作成しました。");
      return;
    }

    console.log(`📄 ${jsonFiles.length}個のJSONファイルを検出`);

    // 各JSONファイルを処理
    for (const jsonFile of jsonFiles) {
      const filePath = path.join(dataDir, jsonFile);
      console.log(`\n🎥 処理中: ${jsonFile}`);

      try {
        // JSONを読み込む
        const jsonContent = await fs.readFile(filePath, "utf-8");
        const inputData: InputData = JSON.parse(jsonContent);

        // 出力ファイル名
        const outputPath = path.join(outputDir, `${inputData.id}.mp4`);

        // 動画をレンダリング
        console.log(`🎬 レンダリング開始: ${inputData.title}`);
        await renderMedia({
          composition: {
            id: "VideoFactory",
            durationInFrames: 300, // 10秒 × 30fps
            fps: 30,
            width: 1080,
            height: 1920,
          },
          serveUrl: bundleLocation,
          codec: "h264",
          outputLocation: outputPath,
          inputProps: {
            title: inputData.title,
            lines: inputData.lines,
          },
          onProgress: ({ progress }) => {
            process.stdout.write(`\r進捗: ${Math.round(progress * 100)}%`);
          },
        });

        console.log(`\n✅ 完了: ${outputPath}`);
      } catch (error) {
        console.error(`❌ エラー: ${jsonFile}`, error);
      }
    }

    console.log("\n🎉 すべての動画のレンダリングが完了しました！");
  } catch (error) {
    console.error("❌ バッチレンダリングエラー:", error);
    process.exit(1);
  }
}

// メイン実行
renderVideos();
