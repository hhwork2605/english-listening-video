import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Tăng concurrency nếu máy mạnh; để mặc định cho an toàn.
// Config.setConcurrency(4);
