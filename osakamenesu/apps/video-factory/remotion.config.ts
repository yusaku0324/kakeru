import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(1);
Config.setStillImageFormat("jpeg");

// デフォルトの出力ディレクトリを設定
Config.setOutputLocation("out/videos");

export {};
