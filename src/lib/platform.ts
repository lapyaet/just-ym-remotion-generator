/**
 * Server-side MP4 rendering needs a long-running Node server with Chrome and
 * ffmpeg. Serverless hosts like Vercel can't do it (use Remotion Lambda there).
 */
export const renderingAvailable = () => !process.env.VERCEL;

export const RENDER_UNAVAILABLE_MESSAGE =
  "MP4 rendering isn't available on Vercel. The preview works here; to export MP4s, run the app on a Node server or in Docker.";
