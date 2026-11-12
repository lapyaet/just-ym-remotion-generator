import fs from "node:fs";
import { Readable } from "node:stream";
import { apiUser, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** Stream a finished MP4. Add ?download=1 to save it as a file. */
export async function GET(request: Request, { params }: Ctx) {
  const { user, response } = await apiUser();
  if (!user) return response;

  const render = await prisma.render.findFirst({
    where: { id: (await params).id, status: "done", project: { userId: user.id } },
    include: { project: { select: { title: true } } },
  });
  if (!render?.outputPath || !fs.existsSync(render.outputPath)) return notFound();

  const { size } = await fs.promises.stat(render.outputPath);
  const download = new URL(request.url).searchParams.has("download");
  const filename = `${render.project.title.replace(/[^\w\- ]+/g, "").trim() || "video"}.mp4`;
  const stream = Readable.toWeb(fs.createReadStream(render.outputPath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
