import { renderMedia } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 固定値
const DURATION = 24; // 24秒固定
const FPS = 30;

// 入力データの型定義（3行固定）
interface ScriptData {
  id: string;
  lines: [string, string, string]; // 必ず3行
  imageId?: string;
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
    const scriptsDir = path.resolve(__dirname, "../resources/scripts");
    const outputDir = path.resolve(__dirname, "../out/videos");

    // ディレクトリが存在しない場合は作成
    await fs.mkdir(scriptsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    // JSONファイルを列挙
    const files = await fs.readdir(scriptsDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
      console.log("⚠️  台本JSONファイルが見つかりません。");
      console.log(`📁 ${scriptsDir} にJSONファイルを配置してください。`);
      return;
    }

    console.log(`📄 ${jsonFiles.length}件の台本を検出`);

    // 各JSONファイルを処理
    for (const jsonFile of jsonFiles) {
      const filePath = path.join(scriptsDir, jsonFile);
      console.log(`\n🎥 処理中: ${jsonFile}`);

      try {
        // JSONを読み込む
        const jsonContent = await fs.readFile(filePath, "utf-8");
        const scriptData: ScriptData = JSON.parse(jsonContent);

        // 3行チェック（3行以外はスキップ）
        if (!scriptData.lines || scriptData.lines.length !== 3) {
          console.error(`❌ スキップ: ${jsonFile} - linesは必ず3行`);
          continue;
        }

        // 出力ファイル名
        const outputPath = path.join(outputDir, `${scriptData.id}.mp4`);

        // レンダリング
        console.log(`   "${scriptData.lines[0]}"`);
        console.log(`   "${scriptData.lines[1]}"`);
        console.log(`   "${scriptData.lines[2]}"`);

        await renderMedia({
          composition: {
            id: "ScoutJudge",
            durationInFrames: DURATION * FPS,
            fps: FPS,
            width: 1080,
            height: 1920,
          },
          serveUrl: bundleLocation,
          codec: "h264",
          outputLocation: outputPath,
          inputProps: {
            lines: scriptData.lines,
            imageId: scriptData.imageId,
            duration: DURATION,
          },
          onProgress: ({ progress }) => {
            process.stdout.write(`\r   進捗: ${Math.round(progress * 100)}%`);
          },
        });

        console.log(`\n✅ ${scriptData.id}.mp4`);
      } catch (error) {
        console.error(`❌ エラー: ${jsonFile}`, error);
      }
    }

    console.log("\n🎉 完了");
  } catch (error) {
    console.error("❌ バッチレンダリングエラー:", error);
    process.exit(1);
  }
}

renderVideos();